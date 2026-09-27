import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

// Alert helper function
const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
  }
};

// Interfaces
interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

interface LoanRequest {
  id: string;
  amount: number;
  interestRate: number;
  reason: string;
  startDate: string;
  dueDate: string;
  status: string;
  outstandingBalance: number;
  guarantorAmount: number;
  guarantor?: Member;
  member: Member;
  group?: {
    id: string;
    groupName: string;
  };
  mlRiskLevel?: string;
  mlConfidenceScore?: number;
  isMlApproved?: boolean;
  repaymentMonths?: number;
}

type TabType = 'pending' | 'history';

export default function GuarantorRequestsScreen() {
  const [pendingRequests, setPendingRequests] = useState<LoanRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<LoanRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<LoanRequest | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch loans where current member is a guarantor
  const fetchGuarantorRequests = useCallback(async () => {
    if (!memberId) return;

    try {
      console.log('🔍 Fetching guarantor requests for member:', memberId);
      
      // Fetch all loans
      const loansRes = await fetch(`${BASE_URL}/loans`);
      if (!loansRes.ok) {
        throw new Error('Failed to fetch loans');
      }
      
      const allLoans: LoanRequest[] = await loansRes.json();
      console.log('📋 Total loans fetched:', allLoans.length);
      
      // Separate into pending and history
      const pending = allLoans.filter(loan => 
        loan.guarantor?.id === memberId && 
        loan.status === 'PENDING_GUARANTOR'
      );
      
      const history = allLoans.filter(loan => 
        loan.guarantor?.id === memberId && 
        (loan.status === 'APPROVED' || loan.status === 'REJECTED' || loan.status === 'ACTIVE' || loan.status === 'PAID')
      );
      
      console.log('📋 Pending guarantor requests:', pending.length);
      console.log('📋 History guarantor requests:', history.length);
      
      setPendingRequests(pending);
      setHistoryRequests(history);
      
    } catch (err) {
      console.error('Error fetching guarantor requests:', err);
      showAlert('Error', 'Failed to load guarantee requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId]);

  useEffect(() => {
    const loadMemberData = async () => {
      const storedMemberId = await AsyncStorage.getItem('userId');
      const firstName = await AsyncStorage.getItem('userFirstName');
      const lastName = await AsyncStorage.getItem('userLastName');
      
      if (!storedMemberId) {
        router.replace('/(auth)');
        return;
      }
      
      setMemberId(storedMemberId);
      setMemberName(`${firstName || ''} ${lastName || ''}`.trim());
      fetchGuarantorRequests();
    };
    
    loadMemberData();
  }, [fetchGuarantorRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGuarantorRequests();
  };

  // Accept guarantee
  const acceptGuarantee = async (loanId: string) => {
    setProcessingId(loanId);
    
    try {
      const response = await fetch(`${BASE_URL}/loans/${loanId}/accept-guarantee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guarantorId: memberId }),
      });
      
      if (response.ok) {
        showAlert(
          '✅ Guarantee Accepted!',
          'You have successfully accepted to guarantee this loan. The loan will now be processed for approval.',
          () => {
            fetchGuarantorRequests();
            setDetailsModalVisible(false);
          }
        );
      } else {
        const error = await response.text();
        showAlert('Error', `Failed to accept guarantee: ${error}`);
      }
    } catch (err) {
      console.error('Error accepting guarantee:', err);
      showAlert('Error', 'Network error. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  // Decline guarantee
  const declineGuarantee = async (loanId: string) => {
    setProcessingId(loanId);
    
    try {
      const response = await fetch(`${BASE_URL}/loans/${loanId}/decline-guarantee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guarantorId: memberId }),
      });
      
      if (response.ok) {
        showAlert(
          '❌ Guarantee Declined',
          'You have declined to guarantee this loan. The loan application will be cancelled.',
          () => {
            fetchGuarantorRequests();
            setDetailsModalVisible(false);
          }
        );
      } else {
        const error = await response.text();
        showAlert('Error', `Failed to decline guarantee: ${error}`);
      }
    } catch (err) {
      console.error('Error declining guarantee:', err);
      showAlert('Error', 'Network error. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const getRiskColor = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case 'VERY LOW': return '#4CAF50';
      case 'LOW': return '#8BC34A';
      case 'MEDIUM': return '#FFC107';
      case 'HIGH': return '#FF9800';
      case 'VERY HIGH': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return '#4CAF50';
      case 'ACTIVE': return '#2196F3';
      case 'REJECTED': return '#F44336';
      case 'PAID': return '#1B5E20';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return '✅';
      case 'ACTIVE': return '🔄';
      case 'REJECTED': return '❌';
      case 'PAID': return '💰';
      default: return '📋';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-KE');
  };

  const renderRequestCard = ({ item }: { item: LoanRequest }) => (
    <TouchableOpacity 
      style={styles.requestCard} 
      onPress={() => {
        setSelectedLoan(item);
        setDetailsModalVisible(true);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.borrowerInfo}>
          <Text style={styles.borrowerName}>
            {item.member?.firstName} {item.member?.lastName}
          </Text>
          <Text style={styles.borrowerEmail}>{item.member?.email}</Text>
        </View>
        {item.isMlApproved && (
          <View style={styles.mlBadge}>
            <Text style={styles.mlBadgeText}>🤖 AI</Text>
          </View>
        )}
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Loan Amount:</Text>
          <Text style={styles.detailValue}>KES {item.amount.toLocaleString('en-KE')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Guarantee Amount:</Text>
          <Text style={[styles.detailValue, styles.guaranteeAmount]}>
            KES {item.guarantorAmount?.toLocaleString('en-KE') || 'N/A'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Reason:</Text>
          <Text style={styles.detailValue} numberOfLines={2}>{item.reason}</Text>
        </View>
        {item.mlRiskLevel && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>AI Risk Level:</Text>
            <Text style={[styles.riskBadge, { backgroundColor: getRiskColor(item.mlRiskLevel) + '20', color: getRiskColor(item.mlRiskLevel) }]}>
              {item.mlRiskLevel}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.requestDate}>
          Requested: {formatDate(item.startDate)}
        </Text>
        {activeTab === 'history' && (
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusIcon(item.status)} {item.status}
            </Text>
          </View>
        )}
        {activeTab === 'pending' && (
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => {
              setSelectedLoan(item);
              setDetailsModalVisible(true);
            }}
          >
            <Text style={styles.viewButtonText}>View Details →</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🤝</Text>
      <Text style={styles.emptyTitle}>
        {activeTab === 'pending' ? 'No Pending Requests' : 'No History'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'pending' 
          ? 'You don\'t have any guarantee requests at the moment. When someone adds you as a guarantor, you\'ll see it here.'
          : 'You haven\'t accepted or declined any guarantee requests yet.'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#388E3C" />
        <Text style={styles.loadingText}>Loading guarantee requests...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.dashboardButton} onPress={() => router.back()}>
            <Text style={styles.dashboardButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            ⏳ Pending ({pendingRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            📜 History ({historyRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#388E3C']} />
        }
      >
        <View style={styles.contentContainer}>
          {/* Member Info Card */}
          <View style={styles.memberCard}>
            <Text style={styles.memberName}>Welcome, {memberName}</Text>
            <Text style={styles.memberInfo}>
              As a guarantor, you are responsible for repaying this loan if the borrower defaults.
            </Text>
          </View>

          {/* Requests List */}
          {activeTab === 'pending' && pendingRequests.length > 0 && (
            <FlatList
              data={pendingRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderRequestCard}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}

          {activeTab === 'history' && historyRequests.length > 0 && (
            <FlatList
              data={historyRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderRequestCard}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}

          {(activeTab === 'pending' && pendingRequests.length === 0) || 
           (activeTab === 'history' && historyRequests.length === 0) ? (
            renderEmptyState()
          ) : null}

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>ℹ️ About Being a Guarantor</Text>
            <Text style={styles.infoText}>
              • You are only responsible if the borrower defaults{'\n'}
              • Your guarantee helps the borrower get loan approval{'\n'}
              • You can only guarantee up to your available capacity{'\n'}
              • Review the loan details carefully before accepting
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Loan Details Modal */}
      <Modal visible={detailsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Loan Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)} style={styles.closeXButton}>
                <Text style={styles.closeXText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedLoan && (
              <ScrollView style={styles.modalScrollView}>
                {/* Borrower Info */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>👤 Borrower Information</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name:</Text>
                    <Text style={styles.infoValue}>
                      {selectedLoan.member?.firstName} {selectedLoan.member?.lastName}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>{selectedLoan.member?.email}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{selectedLoan.member?.phoneNumber || 'N/A'}</Text>
                  </View>
                </View>

                {/* Loan Details */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>💰 Loan Information</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Loan Amount:</Text>
                    <Text style={styles.infoValue}>KES {selectedLoan.amount.toLocaleString('en-KE')}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Your Guarantee:</Text>
                    <Text style={[styles.infoValue, styles.highlightValue]}>
                      KES {selectedLoan.guarantorAmount?.toLocaleString('en-KE')}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Interest Rate:</Text>
                    <Text style={styles.infoValue}>{selectedLoan.interestRate}%</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Repayment Term:</Text>
                    <Text style={styles.infoValue}>{selectedLoan.repaymentMonths || 12} months</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Start Date:</Text>
                    <Text style={styles.infoValue}>{formatDate(selectedLoan.startDate)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Due Date:</Text>
                    <Text style={styles.infoValue}>{formatDate(selectedLoan.dueDate)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Reason:</Text>
                    <Text style={styles.infoValue}>{selectedLoan.reason}</Text>
                  </View>
                  {activeTab === 'history' && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Loan Status:</Text>
                      <Text style={[styles.infoValue, { color: getStatusColor(selectedLoan.status), fontWeight: 'bold' }]}>
                        {getStatusIcon(selectedLoan.status)} {selectedLoan.status}
                      </Text>
                    </View>
                  )}
                </View>

                {/* AI Assessment (if ML-approved) */}
                {selectedLoan.isMlApproved && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>🤖 AI Risk Assessment</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Risk Level:</Text>
                      <Text style={[styles.riskBadgeLarge, { backgroundColor: getRiskColor(selectedLoan.mlRiskLevel) + '20', color: getRiskColor(selectedLoan.mlRiskLevel) }]}>
                        {selectedLoan.mlRiskLevel}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Confidence Score:</Text>
                      <Text style={styles.infoValue}>
                        {selectedLoan.mlConfidenceScore ? `${(selectedLoan.mlConfidenceScore * 100).toFixed(0)}%` : 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Warning Section - Only show for pending requests */}
                {activeTab === 'pending' && (
                  <View style={styles.warningCard}>
                    <Text style={styles.warningTitle}>⚠️ Important</Text>
                    <Text style={styles.warningText}>
                      By accepting this guarantee, you agree to repay the guaranteed amount (KES {selectedLoan.guarantorAmount?.toLocaleString('en-KE')}) 
                      if the borrower fails to repay their loan. This will affect your guarantor capacity for future guarantees.
                    </Text>
                  </View>
                )}

                {/* Action Buttons - Only show for pending requests */}
                {activeTab === 'pending' && (
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.declineButton]}
                      onPress={() => declineGuarantee(selectedLoan.id)}
                      disabled={processingId === selectedLoan.id}
                    >
                      {processingId === selectedLoan.id ? (
                        <ActivityIndicator size="small" color="#F44336" />
                      ) : (
                        <Text style={styles.declineButtonText}>❌ Decline</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => acceptGuarantee(selectedLoan.id)}
                      disabled={processingId === selectedLoan.id}
                    >
                      {processingId === selectedLoan.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.acceptButtonText}>✅ Accept Guarantee</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },
  scrollContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F5E9' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#388E3C' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 30, height: 30, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 20, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#1B5E20' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dashboardButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  dashboardButtonText: { color: '#388E3C', fontWeight: 'bold' },

  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#388E3C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },

  contentContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },

  memberCard: {
    backgroundColor: '#2196F3',
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  memberName: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  memberInfo: { fontSize: 13, color: '#E3F2FD', lineHeight: 18 },

  listContainer: { paddingBottom: 16 },

  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  borrowerInfo: { flex: 1 },
  borrowerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  borrowerEmail: { fontSize: 12, color: '#666', marginTop: 2 },
  mlBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  mlBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#1976D2' },

  cardDetails: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', marginBottom: 8, flexWrap: 'wrap' },
  detailLabel: { width: '40%', fontSize: 13, color: '#666' },
  detailValue: { width: '60%', fontSize: 13, color: '#333', fontWeight: '500' },
  guaranteeAmount: { color: '#4CAF50', fontWeight: 'bold' },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 11, fontWeight: 'bold' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  requestDate: { fontSize: 11, color: '#999' },
  viewButton: { paddingHorizontal: 12, paddingVertical: 6 },
  viewButtonText: { color: '#2196F3', fontSize: 12, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: 'bold' },

  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },

  infoCard: {
    backgroundColor: '#E3F2FD',
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
  },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1976D2', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#424242', lineHeight: 20 },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 10, width: '90%', maxHeight: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center' },
  closeXButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  closeXText: { fontSize: 18, fontWeight: 'bold', color: '#666' },
  modalScrollView: { maxHeight: '90%' },

  sectionCard: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#2196F3', paddingLeft: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#333' },
  highlightValue: { color: '#4CAF50', fontWeight: 'bold', fontSize: 16 },

  riskBadgeLarge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, fontSize: 13, fontWeight: 'bold' },

  warningCard: { backgroundColor: '#FFF3E0', padding: 15, borderRadius: 8, marginBottom: 16 },
  warningTitle: { fontSize: 16, fontWeight: 'bold', color: '#E65100', marginBottom: 8 },
  warningText: { fontSize: 13, color: '#666', lineHeight: 18 },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8, marginBottom: 8 },
  actionButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  acceptButton: { backgroundColor: '#4CAF50' },
  acceptButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  declineButton: { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#F44336' },
  declineButtonText: { color: '#F44336', fontWeight: 'bold', fontSize: 16 },
});
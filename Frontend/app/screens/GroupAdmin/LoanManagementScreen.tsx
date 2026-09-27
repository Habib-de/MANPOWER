import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://172.20.10.2:8080/api';
const { width: screenWidth } = Dimensions.get('window');

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
  group?: Group;
  phoneNumber?: string;
  password?: string;
  joinDate?: string;
  createdBy?: string;
  modifiedBy?: string;
  createdOn?: string;
  modifiedOn?: string;
  mansoftTenantId?: string;
}

interface Group {
  id: string;
  groupName: string;
  members: Member[];
  description?: string;
  creationDate?: string;
  createdBy?: string;
  modifiedBy?: string;
  createdOn?: string;
  modifiedOn?: string;
  mansoftTenantId?: string;
  status?: string;
}

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
}

interface Loan {
  id: string;
  member: Member;
  amount: number;
  outstandingBalance: number;
  totalPaid: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  createdOn: string;
  dueDate: string; 
  reason: string;
  interestRate: number;
  // ML Integration Fields
  mlDecisionLogId?: number;
  mlApprovedAmount?: number;
  mlRiskLevel?: string;
  mlConfidenceScore?: number;
  mlRecommendation?: string;
  isMlApproved?: boolean;
  mlDecisionReasoning?: string;
}

interface MLAnalytics {
  totalDecisions: number;
  decisionsByType: { [key: string]: number };
  unusedDecisions: number;
  riskDistribution: { [key: string]: number };
  mlApprovedLoans: number;
  traditionalLoans: number;
}

// Add this after your interfaces, before the component starts
const checkOverdueLoans = (loans: Loan[]): Loan[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const updatedLoans = loans.map(loan => {
    // Only check APPROVED or ACTIVE loans
    if (!['APPROVED', 'ACTIVE'].includes(loan.status)) {
      return loan;
    }

    const dueDate = new Date(loan.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      console.log(`🔴 Loan ${loan.id} marked as OVERDUE in UI (Group Admin)`);
      // Return the loan with updated status (local only)
      return {
        ...loan,
        status: 'OVERDUE' as Loan['status']
      };
    }
    
    return loan;
  });
  
  return updatedLoans;
};

export default function LoanManagementScreen() {
  const router = useRouter();
  const { userRole } = useContext(AuthContext)!;

  const [loadingHistorical, setLoadingHistorical] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [historicalLoans, setHistoricalLoans] = useState<Loan[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [groupAdminId, setGroupAdminId] = useState<string | null>(null);
  const [groupAdminDetails, setGroupAdminDetails] = useState<Member | null>(null);
  const [mlAnalytics, setMlAnalytics] = useState<MLAnalytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isContributionsModalVisible, setIsContributionsModalVisible] = useState(false);
  const [selectedMemberName, setSelectedMemberName] = useState('');
  const [selectedMemberContributions, setSelectedMemberContributions] = useState<Contribution[]>([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);

  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [loanToPay, setLoanToPay] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  const [isLoanHistoryModalVisible, setIsLoanHistoryModalVisible] = useState(false);
  const [selectedMemberLoanHistory, setSelectedMemberLoanHistory] = useState<Loan[]>([]);
  const [loanHistoryLoading, setLoanHistoryLoading] = useState(false);

  const [isMLAnalyticsModalVisible, setIsMLAnalyticsModalVisible] = useState(false);
  const [isMLReasoningModalVisible, setIsMLReasoningModalVisible] = useState(false);
  const [selectedLoanReasoning, setSelectedLoanReasoning] = useState<string>('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED' | 'PAID'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AI' | 'TRADITIONAL'>('ALL');

  // Risk color mapping
  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'VERY_LOW': return '#4CAF50';
      case 'LOW': return '#8BC34A';
      case 'MEDIUM': return '#FFC107';
      case 'HIGH': return '#FF9800';
      case 'VERY_HIGH': return '#F44336';
      default: return '#666';
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (groupAdminId) {
      await fetchLoans(groupAdminId);
    }
    setRefreshing(false);
  }, [groupAdminId]);

  const fetchLoans = useCallback(async (adminId: string) => {
    try {
      const groupRes = await fetch(`${BASE_URL}/groups/groupadmin/${adminId}`);
      if (!groupRes.ok) {
        throw new Error('Failed to fetch groups for admin.');
      }
      const groupsData: Group[] = await groupRes.json();
      const allMemberIds = groupsData.flatMap(group => group.members?.map(member => member.id) || []);

      const loanRes = await fetch(`${BASE_URL}/loans`);
      if (!loanRes.ok) {
        throw new Error('Failed to fetch all loans.');
      }
      const allLoansData: Loan[] = await loanRes.json();

      const filteredLoans = allLoansData.filter(loan => allMemberIds.includes(loan.member?.id));

      // ✅ Check for overdue loans
const overdueCheckedLoans = checkOverdueLoans(filteredLoans);

      // Remove pending loans and set all as historical
      const sortedLoans = overdueCheckedLoans.sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());
      setHistoricalLoans(sortedLoans);
      setAllLoans(sortedLoans);

      // Calculate analytics immediately after setting loans
      calculateGroupMLAnalytics(sortedLoans);

    } catch (err: any) {
      console.error('Error fetching loans:', err);
      setError('Could not load loan data. Please try again.');
      Alert.alert('Error', 'Failed to load loan data.');
    } finally {
      setLoadingHistorical(false);
    }
  }, []);

  // NEW: Calculate ML Analytics from group admin's loans only
  const calculateGroupMLAnalytics = (loans: Loan[]): MLAnalytics => {
    const mlLoans = loans.filter(loan => loan.isMlApproved);
    const traditionalLoans = loans.filter(loan => !loan.isMlApproved);
    
    // Calculate risk distribution from ML loans
    const riskDistribution: { [key: string]: number } = {};
    mlLoans.forEach(loan => {
      if (loan.mlRiskLevel) {
        riskDistribution[loan.mlRiskLevel] = (riskDistribution[loan.mlRiskLevel] || 0) + 1;
      }
    });

    // Calculate decision types from ML loans
    const decisionsByType: { [key: string]: number } = {};
    mlLoans.forEach(loan => {
      if (loan.mlRecommendation) {
        decisionsByType[loan.mlRecommendation] = (decisionsByType[loan.mlRecommendation] || 0) + 1;
      }
    });

    const analytics = {
      totalDecisions: mlLoans.length,
      decisionsByType,
      unusedDecisions: 0, // This would require LoanDecisionLog data
      riskDistribution,
      mlApprovedLoans: mlLoans.length,
      traditionalLoans: traditionalLoans.length
    };

    setMlAnalytics(analytics);
    return analytics;
  };

  const fetchMLAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      // Calculate analytics from current group's loans
      const groupAnalytics = calculateGroupMLAnalytics(allLoans);
      setMlAnalytics(groupAnalytics);
    } catch (err) {
      console.error('Error calculating ML analytics:', err);
      // Set safe defaults on error
      setMlAnalytics({
        totalDecisions: 0,
        decisionsByType: {},
        unusedDecisions: 0,
        riskDistribution: {},
        mlApprovedLoans: 0,
        traditionalLoans: 0
      });
    } finally {
      setLoadingAnalytics(false);
    }
  }, [allLoans]);

  const fetchAdminDetails = async (adminId: string) => {
    try {
      const adminRes = await fetch(`${BASE_URL}/members/${adminId}`);
      if (!adminRes.ok) {
        throw new Error('Failed to fetch admin details.');
      }
      const adminData: Member = await adminRes.json();
      setGroupAdminDetails(adminData);
    } catch (err) {
      console.error('Error fetching admin details:', err);
      Alert.alert('Error', 'Could not fetch admin details.');
    }
  };

  const fetchMemberContributions = async (memberId: string, memberName: string) => {
    setContributionsLoading(true);
    setSelectedMemberName(memberName);
    try {
      const res = await fetch(`${BASE_URL}/contributions/member/${memberId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch member contributions.');
      }
      const contributionsData: Contribution[] = await res.json();
      setSelectedMemberContributions(contributionsData);
      setIsContributionsModalVisible(true);
    } catch (err) {
      console.error('Error fetching member contributions:', err);
      Alert.alert('Error', 'Could not fetch member contributions.');
    } finally {
      setContributionsLoading(false);
    }
  };

  const fetchMemberLoanHistory = (memberId: string, memberName: string) => {
    setSelectedMemberName(memberName);
    setLoanHistoryLoading(true);
    try {
      const memberLoanHistory = allLoans.filter(loan => loan.member.id === memberId)
        .sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());
      setSelectedMemberLoanHistory(memberLoanHistory);
      setIsLoanHistoryModalVisible(true);
    } catch (err) {
      console.error('Error fetching member loan history:', err);
      Alert.alert('Error', 'Could not fetch member loan history.');
    } finally {
      setLoanHistoryLoading(false);
    }
  };

  useEffect(() => {
    const getAdminIdAndFetch = async () => {
      setLoadingHistorical(true);
      const adminId = await AsyncStorage.getItem('userId');
      if (adminId) {
        setGroupAdminId(adminId);
        await Promise.all([
          fetchLoans(adminId),
          fetchAdminDetails(adminId)
        ]);
      } else {
        Alert.alert('Error', 'Group Admin ID not found. Please log in again.');
        router.replace('/(auth)');
      }
    };
    getAdminIdAndFetch();
  }, []);

  // Add this useEffect to recalculate analytics when loans change
  useEffect(() => {
    if (allLoans.length > 0 && !loadingHistorical) {
      console.log('Recalculating analytics for', allLoans.length, 'loans');
      fetchMLAnalytics();
    }
  }, [allLoans, loadingHistorical, fetchMLAnalytics]);

  const handleOpenPayModal = (loan: Loan) => {
    setLoanToPay(loan);
    setPaymentAmount('');
    setIsPayModalVisible(true);
  };

  const handleRecordPayment = async () => {
    if (!loanToPay) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount.');
      return;
    }

    if (amount > loanToPay.outstandingBalance) {
      Alert.alert('Error', 'Payment amount cannot exceed the outstanding balance.');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/loans/${loanToPay.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentAmount: amount }),
      });

      if (res.ok) {
        const updatedLoan = await res.json();
        Alert.alert('Success', `Payment of KES ${amount.toLocaleString()} recorded successfully.`);
        setIsPayModalVisible(false);
        setLoanToPay(null);

        setHistoricalLoans(prevLoans =>
          prevLoans.map(loan =>
            loan.id === updatedLoan.id ? updatedLoan : loan
          )
        );
        setAllLoans(prevLoans =>
          prevLoans.map(loan =>
            loan.id === updatedLoan.id ? updatedLoan : loan
          )
        );
        
        // Analytics will be recalculated automatically by the useEffect
      } else {
        const errorText = await res.text();
        throw new Error(`Failed to record payment: ${errorText}`);
      }
    } catch (err: any) {
      console.error('Error recording payment:', err);
      Alert.alert('Error', err.message || 'Failed to record payment. Please try again.');
    }
  };

  // Filter loans based on current filters
  const getFilteredLoans = () => {
    let filtered = historicalLoans;

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(loan => loan.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'ALL') {
      if (typeFilter === 'AI') {
        filtered = filtered.filter(loan => loan.isMlApproved);
      } else {
        filtered = filtered.filter(loan => !loan.isMlApproved);
      }
    }

    return filtered;
  };

  // Show ML Reasoning
  const showMLReasoning = (loan: Loan) => {
    if (loan.mlDecisionReasoning) {
      setSelectedLoanReasoning(loan.mlDecisionReasoning);
      setIsMLReasoningModalVisible(true);
    } else {
      Alert.alert('AI Reasoning', 'No AI reasoning available for this loan.');
    }
  };

  // Enhanced AI Badge with reasoning button
  const renderAIBadge = (loan: Loan) => {
    if (!loan.isMlApproved) return null;

    return (
      <View style={styles.aiBadgeContainer}>
        <View style={[styles.aiBadge, { backgroundColor: getRiskColor(loan.mlRiskLevel || '') + '20' }]}>
          <Text style={[styles.aiBadgeText, { color: getRiskColor(loan.mlRiskLevel || '') }]}>
            🤖 {loan.mlRiskLevel || 'AI'} • {((loan.mlConfidenceScore || 0) * 100).toFixed(0)}%
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.reasoningIconButton}
          onPress={() => showMLReasoning(loan)}
        >
          <Text style={styles.reasoningIconText}>💡</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Enhanced Professional Analytics Card
  const renderMLAnalyticsCard = () => {
    const analytics: MLAnalytics = mlAnalytics ?? {
      totalDecisions: 0,
      decisionsByType: {} as Record<string, number>,
      unusedDecisions: 0,
      riskDistribution: {},
      mlApprovedLoans: 0,
      traditionalLoans: 0,
    } as MLAnalytics;

    return (
      <TouchableOpacity 
        style={styles.analyticsCard}
        onPress={() => setIsMLAnalyticsModalVisible(true)}
      >
        <View style={styles.analyticsHeader}>
          <Text style={styles.analyticsTitle}>🤖 AI Analytics Dashboard</Text>
          <Text style={styles.analyticsSubtitle}>Group-Specific ML Performance</Text>
        </View>
        
        <View style={styles.analyticsGrid}>
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsNumber}>{analytics.totalDecisions}</Text>
            <Text style={styles.analyticsLabel}>AI Decisions</Text>
          </View>
          
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsNumber}>{analytics.mlApprovedLoans}</Text>
            <Text style={styles.analyticsLabel}>AI Loans</Text>
          </View>
          
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsNumber}>
              {analytics.decisionsByType['APPROVE'] || 0}
            </Text>
            <Text style={styles.analyticsLabel}>Approvals</Text>
          </View>

          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsNumber}>
              {Math.round((analytics.mlApprovedLoans / Math.max(analytics.totalDecisions, 1)) * 100)}%
            </Text>
            <Text style={styles.analyticsLabel}>AI Usage</Text>
          </View>
        </View>
        
        <View style={styles.analyticsFooter}>
          <Text style={styles.viewDetailsText}>📊 Tap for detailed insights →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoricalLoanRow = (loan: Loan) => (
    <View key={loan.id} style={styles.tableRow}>
      <View style={[styles.tableCell, { flex: 2 }]}>
        <Text style={styles.memberName}>
          {loan.member?.firstName} {loan.member?.lastName}
        </Text>
        {loan.isMlApproved && (
          <Text style={styles.aiIndicator}>🤖 AI</Text>
        )}
      </View>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>
        KES {loan.amount.toLocaleString()}
      </Text>
      <Text style={[styles.tableCell, { flex: 1 }]}>
        KES {(loan.totalPaid ?? 0).toLocaleString()}
      </Text>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>
        KES {loan.outstandingBalance.toLocaleString()}
      </Text>
      <View style={[styles.tableCell, { flex: 1.5 }]}>
        <Text style={[
          styles.statusText,
          loan.status === 'APPROVED' && styles.statusApproved,
          loan.status === 'REJECTED' && styles.statusRejected,
          loan.status === 'PAID' && styles.statusPaid,
        ]}>
          {loan.status}
        </Text>
        {loan.isMlApproved && loan.mlRiskLevel && (
          <Text style={[styles.riskText, { color: getRiskColor(loan.mlRiskLevel) }]}>
            {loan.mlRiskLevel}
          </Text>
        )}
      </View>
      <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={2}>{loan.reason}</Text>
      <View style={[styles.tableCell, { flex: 1.5, flexDirection: 'row', justifyContent: 'center' }]}>
        {loan.status === 'APPROVED' && (
          <TouchableOpacity
            style={[styles.smallActionButton, styles.payButton, { marginRight: 5 }]}
            onPress={() => handleOpenPayModal(loan)}
          >
            <Text style={styles.smallActionButtonText}>💳 Pay</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.smallActionButton, styles.contributionsButton]}
          onPress={() => fetchMemberLoanHistory(
            loan.member.id,
            `${loan.member.firstName} ${loan.member.lastName}`
          )}
        >
          <Text style={styles.smallActionButtonText}>📋 View</Text>
        </TouchableOpacity>
        {loan.isMlApproved && loan.mlDecisionReasoning && (
          <TouchableOpacity
            style={[styles.smallActionButton, styles.reasoningAction, { marginLeft: 5 }]}
            onPress={() => showMLReasoning(loan)}
          >
            <Text style={styles.smallActionButtonText}>💡</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Render Risk Distribution for Analytics Modal
  const renderRiskDistribution = () => {
    if (!mlAnalytics?.riskDistribution) return null;

    return (
      <View style={styles.riskDistribution}>
        <Text style={styles.riskDistributionTitle}>Risk Distribution</Text>
        <View style={styles.riskBars}>
          {Object.entries(mlAnalytics.riskDistribution).map(([risk, count]) => (
            <View key={risk} style={styles.riskBarContainer}>
              <View style={styles.riskBarLabel}>
                <Text style={[styles.riskLabel, { color: getRiskColor(risk) }]}>
                  {risk.replace('_', ' ')}
                </Text>
                <Text style={styles.riskCount}>{count}</Text>
              </View>
              <View style={styles.riskBarBackground}>
                <View 
                  style={[
                    styles.riskBarFill,
                    { 
                      width: `${(count / Math.max(...Object.values(mlAnalytics.riskDistribution))) * 80}%`,
                      backgroundColor: getRiskColor(risk)
                    }
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Loan Management</Text>
          <Text style={styles.headerSubtitle}>AI-Powered Decision Support</Text>
        </View>
        

        
<TouchableOpacity 
  style={[styles.analyticsButton, { backgroundColor: '#8B5CF6', marginLeft: 8 }]}
  onPress={() => router.push('/(groupadmin)/decision-logs')}
>
  <Text style={styles.analyticsButtonText}>📋 Logs</Text>
</TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.mainContent}>
          

          {/* Loan History Section with Filters */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>📊 Loan Portfolio</Text>
              <Text style={styles.sectionSubtitle}>All processed loans in your group</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{getFilteredLoans().length}</Text>
            </View>
          </View>

          {/* Filter Controls */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === 'ALL' && styles.filterButtonActive]}
                onPress={() => setStatusFilter('ALL')}
              >
                <Text style={[styles.filterButtonText, statusFilter === 'ALL' && styles.filterButtonTextActive]}>
                  All Status
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === 'APPROVED' && styles.filterButtonActive]}
                onPress={() => setStatusFilter('APPROVED')}
              >
                <Text style={[styles.filterButtonText, statusFilter === 'APPROVED' && styles.filterButtonTextActive]}>
                  Approved
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === 'REJECTED' && styles.filterButtonActive]}
                onPress={() => setStatusFilter('REJECTED')}
              >
                <Text style={[styles.filterButtonText, statusFilter === 'REJECTED' && styles.filterButtonTextActive]}>
                  Rejected
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === 'PAID' && styles.filterButtonActive]}
                onPress={() => setStatusFilter('PAID')}
              >
                <Text style={[styles.filterButtonText, statusFilter === 'PAID' && styles.filterButtonTextActive]}>
                  Paid
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, typeFilter === 'AI' && styles.filterButtonActive]}
                onPress={() => setTypeFilter(typeFilter === 'AI' ? 'ALL' : 'AI')}
              >
                <Text style={[styles.filterButtonText, typeFilter === 'AI' && styles.filterButtonTextActive]}>
                  🤖 AI Loans
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, typeFilter === 'TRADITIONAL' && styles.filterButtonActive]}
                onPress={() => setTypeFilter(typeFilter === 'TRADITIONAL' ? 'ALL' : 'TRADITIONAL')}
              >
                <Text style={[styles.filterButtonText, typeFilter === 'TRADITIONAL' && styles.filterButtonTextActive]}>
                  Traditional
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {loadingHistorical ? (
            <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : getFilteredLoans().length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyMessage}>No loans match your filters</Text>
              <Text style={styles.emptySubtext}>Try changing filter criteria</Text>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Member</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Amount</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Paid</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Outstanding</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Status</Text>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Reason</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Actions</Text>
              </View>
              {getFilteredLoans().map(renderHistoricalLoanRow)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ML Reasoning Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isMLReasoningModalVisible}
        onRequestClose={() => setIsMLReasoningModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { width: '95%', maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>🤖 AI Decision Reasoning</Text>
            <ScrollView style={styles.reasoningContent}>
              <Text style={styles.reasoningText}>
                {selectedLoanReasoning || 'No reasoning available.'}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: '#2196F3', marginTop: 15 }]}
              onPress={() => setIsMLReasoningModalVisible(false)}
            >
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* Existing Modals (Contributions, Loan History, Payment) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isContributionsModalVisible}
        onRequestClose={() => setIsContributionsModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>{selectedMemberName}'s Contributions</Text>
            {contributionsLoading ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : selectedMemberContributions.length > 0 ? (
              <ScrollView style={styles.modalContributionsList}>
                {selectedMemberContributions.map((contrib) => (
                  <View key={contrib.id} style={styles.contributionRow}>
                    <View>
                      <Text style={styles.dateText}>
                        {new Date(contrib.transactionDate).toDateString()}
                      </Text>
                      <Text style={styles.paymentText}>
                        Method: {contrib.paymentMethod}
                      </Text>
                    </View>
                    <Text style={styles.amountText}>
                      KES {contrib.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyMessage}>No contributions found for this member.</Text>
            )}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: '#F44336' }]}
              onPress={() => setIsContributionsModalVisible(false)}
            >
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isLoanHistoryModalVisible}
        onRequestClose={() => setIsLoanHistoryModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>{selectedMemberName}'s Loan History</Text>
            {loanHistoryLoading ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : selectedMemberLoanHistory.length > 0 ? (
              <ScrollView style={styles.modalContributionsList}>
                {selectedMemberLoanHistory.map((loan) => (
                  <View key={loan.id} style={styles.contributionRow}>
                    <View>
                      <Text style={styles.dateText}>
                        Date: {new Date(loan.createdOn).toDateString()}
                      </Text>
                      <Text style={styles.paymentText}>
                        Status: {loan.status}
                      </Text>
                      {loan.isMlApproved && (
                        <Text style={styles.aiInfo}>
                          🤖 AI: {loan.mlRiskLevel} • {((loan.mlConfidenceScore || 0) * 100).toFixed(0)}%
                        </Text>
                      )}
                    </View>
                    <Text style={styles.amountText}>
                      KES {loan.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyMessage}>No loan history found for this member.</Text>
            )}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: '#F44336' }]}
              onPress={() => setIsLoanHistoryModalVisible(false)}
            >
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isPayModalVisible}
        onRequestClose={() => setIsPayModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            {loanToPay && (
              <>
                <Text style={styles.modalTitle}>Record Payment</Text>
                <Text style={styles.modalSubtitle}>
                  For {loanToPay.member.firstName} {loanToPay.member.lastName}
                </Text>
                
                <View style={styles.paymentInfo}>
                  <Text style={styles.modalText}>
                    Total Amount: <Text style={styles.modalTextHighlight}>KES {loanToPay.amount.toLocaleString()}</Text>
                  </Text>
                  <Text style={styles.modalText}>
                    Outstanding Balance: <Text style={styles.modalTextHighlight}>KES {loanToPay.outstandingBalance.toLocaleString()}</Text>
                  </Text>
                  {loanToPay.isMlApproved && (
                    <Text style={styles.modalText}>
                      AI Risk: <Text style={[styles.modalTextHighlight, { color: getRiskColor(loanToPay.mlRiskLevel || '') }]}>
                        {loanToPay.mlRiskLevel}
                      </Text>
                    </Text>
                  )}
                </View>
                
                <TextInput
                  style={styles.textInput}
                  onChangeText={setPaymentAmount}
                  value={paymentAmount}
                  placeholder="Enter payment amount"
                  keyboardType="numeric"
                />

                <TouchableOpacity
                  style={[styles.payButton, styles.modalButton]}
                  onPress={handleRecordPayment}
                >
                  <Text style={styles.actionButtonText}>💳 Record Payment</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.closeButton, styles.modalButton]}
                  onPress={() => setIsPayModalVisible(false)}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    paddingRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  analyticsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2196F3',
    borderRadius: 10,
  },
  analyticsButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  mainContent: {
    padding: 20,
  },
  // Analytics Card Styles
  analyticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  analyticsHeader: {
    marginBottom: 15,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  analyticsSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  analyticsItem: {
    alignItems: 'center',
    flex: 1,
  },
  analyticsNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  analyticsFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Analytics Modal Styles
  analyticsModalContent: {
    width: '100%',
  },
  analyticsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  riskDistribution: {
    marginBottom: 20,
  },
  riskDistributionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 10,
  },
  riskBars: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
  },
  riskBarContainer: {
    marginBottom: 12,
  },
  riskBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  riskLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  riskCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  riskBarBackground: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  riskBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  decisionTypes: {
    marginBottom: 20,
  },
  decisionTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  decisionTypeLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  decisionTypeCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  performanceMetrics: {
    marginBottom: 10,
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  metricLabel: {
    fontSize: 14,
    color: '#374151',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  sectionBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Filter Styles
  filterContainer: {
    marginBottom: 15,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  // Loan Card Styles (removed pending loan styles)
  aiBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reasoningIconButton: {
    padding: 6,
    backgroundColor: '#6B7280',
    borderRadius: 8,
  },
  reasoningIconText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginVertical: 10,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
  loader: {
    marginTop: 20,
  },
  // Table Styles
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
    minHeight: 60,
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
  memberName: {
    fontWeight: '500',
    color: '#1E293B',
    fontSize: 12,
  },
  aiIndicator: {
    fontSize: 10,
    color: '#2196F3',
    marginTop: 2,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 11,
  },
  statusApproved: {
    color: '#10B981',
  },
  statusRejected: {
    color: '#EF4444',
  },
  statusPaid: {
    color: '#6B7280',
  },
  riskText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  smallActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  smallActionButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  payButton: {
    backgroundColor: '#2196F3',
  },
  contributionsButton: {
    backgroundColor: '#F59E0B',
  },
  reasoningAction: {
    backgroundColor: '#8B5CF6',
  },
  // Modal Styles
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1E293B',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 15,
    textAlign: 'center',
  },
  paymentInfo: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  modalText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalTextHighlight: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  modalContributionsList: {
    width: '100%',
    marginBottom: 15,
  },
  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  paymentText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  aiInfo: {
    fontSize: 11,
    color: '#2196F3',
    marginTop: 2,
    fontWeight: '500',
  },
  amountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
  },
  closeButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    elevation: 2,
    width: '100%',
    backgroundColor: '#EF4444',
  },
  modalButton: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  textInput: {
    width: '100%',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  reasoningContent: {
    width: '100%',
    maxHeight: 400,
    marginBottom: 15,
  },
  reasoningText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    textAlign: 'left',
  },
  actionButtonText: {
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 'bold',
  textAlign: 'center',
},
});
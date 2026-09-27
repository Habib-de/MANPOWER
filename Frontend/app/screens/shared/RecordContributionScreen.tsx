import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://172.20.10.2:8080/api';

const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
  }
};

type Group = {
  id: string;
  groupName: string;
  expectedContributionAmount?: number;
  contributionFrequency?: string;
  enablePenalty?: boolean;
  penaltyAmount?: number;
  gracePeriodDays?: number;
};

type PendingContribution = {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  isLate: boolean;
  daysLate: number;
  penaltyApplied: number;
  memberId: string;
  memberName: string;
  memberFirstName?: string;
  memberLastName?: string;
};

// Helper function to calculate total due including penalty
const getTotalDueAmount = (contribution: PendingContribution): number => {
  return contribution.amount + (contribution.penaltyApplied || 0);
};

export default function RecordContributionScreen(): React.JSX.Element {
  const router = useRouter();

  const [groupId, setGroupId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [pendingContributions, setPendingContributions] = useState<PendingContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Modal visibility and selected contribution
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<PendingContribution | null>(null);
  
  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [description, setDescription] = useState('');

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const storedGroupId = await AsyncStorage.getItem('userGroupId');
        const storedAdminId = await AsyncStorage.getItem('userId');

        if (storedGroupId && storedAdminId) {
          setGroupId(storedGroupId);
          setAdminId(storedAdminId);
          await fetchGroup(storedGroupId);
          await fetchPendingContributions(storedGroupId);
        } else {
          showAlert('Error', 'User session is invalid. Please log in again.');
        }
      } catch (err) {
        console.error('❌ Failed to load storage:', err);
        showAlert('Error', 'Could not load user or group data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const fetchGroup = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups/${gId}`);
      setGroupData(response.data);
    } catch (err) {
      console.error('❌ Error fetching group:', err);
      showAlert('Error', 'Could not fetch group details.');
    }
  };

  const fetchPendingContributions = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/contributions/group/${gId}`);
      const allContributions = response.data;
      
      const pending = allContributions.filter((c: any) => c.status === 'Pending');
      
      const formattedPending: PendingContribution[] = pending.map((c: any) => ({
        id: c.id,
        amount: c.amount,
        dueDate: c.dueDate,
        status: c.status,
        isLate: c.isLate || false,
        daysLate: c.daysLate || 0,
        penaltyApplied: c.penaltyApplied || 0,
        memberId: c.member?.id,
        memberName: `${c.member?.firstName || ''} ${c.member?.lastName || ''}`,
        memberFirstName: c.member?.firstName,
        memberLastName: c.member?.lastName,
      }));
      
      setPendingContributions(formattedPending);
      
    } catch (err) {
      console.error('❌ Error fetching pending contributions:', err);
      setPendingContributions([]);
    }
  };

  const handleSelectMember = (contribution: PendingContribution) => {
    setSelectedContribution(contribution);
    // ✅ Set total due including penalty
    const totalDue = getTotalDueAmount(contribution);
    setPaymentAmount(totalDue.toString());
    setPaymentDate(getTodayDate());
    setPaymentMethod('M-Pesa');
    setDescription('');
    setModalVisible(true);
  };

  const calculatePenalty = (dueDate: string, paymentDateStr: string, group: Group | null): number => {
    if (!group || !group.enablePenalty) return 0;
    
    const due = new Date(dueDate);
    const paid = new Date(paymentDateStr);
    
    if (paid <= due) return 0;
    
    const daysLate = Math.ceil((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const gracePeriod = group.gracePeriodDays || 3;
    
    if (daysLate <= gracePeriod) return 0;
    
    return group.penaltyAmount || 0;
  };

  const handleSubmit = async () => {
    if (!groupData || !selectedContribution) {
      showAlert('Error', 'Missing information.');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      showAlert('Validation Error', 'Please enter a valid amount');
      return;
    }

    // ✅ Calculate expected total (original amount + existing penalty from DB)
    const expectedTotal = getTotalDueAmount(selectedContribution);
    
    // ✅ Validate that admin entered the correct total amount
    if (amount !== expectedTotal) {
      showAlert(
        'Invalid Amount', 
        `The total amount due for ${selectedContribution.memberName} is KES ${expectedTotal.toLocaleString()}:\n\n` +
        `• Contribution: KES ${selectedContribution.amount.toLocaleString()}\n` +
        `• Penalty: KES ${selectedContribution.penaltyApplied.toLocaleString()}\n\n` +
        `Please enter the exact total amount.`
      );
      return;
    }

    setSubmitting(true);

    try {
      // ✅ Penalty is already in the contribution record from backend
      // We just need to mark it as paid
      const isLate = selectedContribution.isLate || selectedContribution.penaltyApplied > 0;
      const daysLate = selectedContribution.daysLate || 0;
      const penaltyAmount = selectedContribution.penaltyApplied || 0;

      const updatePayload = {
        status: 'Completed',
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        isLate: isLate,
        daysLate: daysLate,
        penaltyApplied: penaltyAmount,
        amount: selectedContribution.amount, // Keep original contribution amount
        totalPaid: amount, // Track the total paid (including penalty)
        description: description,
        modifiedBy: adminId,
      };

      await axios.put(`${API_BASE_URL}/contributions/${selectedContribution.id}`, updatePayload);
      
      showAlert('Success', `Payment of KES ${amount.toLocaleString()} recorded for ${selectedContribution.memberName}!`, () => {
        setModalVisible(false);
        setSelectedContribution(null);
        fetchPendingContributions(groupId);
      });
      
    } catch (err: unknown) {
      console.error('❌ Submission error:', err);
      
      let errorMessage = 'Failed to record contribution.';
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          errorMessage = err.response.data?.message || 'Server error. Please try again.';
        } else if (err.request) {
          errorMessage = 'No response from server. Check your network connection.';
        } else {
          errorMessage = err.message;
        }
      }
      
      showAlert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDueStatus = (dueDate: string): { text: string; isOverdue: boolean } => {
    const today = new Date();
    const due = new Date(dueDate);
    if (due < today) {
      return { text: '⚠️ Overdue', isOverdue: true };
    }
    return { text: '📅 Upcoming', isOverdue: false };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Record Member Contributions</Text>
          
          {groupData && (
            <View style={styles.groupSettingsCard}>
              <Text style={styles.groupSettingsTitle}>📋 Group Contribution Rules</Text>
              <View style={styles.groupSettingsRow}>
                <Text style={styles.groupSettingsLabel}>Expected Amount:</Text>
                <Text style={styles.groupSettingsValue}>KES {groupData.expectedContributionAmount || 'Not set'}</Text>
              </View>
              <View style={styles.groupSettingsRow}>
                <Text style={styles.groupSettingsLabel}>Frequency:</Text>
                <Text style={styles.groupSettingsValue}>{groupData.contributionFrequency || 'Not set'}</Text>
              </View>
              {groupData.enablePenalty && (
                <View style={styles.groupSettingsRow}>
                  <Text style={styles.groupSettingsLabel}>Late Penalty:</Text>
                  <Text style={styles.groupSettingsValue}>KES {groupData.penaltyAmount || 0} (after {groupData.gracePeriodDays || 3} days)</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.subtitle}>
            {pendingContributions.length > 0 
              ? `📝 Pending Contributions (${pendingContributions.length})` 
              : '✅ No pending contributions! All members are up to date.'}
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#2E7D32" />
          ) : pendingContributions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>🎉 All caught up!</Text>
              <Text style={styles.emptySubtext}>No pending contributions to record.</Text>
            </View>
          ) : (
            pendingContributions.map((contribution) => {
              const dueStatus = getDueStatus(contribution.dueDate);
              const totalDue = getTotalDueAmount(contribution);
              const hasPenalty = contribution.penaltyApplied > 0;
              
              return (
                <TouchableOpacity
                  key={contribution.id}
                  style={styles.memberCard}
                  onPress={() => handleSelectMember(contribution)}
                  activeOpacity={0.7}
                >
                  <View style={styles.memberHeader}>
                    <Text style={styles.memberName}>👤 {contribution.memberName}</Text>
                    <View style={[styles.statusBadge, dueStatus.isOverdue && styles.statusBadgeLate]}>
                      <Text style={styles.statusText}>{dueStatus.text}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.dueInfoRow}>
                    <Text style={styles.dueLabel}>Due Date:</Text>
                    <Text style={[styles.dueValue, dueStatus.isOverdue && styles.dueValueLate]}>
                      {formatDate(contribution.dueDate)}
                    </Text>
                  </View>

                  <View style={styles.dueInfoRow}>
                    <Text style={styles.dueLabel}>Expected Amount:</Text>
                    <Text style={styles.dueValue}>KES {contribution.amount.toLocaleString()}</Text>
                  </View>

                  {hasPenalty && (
                    <View style={styles.penaltyInfoRow}>
                      <Text style={styles.penaltyLabel}>⚠️ Penalty:</Text>
                      <Text style={styles.penaltyValue}>+ KES {contribution.penaltyApplied.toLocaleString()}</Text>
                    </View>
                  )}

                  {hasPenalty && (
                    <View style={styles.totalDueRow}>
                      <Text style={styles.totalDueLabel}>💰 Total Due:</Text>
                      <Text style={styles.totalDueValue}>KES {totalDue.toLocaleString()}</Text>
                    </View>
                  )}

                  <View style={styles.tapHint}>
                    <Text style={styles.tapHintText}>👉 Tap to record payment</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          
          <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      {/* Modal Popup for Payment */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💰 Record Payment</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedContribution && (
                <>
                  {/* Member Info */}
                  <View style={styles.modalMemberInfo}>
                    <Text style={styles.modalMemberName}>👤 {selectedContribution.memberName}</Text>
                    
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Due Date:</Text>
                      <Text style={styles.modalInfoValue}>{formatDate(selectedContribution.dueDate)}</Text>
                    </View>
                    
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Contribution Amount:</Text>
                      <Text style={styles.modalInfoValue}>KES {selectedContribution.amount.toLocaleString()}</Text>
                    </View>

                    {selectedContribution.penaltyApplied > 0 && (
                      <>
                        <View style={styles.modalInfoRow}>
                          <Text style={styles.modalInfoLabel}>Late Penalty:</Text>
                          <Text style={[styles.modalInfoValue, styles.penaltyText]}>
                            + KES {selectedContribution.penaltyApplied.toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.modalTotalRow}>
                          <Text style={styles.modalTotalLabel}>💰 Total Due:</Text>
                          <Text style={styles.modalTotalValue}>
                            KES {getTotalDueAmount(selectedContribution).toLocaleString()}
                          </Text>
                        </View>
                      </>
                    )}

                    {selectedContribution.isLate && selectedContribution.penaltyApplied === 0 && (
                      <View style={styles.modalPenaltyWarning}>
                        <Text style={styles.modalPenaltyText}>
                          ⚠️ This contribution is late. Penalty will be applied based on group rules.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Payment Form */}
                  <View style={styles.modalForm}>
                    <Text style={styles.label}>Payment Amount (KES)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter total amount paid"
                      keyboardType="numeric"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                    />
                    {selectedContribution.penaltyApplied > 0 && (
                      <Text style={styles.hintText}>
                        Must pay total amount: KES {getTotalDueAmount(selectedContribution).toLocaleString()}
                      </Text>
                    )}

                    <Text style={styles.label}>Payment Date</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      value={paymentDate}
                      onChangeText={setPaymentDate}
                    />

                    <Text style={styles.label}>Payment Method</Text>
                    <Picker
                      selectedValue={paymentMethod}
                      onValueChange={setPaymentMethod}
                      style={styles.picker}
                    >
                      <Picker.Item label="M-Pesa" value="M-Pesa" />
                      <Picker.Item label="Bank Transfer" value="Bank" />
                      <Picker.Item label="Cash" value="Cash" />
                      <Picker.Item label="Cheque" value="Cheque" />
                    </Picker>

                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Description / Receipt Number (optional)"
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            {/* FAB inside Modal */}
            <TouchableOpacity
              style={[styles.modalFab, submitting && styles.modalFabDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.modalFabIcon}>💰</Text>
                  <Text style={styles.modalFabText}>Record Payment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GroupAdminBottomNav current="record-contributions" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
    zIndex: 10,
  },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  scrollContainer: { 
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: { 
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1733a5ff', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  
  groupSettingsCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  groupSettingsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 10,
  },
  groupSettingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  groupSettingsLabel: {
    fontSize: 13,
    color: '#555',
  },
  groupSettingsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  
  memberCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 8,
  },
  memberName: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    color: '#333',
  },
  statusBadge: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeLate: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  dueInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dueLabel: {
    fontSize: 13,
    color: '#666',
  },
  dueValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  dueValueLate: {
    color: '#F44336',
  },
  penaltyInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#FFEBEE',
  },
  penaltyLabel: {
    fontSize: 13,
    color: '#F44336',
    fontWeight: '500',
  },
  penaltyValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F44336',
  },
  totalDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalDueLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  totalDueValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  tapHint: {
    marginTop: 8,
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  modalMemberInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  modalMemberName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  penaltyText: {
    color: '#F44336',
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  modalTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  modalPenaltyWarning: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  modalPenaltyText: {
    fontSize: 12,
    color: '#E65100',
  },
  modalForm: {
    marginBottom: 80,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  picker: { 
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginTop: 5,
  },
  hintText: {
    fontSize: 11,
    color: '#F44336',
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // FAB inside Modal
  modalFab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalFabDisabled: {
    backgroundColor: '#ccc',
  },
  modalFabIcon: {
    fontSize: 18,
    color: '#fff',
    marginRight: 8,
  },
  modalFabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
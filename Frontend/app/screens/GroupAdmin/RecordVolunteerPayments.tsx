import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://172.20.10.2:8080/api';

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
  }
};

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  status: string;
}

interface Campaign {
  id: string;
  campaignName: string;
  description: string;
  targetAmount: number | null;
  raisedAmount: number;
  progress: number;
  startDate: string;
  endDate: string;
  status: string;
}

export default function RecordVolunteerPaymentScreen() {
  const params = useLocalSearchParams<{ campaignId?: string; campaignName?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [userId, setUserId] = useState('');
  
  // Campaign data
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [campaignId, setCampaignId] = useState(params.campaignId || '');
  const [campaignName, setCampaignName] = useState(params.campaignName || '');
  
  // Members list
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  
  // Form fields
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected member details
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Confirmation Modal state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    amount: number;
    memberName: string;
    campaignName: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      const group = await AsyncStorage.getItem('userGroupId');
      
      setUserId(id || '');
      
      if (!group && id) {
        const groupsResponse = await fetch(`${BASE_URL}/groups/groupadmin/${id}`);
        if (groupsResponse.ok) {
          const groups = await groupsResponse.json();
          if (groups && groups.length > 0) {
            const firstGroupId = groups[0].id;
            setGroupId(firstGroupId);
            await AsyncStorage.setItem('userGroupId', firstGroupId);
          } else {
            showAlert('Error', 'No groups found for this admin');
            setLoading(false);
            return;
          }
        }
      } else if (group) {
        setGroupId(group);
      }
      
      const currentGroupId = groupId || group || '';
      if (currentGroupId) {
        await Promise.all([
          fetchCampaignDetails(),
          fetchMembers(currentGroupId)
        ]);
      } else {
        showAlert('Error', 'No group found. Please contact support.');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignDetails = async () => {
    if (!campaignId) return;
    
    try {
      const response = await fetch(`${BASE_URL}/volunteer-campaigns/${campaignId}`);
      
      if (!response.ok) {
        console.error('Failed to fetch campaign:', response.status);
        return;
      }
      
      const data = await response.json();
      
      // Fetch contributions to calculate accurate raised amount
      try {
        const contributionsResponse = await fetch(
          `${BASE_URL}/volunteer-contributions/campaign/${campaignId}`
        );
        
        if (contributionsResponse.ok) {
          const contributions = await contributionsResponse.json();
          const totalRaised = contributions.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
          
          data.raisedAmount = totalRaised;
          
          if (data.targetAmount && data.targetAmount > 0) {
            data.progress = (totalRaised / data.targetAmount) * 100;
          } else {
            data.progress = 0;
          }
        }
      } catch (error) {
        console.error('Error fetching contributions:', error);
      }
      
      setCampaign(data);
      setCampaignName(data.campaignName);
      
    } catch (error) {
      console.error('Error fetching campaign:', error);
    }
  };

  const fetchMembers = async (gId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/members/by-group/${gId}`);
      if (response.ok) {
        const data = await response.json();
        const activeMembers = data.filter((m: any) => m.status === 'Active');
        setMembers(activeMembers);
        setFilteredMembers(activeMembers);
      } else {
        showAlert('Error', 'Failed to load members');
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      showAlert('Error', 'Failed to load members');
    }
  };

  const handleSearchMembers = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter(m => 
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
        m.email?.toLowerCase().includes(query.toLowerCase()) ||
        m.phoneNumber?.includes(query)
      );
      setFilteredMembers(filtered);
    }
  };

  const selectMember = (member: Member) => {
    setSelectedMember(member);
    setSelectedMemberId(member.id);
    setSearchQuery('');
    setFilteredMembers(members);
  };

  const handleRecordPayment = () => {
    if (!selectedMemberId) {
      showAlert('Validation', 'Please select a member');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('Validation', 'Please enter a valid amount');
      return;
    }

    if (!campaignId) {
      showAlert('Error', 'Campaign information is missing');
      return;
    }

    setConfirmData({
      amount: amount,
      memberName: `${selectedMember?.firstName} ${selectedMember?.lastName}`,
      campaignName: campaignName
    });
    setConfirmModalVisible(true);
  };

  const performPayment = async () => {
    setSubmitting(true);

    try {
      const formData = new URLSearchParams();
      formData.append('campaignId', campaignId);
      formData.append('memberId', selectedMemberId);
      formData.append('amount', paymentAmount);
      if (paymentDescription.trim()) {
        formData.append('description', paymentDescription.trim());
      }

      const url = `${BASE_URL}/volunteer-contributions/cash?${formData.toString()}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'userId': userId,
          'groupId': groupId,
          'tenantId': 'default',
        },
      });

      const data = await response.json();

      if (response.ok) {
        showAlert(
          'Success', 
          `✅ Payment of KES ${parseFloat(paymentAmount).toLocaleString()} recorded for ${selectedMember?.firstName} ${selectedMember?.lastName}!`,
          () => {
            setSelectedMember(null);
            setSelectedMemberId('');
            setPaymentAmount('');
            setPaymentDescription('');
            fetchCampaignDetails();
          }
        );
      } else {
        showAlert('Error', typeof data === 'string' ? data : 'Failed to record payment');
      }
    } catch (error: any) {
      console.error('Error recording payment:', error);
      showAlert('Error', error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const currentGroupId = groupId || (await AsyncStorage.getItem('userGroupId')) || '';
    if (currentGroupId) {
      await Promise.all([
        fetchCampaignDetails(),
        fetchMembers(currentGroupId)
      ]);
    }
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
            <Text style={styles.logoText}>
              MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backToHome}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backToHome}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {campaign && (
          <View style={styles.campaignCard}>
            <Text style={styles.campaignTitle}>📋 Campaign</Text>
            <Text style={styles.campaignName}>{campaign.campaignName}</Text>
            <Text style={styles.campaignDescription} numberOfLines={2}>
              {campaign.description || 'No description'}
            </Text>
            
            <View style={styles.campaignStats}>
              <View style={styles.campaignStat}>
                <Text style={styles.campaignStatLabel}>Raised</Text>
                <Text style={styles.campaignStatValue}>
                  KES {campaign.raisedAmount?.toLocaleString() || 0}
                </Text>
              </View>
              <View style={styles.campaignStatDivider} />
              <View style={styles.campaignStat}>
                <Text style={styles.campaignStatLabel}>Target</Text>
                <Text style={styles.campaignStatValue}>
                  {campaign.targetAmount ? `KES ${campaign.targetAmount.toLocaleString()}` : 'No target'}
                </Text>
              </View>
              <View style={styles.campaignStatDivider} />
              <View style={styles.campaignStat}>
                <Text style={styles.campaignStatLabel}>Progress</Text>
                <Text style={styles.campaignStatValue}>
                  {campaign.progress?.toFixed(1) || 0}%
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>💰 Record Cash Payment</Text>
          
          <Text style={styles.instructionText}>
            Search for a member and record their cash contribution to this campaign
          </Text>

          <View style={styles.searchContainer}>
            <Text style={styles.label}>Select Member *</Text>
            
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, email, or phone..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearchMembers}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearchMembers('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {selectedMember && (
              <View style={styles.selectedMemberCard}>
                <View style={styles.selectedMemberInfo}>
                  <View style={styles.selectedMemberAvatar}>
                    <Text style={styles.selectedMemberAvatarText}>
                      {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                    </Text>
                  </View>
                  <View style={styles.selectedMemberDetails}>
                    <Text style={styles.selectedMemberName}>
                      {selectedMember.firstName} {selectedMember.lastName}
                    </Text>
                    {selectedMember.email && (
                      <Text style={styles.selectedMemberEmail}>{selectedMember.email}</Text>
                    )}
                    {selectedMember.phoneNumber && (
                      <Text style={styles.selectedMemberPhone}>{selectedMember.phoneNumber}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => {
                    setSelectedMember(null);
                    setSelectedMemberId('');
                  }}>
                    <Ionicons name="close-circle" size={24} color="#F44336" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {searchQuery.length > 0 && filteredMembers.length > 0 && !selectedMember && (
              <View style={styles.memberListContainer}>
                <ScrollView style={styles.memberList} nestedScrollEnabled>
                  {filteredMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.memberItem}
                      onPress={() => selectMember(member)}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {member.firstName[0]}{member.lastName[0]}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
                        {member.email && (
                          <Text style={styles.memberEmail}>{member.email}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {searchQuery.length > 0 && filteredMembers.length === 0 && !selectedMember && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No members found</Text>
              </View>
            )}
          </View>

          <Text style={styles.label}>Payment Amount (KES) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            placeholderTextColor="#999"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Cash payment received"
            placeholderTextColor="#999"
            value={paymentDescription}
            onChangeText={setPaymentDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedMemberId || !paymentAmount || submitting) && styles.disabledButton
            ]}
            onPress={handleRecordPayment}
            disabled={!selectedMemberId || !paymentAmount || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cash-outline" size={24} color="#fff" style={styles.submitIcon} />
                <Text style={styles.submitButtonText}>
                  Record Payment {paymentAmount ? `(KES ${parseFloat(paymentAmount).toLocaleString()})` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setSelectedMember(null);
              setSelectedMemberId('');
              setPaymentAmount('');
              setPaymentDescription('');
              setSearchQuery('');
            }}
          >
            <Ionicons name="refresh-outline" size={20} color="#2196F3" />
            <Text style={styles.quickActionText}>Reset Form</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={20} color="#666" />
            <Text style={styles.quickActionText}>Back to Campaigns</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={confirmModalVisible}
        onRequestClose={() => {
          setConfirmModalVisible(false);
          setConfirmData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle-outline" size={50} color="#4CAF50" />
              <Text style={styles.modalTitle}>Confirm Payment</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Record payment of{' '}
                <Text style={styles.modalAmount}>
                  KES {confirmData?.amount?.toLocaleString() || 0}
                </Text>{' '}
                for{' '}
                <Text style={styles.modalMember}>
                  {confirmData?.memberName || ''}
                </Text>
                ?
              </Text>
              <Text style={styles.modalCampaign}>
                Campaign: {confirmData?.campaignName || ''}
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  setConfirmData(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  performPayment();
                }}
              >
                <Ionicons name="cash-outline" size={20} color="#fff" />
                <Text style={styles.modalConfirmButtonText}>Record Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <GroupAdminBottomNav current="none" />
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
  },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  container: {
    padding: 16,
    paddingBottom: 100,
  },
  campaignCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  campaignTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  campaignName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  campaignDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  campaignStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  campaignStat: {
    alignItems: 'center',
    flex: 1,
  },
  campaignStatLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  campaignStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  campaignStatDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 16,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    fontSize: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  selectedMemberCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMemberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedMemberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedMemberDetails: {
    flex: 1,
  },
  selectedMemberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedMemberEmail: {
    fontSize: 12,
    color: '#666',
  },
  selectedMemberPhone: {
    fontSize: 12,
    color: '#666',
  },
  memberListContainer: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 10,
  },
  memberList: {
    maxHeight: 200,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  memberEmail: {
    fontSize: 12,
    color: '#666',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderColor: '#ddd',
    borderWidth: 1,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  disabledButton: {
    backgroundColor: '#81C784',
  },
  submitIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 16,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
  },
  quickActionText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalAmount: {
    fontWeight: 'bold',
    color: '#4CAF50',
    fontSize: 18,
  },
  modalMember: {
    fontWeight: 'bold',
    color: '#1565C0',
  },
  modalCampaign: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  modalConfirmButton: {
    backgroundColor: '#4CAF50',
  },
  modalConfirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});
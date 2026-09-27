// File: MyContributionsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://172.20.10.2:8080/api';

interface Contribution {
  id: string;
  transactionDate: string;
  dueDate?: string;
  paymentDate?: string;
  amount: number;
  transactionType: string;
  paymentMethod: string;
  status: string;
  description: string;
  isLate?: boolean;
  daysLate?: number;
  penaltyApplied?: number;
}

interface PendingContribution {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  isLate: boolean;
  daysLate: number;
  penaltyApplied: number;
  memberId: string;
  memberName?: string;
}

interface Member {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface GroupSettings {
  contributionFrequency: 'WEEKLY' | 'MONTHLY';
  expectedContributionAmount: number;
  nextContributionDate?: string;
  contributionDueDay?: number;
  enablePenalty?: boolean;
  penaltyAmount?: number;
  gracePeriodDays?: number;
}

type TransactionType = 
  | 'Contribution'
  | 'Expense' 
  | 'Loan_Payment' 
  | 'Monthly' 
  | 'volunteer';

interface VolunteerCampaign {
  id: string;
  campaignName: string;
  description: string;
  targetAmount: number | null;
  raisedAmount: number;
  progress: number;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isOpen: boolean;
}

export default function MyContributionsScreen() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [filterType, setFilterType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string>('');
  const [reminderType, setReminderType] = useState<'none' | 'warning' | 'urgent' | 'critical'>('none');
  const [lastContributionDate, setLastContributionDate] = useState<string>('');
  const [lastContributionAmount, setLastContributionAmount] = useState<number>(0);
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>('Contribution');
  const [pendingContributions, setPendingContributions] = useState<Contribution[]>([]);
  const [totalPendingAmount, setTotalPendingAmount] = useState<number>(0);
  const [totalPenalties, setTotalPenalties] = useState<number>(0);

  // New states for pending contribution selection
  const [userPendingContributions, setUserPendingContributions] = useState<PendingContribution[]>([]);
  const [selectedPendingContribution, setSelectedPendingContribution] = useState<PendingContribution | null>(null);
  const [showPendingSelector, setShowPendingSelector] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);

  // Group settings for frequency detection
  const [groupSettings, setGroupSettings] = useState<GroupSettings | null>(null);
  const [groupExpectedAmount, setGroupExpectedAmount] = useState<number>(0);
  const [nextDueDate, setNextDueDate] = useState<string>('');

  const [openCampaigns, setOpenCampaigns] = useState<VolunteerCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<VolunteerCampaign | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [showCampaignSelector, setShowCampaignSelector] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        fetchContributions(userId);
        fetchUserPendingContributions(userId);
        fetchGroupSettings();
      }
    }, [userId, groupId])
  );

  useEffect(() => {
    const loadUser = async () => {
      console.log('Loading user data from AsyncStorage...');
      
      const id = await AsyncStorage.getItem('userId');
      const group = await AsyncStorage.getItem('userGroupId');
      const tenant = await AsyncStorage.getItem('userTenantId');
      
      console.log('Retrieved userId:', id);
      console.log('Retrieved userGroupId:', group);
      console.log('Retrieved userTenantId:', tenant);
      
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('All AsyncStorage keys:', allKeys);
      
      if (!id) {
        router.replace('/(auth)');
      } else {
        setUserId(id);
        setGroupId(group);
        setTenantId(tenant);
        
        if (!group) {
          console.error('⚠️ WARNING: userGroupId is null or undefined!');
          
          const alternativeKeys = ['groupId', 'group', 'userGroup', 'memberGroupId'];
          for (const key of alternativeKeys) {
            const value = await AsyncStorage.getItem(key);
            if (value) {
              console.log(`Found ${key}: ${value}`);
              setGroupId(value);
              await AsyncStorage.setItem('userGroupId', value);
              break;
            }
          }
        }
        
        await fetchMemberData(id);
        if (group) {
          await fetchGroupSettings();
        }
      }
    };
    loadUser();
  }, []);

  const fetchMemberData = async (memberId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/members/${memberId}`);
      if (res.ok) {
        const data: Member = await res.json();
        console.log('Member data:', data);
        setMemberData(data);
        if (data.phoneNumber) {
          setPhoneNumber(data.phoneNumber);
        }
      } else {
        console.error('Failed to fetch member data');
      }
    } catch (err) {
      console.error('Error fetching member data:', err);
    }
  };

  // Add this helper function - put it after fetchMemberData or around line 180
const getTotalDueAmount = (contribution: PendingContribution): number => {
  return contribution.amount + (contribution.penaltyApplied || 0);
};

  // NEW: Fetch group settings to know frequency
  const fetchGroupSettings = async () => {
    if (!groupId) return;
    try {
      const response = await fetch(`${BASE_URL}/groups/${groupId}/settings`, {
        headers: { 'X-User-Id': userId || '' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setGroupSettings(data.settings);
          setGroupExpectedAmount(data.settings.expectedContributionAmount || 0);
        }
      }
      
      // Also fetch group to get nextContributionDate
      const groupRes = await fetch(`${BASE_URL}/groups/${groupId}`);
      if (groupRes.ok) {
        const groupData = await groupRes.json();
        if (groupData.nextContributionDate) {
          const nextDate = new Date(groupData.nextContributionDate);
          const formattedDate = nextDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          setNextDueDate(formattedDate);
        }
      }
    } catch (error) {
      console.error('Error fetching group settings:', error);
    }
  };

  // Fetch user's pending contributions
  const fetchUserPendingContributions = async (memberId: string) => {
    try {
      setLoadingPending(true);
      const res = await fetch(`${BASE_URL}/contributions/member/${memberId}`);
      if (res.ok) {
        const data: Contribution[] = await res.json();
        const pending = data.filter(c => c.status === 'Pending');
        
        const formattedPending: PendingContribution[] = pending.map(c => ({
          id: c.id,
          amount: c.amount,
          dueDate: c.dueDate || c.transactionDate,
          status: c.status,
          isLate: c.isLate || false,
          daysLate: c.daysLate || 0,
          penaltyApplied: c.penaltyApplied || 0,
          memberId: memberId,
        }));
        
        setUserPendingContributions(formattedPending);
      }
    } catch (err) {
      console.error('Error fetching pending contributions:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchOpenCampaigns = async () => {
    if (!groupId) {
      console.log('No group ID, cannot fetch campaigns');
      return;
    }
    
    setLoadingCampaigns(true);
    try {
      const response = await fetch(`${BASE_URL}/volunteer-campaigns/group/${groupId}`);
      if (response.ok) {
        const allCampaigns = await response.json();
        
        const today = new Date().toISOString().split('T')[0];
        const openCampaignsPromises = allCampaigns
          .filter((c: any) => c.status === 'ACTIVE' && c.endDate >= today)
          .map(async (campaign: any) => {
            try {
              const contributionsResponse = await fetch(
                `${BASE_URL}/volunteer-contributions/campaign/${campaign.id}`
              );
              
              let totalRaised = 0;
              if (contributionsResponse.ok) {
                const contributions = await contributionsResponse.json();
                totalRaised = contributions.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
              }
              
              const progress = campaign.targetAmount && campaign.targetAmount > 0
                ? (totalRaised / campaign.targetAmount) * 100
                : 0;
              
              const endDate = new Date(campaign.endDate);
              const currentDate = new Date();
              const daysRemaining = Math.max(0, Math.ceil(
                (endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
              ));
              
              return {
                id: campaign.id,
                campaignName: campaign.campaignName,
                description: campaign.description,
                targetAmount: campaign.targetAmount,
                raisedAmount: totalRaised,
                progress: progress,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                daysRemaining: daysRemaining,
                isOpen: true
              };
            } catch (error) {
              console.error(`Error fetching contributions for campaign ${campaign.id}:`, error);
              return {
                id: campaign.id,
                campaignName: campaign.campaignName,
                description: campaign.description,
                targetAmount: campaign.targetAmount,
                raisedAmount: 0,
                progress: 0,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                daysRemaining: 0,
                isOpen: true
              };
            }
          });
        
        const openCampaigns = await Promise.all(openCampaignsPromises);
        console.log('Open campaigns with correct stats:', openCampaigns);
        setOpenCampaigns(openCampaigns);
      } else {
        console.error('Failed to fetch campaigns');
        setOpenCampaigns([]);
      }
    } catch (error) {
      console.error('Error fetching open campaigns:', error);
      setOpenCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchContributions = async (memberId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/contributions/member/${memberId}`);
      if (res.ok) {
        const data: Contribution[] = await res.json();
        setContributions(data);
        
        const pending = data.filter(c => c.status === 'Pending');
        const completed = data.filter(c => c.status === 'Completed');
        
        setPendingContributions(pending);
        setTotalPendingAmount(pending.reduce((sum, c) => sum + c.amount, 0));
        
        const penalties = completed.reduce((sum, c) => sum + (c.penaltyApplied || 0), 0);
        setTotalPenalties(penalties);
        
        checkContributionStatus(data);
      } else {
        console.error('Failed to fetch contributions');
      }
    } catch (err) {
      console.error('Error fetching contributions:', err);
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Works for BOTH weekly and monthly
  const checkContributionStatus = (contributions: Contribution[]) => {
    const completedContributions = contributions.filter(
      c => c.status === 'Completed'
    );

    if (completedContributions.length === 0) {
      setReminderMessage('You haven\'t made any contributions yet. Please make your first contribution!');
      setReminderType('urgent');
      setLastContributionDate('Never');
      setLastContributionAmount(0);
      return;
    }

    const sortedContributions = [...completedContributions].sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

    const lastContribution = sortedContributions[0];
    const lastContributionDateObj = new Date(lastContribution.transactionDate);
    const currentDate = new Date();

    const formattedDate = lastContributionDateObj.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    setLastContributionDate(formattedDate);
    setLastContributionAmount(lastContribution.amount);

    // First check if there are pending contributions
    const pending = contributions.filter(c => c.status === 'Pending');
    if (pending.length > 0) {
      setReminderMessage(`You have ${pending.length} pending contribution(s) due. Please pay soon!`);
      setReminderType('warning');
      return;
    }

    // Check based on frequency
    const frequency = groupSettings?.contributionFrequency || 'WEEKLY';
    const expectedAmt = groupSettings?.expectedContributionAmount || 500;
    
    // Calculate days since last payment
    const daysSinceLastPayment = Math.floor(
      (currentDate.getTime() - lastContributionDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (frequency === 'WEEKLY') {
      // Weekly logic
      const weeksMissed = Math.floor(daysSinceLastPayment / 7);
      
      if (daysSinceLastPayment >= 7) {
        if (weeksMissed === 1) {
          setReminderMessage(`Reminder: You haven't made your weekly contribution of KES ${expectedAmt} yet.`);
          setReminderType('warning');
        } else if (weeksMissed === 2) {
          setReminderMessage(`Urgent: You haven't contributed for 2 weeks. Please pay KES ${expectedAmt * 2} soon!`);
          setReminderType('urgent');
        } else if (weeksMissed >= 3) {
          setReminderMessage(`Critical: You haven't contributed for ${weeksMissed} weeks! Your account may be suspended.`);
          setReminderType('critical');
        }
      } else if (nextDueDate && daysSinceLastPayment >= 5) {
        // Show upcoming reminder (2-3 days before due)
        setReminderMessage(`Reminder: Your weekly contribution of KES ${expectedAmt} is due soon (${nextDueDate}).`);
        setReminderType('warning');
      } else {
        setReminderMessage('');
        setReminderType('none');
      }
    } else {
      // Monthly logic
      const monthsDiff = 
        (currentDate.getFullYear() - lastContributionDateObj.getFullYear()) * 12 + 
        (currentDate.getMonth() - lastContributionDateObj.getMonth());

      if (monthsDiff === 1) {
        setReminderMessage(`Reminder: You haven't made your monthly contribution of KES ${expectedAmt} yet.`);
        setReminderType('warning');
      } else if (monthsDiff === 2) {
        setReminderMessage(`Urgent: You haven't contributed for 2 months. Please pay KES ${expectedAmt * 2} soon!`);
        setReminderType('urgent');
      } else if (monthsDiff >= 3) {
        setReminderMessage(`Critical: You haven't contributed for ${monthsDiff} months! Your account may be suspended.`);
        setReminderType('critical');
      } else {
        // Check if next due date is approaching
        setReminderMessage('');
        setReminderType('none');
      }
    }
  };

  const totalContributed = contributions
    .filter(c => c.status === 'Completed')
    .reduce((sum, c) => sum + c.amount, 0);
  
  const currentBalance = totalContributed;

  const filteredContributions = contributions.filter((c) => {
    const matchesType = filterType === 'All' || c.transactionType === filterType;
    const matchesSearch =
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.amount.toString().includes(searchQuery) ||
      (c.dueDate && c.dueDate.includes(searchQuery));
    return matchesType && matchesSearch;
  });

  const handleTransactionTypeSelect = (type: TransactionType) => {
    setTransactionType(type);
    setSelectedPendingContribution(null);
    setSelectedCampaign(null);
    
    if (type === 'Contribution') {
      setShowPendingSelector(true);
      setShowCampaignSelector(false);
    } else if (type === 'volunteer') {
      setShowCampaignSelector(true);
      setShowPendingSelector(false);
      fetchOpenCampaigns();
    } else {
      setShowPendingSelector(false);
      setShowCampaignSelector(false);
    }
  };

  const handleSelectPendingContribution = (contribution: PendingContribution) => {
    setSelectedPendingContribution(contribution);
    const totalDue = getTotalDueAmount(contribution);
    setAmount(totalDue.toString());
  };

  const handleMpesaPayment = async () => {
    if (!amount || !userId || !phoneNumber) {
      Alert.alert('Error', 'Please fill in all the required fields');
      return;
    }

    if (!groupId) {
      Alert.alert('Group Information Missing', 'We could not find your group information. Please try logging out and logging back in.');
      return;
    }

    // VALIDATION: For Contribution, check if amount matches the pending contribution amount INCLUDING PENALTY
if (transactionType === 'Contribution') {
  if (!selectedPendingContribution) {
    Alert.alert('Error', 'Please select a pending contribution to pay');
    return;
  }
  
  const enteredAmount = parseFloat(amount);
  const totalDue = getTotalDueAmount(selectedPendingContribution);
  const originalAmount = selectedPendingContribution.amount;
  const penaltyAmount = selectedPendingContribution.penaltyApplied || 0;
  
  if (enteredAmount !== totalDue) {
    Alert.alert(
      'Invalid Amount', 
      `You must pay the full amount of KES ${totalDue.toLocaleString()}:\n\n` +
      `• Contribution: KES ${originalAmount.toLocaleString()}\n` +
      `• Penalty: KES ${penaltyAmount.toLocaleString()}\n\n` +
      `Partial payments are not allowed.`
    );
    return;
  }
}

    if (transactionType === 'volunteer' && !selectedCampaign) {
      Alert.alert('Error', 'Please select a volunteer campaign to contribute to');
      return;
    }

    const phoneRegex = /^(07\d{8}|7\d{8}|\+2547\d{8}|2547\d{8})$/;
    const cleanedPhone = phoneNumber.trim();
    
    if (!phoneRegex.test(cleanedPhone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Kenyan phone number (e.g., 0712345678)');
      return;
    }

    setIsProcessingPayment(true);
    setModalVisible(false);

    try {
      let formattedPhone = cleanedPhone;
      if (cleanedPhone.startsWith('0')) {
        formattedPhone = '254' + cleanedPhone.substring(1);
      }

      let contributionId = `MPESA-${Date.now()}`;
      let transactionTypeForApi = transactionType === 'Contribution' ? 'Contribution' : transactionType;
      
      if (transactionType === 'volunteer' && selectedCampaign) {
        contributionId = `VOL-${selectedCampaign.id.substring(0, 8)}-${Date.now()}`;
      }

      let url = `${BASE_URL}/payments/initiate-contribution?amount=${amount}&transactionType=${transactionTypeForApi}&phone=${formattedPhone}&memberId=${userId}&groupId=${groupId}&contributionId=${contributionId}`;
      
      if (transactionType === 'volunteer' && selectedCampaign) {
        url += `&campaignId=${selectedCampaign.id}`;
        console.log('🎯 Volunteer contribution with campaign:', {
          campaignId: selectedCampaign.id,
          campaignName: selectedCampaign.campaignName,
          amount,
          contributionId
        });
      }
      
      // For Contribution, pass the pending contribution ID
      if (transactionType === 'Contribution' && selectedPendingContribution) {
        url += `&pendingContributionId=${selectedPendingContribution.id}`;
        console.log('🎯 Group contribution for pending:', {
          pendingId: selectedPendingContribution.id,
          amount: selectedPendingContribution.amount
        });
      }

      const response = await fetch(url, { method: 'POST' });
      const result = await response.json();
      
      if (result.status === 200) {
        Alert.alert(
          '✅ STK Push Sent',
          'Check your phone for M-Pesa prompt. Enter PIN to complete payment.'
        );
        setAmount('');
        setSelectedPendingContribution(null);
        setTransactionType('Contribution');
        setSelectedCampaign(null);
        setShowPendingSelector(false);
        setShowCampaignSelector(false);
        if (memberData?.phoneNumber) {
          setPhoneNumber(memberData.phoneNumber);
        }
        setTimeout(() => {
          fetchContributions(userId);
          fetchUserPendingContributions(userId);
        }, 5000);
      } else {
        Alert.alert('❌ Failed', result.message || 'Payment initiation failed');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      Alert.alert('Error', err.message || 'Network error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getReminderStyle = (): ViewStyle => {
    switch (reminderType) {
      case 'warning':
        return styles.warningReminder;
      case 'urgent':
        return styles.urgentReminder;
      case 'critical':
        return styles.criticalReminder;
      default:
        return {
          backgroundColor: 'transparent',
          borderLeftWidth: 0,
        };
    }
  };

  const handleOpenContributionModal = () => {
    if (memberData?.phoneNumber && (!phoneNumber || phoneNumber !== memberData.phoneNumber)) {
      setPhoneNumber(memberData.phoneNumber);
    }
    setTransactionType('Contribution');
    setSelectedPendingContribution(null);
    setSelectedCampaign(null);
    setShowPendingSelector(false);
    setShowCampaignSelector(false);
    setAmount('');
    setModalVisible(true);
    // Fetch pending contributions when opening modal
    if (userId) {
      fetchUserPendingContributions(userId);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string, dueDate?: string) => {
    if (status === 'Completed') {
      return { text: '✅ PAID', color: '#4CAF50', bgColor: '#E8F5E9' };
    } else if (status === 'Pending') {
      if (dueDate && new Date(dueDate) < new Date()) {
        return { text: '⚠️ OVERDUE', color: '#F44336', bgColor: '#FFEBEE' };
      }
      return { text: '⏳ PENDING', color: '#FF9800', bgColor: '#FFF3E0' };
    }
    return { text: status, color: '#666', bgColor: '#F5F5F5' };
  };

  if (loading || isProcessingPayment) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>
          {isProcessingPayment ? 'Processing payment...' : 'Loading contributions...'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      {!groupId && (
        <View style={styles.debugWarning}>
          <Text style={styles.debugWarningText}>⚠️ No groupId found. Payments may not work.</Text>
        </View>
      )}

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>My Contributions</Text>

        {/* Next Due Date Info */}
        {nextDueDate && groupExpectedAmount > 0 && (
          <View style={styles.nextDueCard}>
            <Text style={styles.nextDueIcon}>📅</Text>
            <View style={styles.nextDueContent}>
              <Text style={styles.nextDueLabel}>Next Contribution Due:</Text>
              <Text style={styles.nextDueDate}>{nextDueDate}</Text>
              <Text style={styles.nextDueAmount}>KES {groupExpectedAmount.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Pending Contributions Alert */}
        {pendingContributions.length > 0 && (
          <View style={styles.pendingAlert}>
            <Text style={styles.pendingAlertIcon}>⏳</Text>
            <View style={styles.pendingAlertContent}>
              <Text style={styles.pendingAlertTitle}>
                You have {pendingContributions.length} pending contribution(s)
              </Text>
              <Text style={styles.pendingAlertAmount}>
                Total Due: KES {totalPendingAmount.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.pendingAlertButton}
              onPress={handleOpenContributionModal}
            >
              <Text style={styles.pendingAlertButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Penalty Alert */}
        {totalPenalties > 0 && (
          <View style={styles.penaltyAlert}>
            <Text style={styles.penaltyAlertIcon}>⚠️</Text>
            <Text style={styles.penaltyAlertText}>
              You have accumulated KES {totalPenalties.toLocaleString()} in late penalties!
            </Text>
          </View>
        )}

        {/* Contribution Reminder */}
        {reminderType !== 'none' && (
          <View style={[styles.reminderContainer, getReminderStyle()]}>
            <Text style={styles.reminderIcon}>
              {reminderType === 'warning' ? '⚠️' : 
               reminderType === 'urgent' ? '🚨' : 
               '🔴'}
            </Text>
            <Text style={styles.reminderText}>{reminderMessage}</Text>
            <TouchableOpacity 
              style={styles.reminderButton}
              onPress={handleOpenContributionModal}
            >
              <Text style={styles.reminderButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Last Contribution 📅</Text>
            <Text style={styles.cardValue}>{lastContributionDate}</Text>
            {lastContributionAmount > 0 && (
              <Text style={styles.cardSubValue}>KES {lastContributionAmount.toLocaleString()}</Text>
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Contributed 💰</Text>
            <Text style={styles.cardValue}>KES {totalContributed.toLocaleString()}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pending ⏳</Text>
            <Text style={[styles.cardValue, styles.pendingValue]}>
              KES {totalPendingAmount.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleOpenContributionModal}
          >
            <Text style={styles.quickActionIcon}>💰</Text>
            <Text style={styles.quickActionTitle}>Contribute</Text>
            <Text style={styles.quickActionSubtitle}>Add funds to your account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(member)/loans')}
          >
            <Text style={styles.quickActionIcon}>💳</Text>
            <Text style={styles.quickActionTitle}>Loans</Text>
            <Text style={styles.quickActionSubtitle}>View and manage your loans</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by Type:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterOptions}>
              {['All', 'Contribution', 'volunteer', 'Loan_Payment', 'Expense'].map((type) => (
                <TouchableOpacity key={type} onPress={() => setFilterType(type)}>
                  <Text
                    style={[
                      styles.filterOption,
                      filterType === type && styles.activeFilter,
                    ]}
                  >
                    {type.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search contributions by amount, date, or description..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {/* Contributions Table */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.columnHeader, { flex: 1.2 }]}>Date</Text>
            <Text style={[styles.columnHeader, { flex: 1 }]}>Amount</Text>
            <Text style={[styles.columnHeader, { flex: 0.8 }]}>Status</Text>
            <Text style={[styles.columnHeader, { flex: 1.2 }]}>Type</Text>
            <Text style={[styles.columnHeader, { flex: 1 }]}>Penalty</Text>
            <Text style={[styles.columnHeader, { flex: 2 }]}>Description</Text>
          </View>

          {filteredContributions.length > 0 ? (
            filteredContributions.map((item) => {
              const statusBadge = getStatusBadge(item.status, item.dueDate);
              const displayType = item.transactionType === 'Contribution' ? 'Contribution' : item.transactionType;
              return (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.2 }]}>
                    {item.status === 'Completed' 
                      ? formatDate(item.paymentDate || item.transactionDate)
                      : formatDate(item.dueDate || item.transactionDate)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>
                    KES {item.amount.toLocaleString()}
                  </Text>
                  <View style={[styles.statusBadgeCell, { flex: 0.8, backgroundColor: statusBadge.bgColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                      {statusBadge.text}
                    </Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: 1.2 }]}>
                    {displayType === 'volunteer' ? '🤝 Volunteer' : displayType}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, color: '#F44336' }]}>
                    {item.penaltyApplied && item.penaltyApplied > 0 ? `KES ${item.penaltyApplied.toLocaleString()}` : '-'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={2}>
                    {item.description || '-'}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No contributions found.</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Contribution Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Make Contribution</Text>

            <TextInput
              placeholder="Enter Amount (KES)"
              value={amount}
              onChangeText={setAmount}
              style={styles.input}
              keyboardType="numeric"
              editable={transactionType !== 'Contribution'}
            />

            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>Contribution Type:</Text>
              <View style={styles.dropdownOptions}>
                {(['Contribution', 'volunteer', 'Expense'] as TransactionType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.dropdownOption,
                      transactionType === type && styles.selectedDropdownOption
                    ]}
                    onPress={() => handleTransactionTypeSelect(type)}
                  >
                    <Text style={[
                      styles.dropdownOptionText,
                      transactionType === type && styles.selectedDropdownOptionText
                    ]}>
                      {type === 'Contribution' ? 'Contribution' : type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pending Contribution Selector */}
            {showPendingSelector && (
              <View style={styles.pendingSelectorContainer}>
                <Text style={styles.dropdownLabel}>Select Pending Contribution:</Text>
                
                {loadingPending ? (
                  <ActivityIndicator size="small" color="#4CAF50" style={styles.pendingLoader} />
                ) : userPendingContributions.length === 0 ? (
                  <View style={styles.noPendingContainer}>
                    <Text style={styles.noPendingText}>No pending contributions found</Text>
                    <Text style={styles.noPendingSubtext}>You are all caught up!</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingScroll}>
                    {userPendingContributions.map((pending) => {
  const isOverdue = pending.isLate || (pending.dueDate && new Date(pending.dueDate) < new Date());
  const totalDue = pending.amount + (pending.penaltyApplied || 0);
  const penaltyAmount = pending.penaltyApplied || 0;
  
  return (
    <TouchableOpacity
      key={pending.id}
      style={[
        styles.pendingCard,
        selectedPendingContribution?.id === pending.id && styles.selectedPendingCard,
        isOverdue && styles.overduePendingCard
      ]}
      onPress={() => handleSelectPendingContribution(pending)}
    >
      <Text style={styles.pendingCardAmount}>
        KES {totalDue.toLocaleString()}
      </Text>
      <Text style={[styles.pendingCardDue, isOverdue && styles.overdueText]}>
        Due: {formatDate(pending.dueDate)}
      </Text>
      {penaltyAmount > 0 && (
        <Text style={styles.pendingCardPenalty}>
          ⚠️ Includes KES {penaltyAmount.toLocaleString()} penalty
        </Text>
      )}
      {selectedPendingContribution?.id === pending.id && (
        <View style={styles.selectedPendingCheck}>
          <Text style={styles.selectedPendingCheckText}>✓ Selected</Text>
        </View>
      )}
    </TouchableOpacity>
  );
})}
                  </ScrollView>
                )}
                {selectedPendingContribution && (
  <View style={styles.amountWarning}>
    <Text style={styles.amountWarningText}>
      ⚠️ You must pay the full amount of KES {(selectedPendingContribution.amount + (selectedPendingContribution.penaltyApplied || 0)).toLocaleString()} 
      (KES {selectedPendingContribution.amount.toLocaleString()} + KES {selectedPendingContribution.penaltyApplied?.toLocaleString() || 0} penalty)
    </Text>
  </View>
)}
              </View>
            )}

            {/* Volunteer Campaign Selector */}
            {showCampaignSelector && (
              <View style={styles.campaignSelectorContainer}>
                <Text style={styles.dropdownLabel}>Select Campaign:</Text>
                
                {loadingCampaigns ? (
                  <ActivityIndicator size="small" color="#4CAF50" style={styles.campaignLoader} />
                ) : openCampaigns.length === 0 ? (
                  <View style={styles.noCampaignsContainer}>
                    <Text style={styles.noCampaignsText}>No open volunteer campaigns available</Text>
                    <Text style={styles.noCampaignsSubtext}>Check back later or contact your group admin</Text>
                  </View>
                ) : (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.campaignScroll}
                  >
                    {openCampaigns.map((campaign) => (
                      <TouchableOpacity
                        key={campaign.id}
                        style={[
                          styles.campaignCard,
                          selectedCampaign?.id === campaign.id && styles.selectedCampaignCard
                        ]}
                        onPress={() => setSelectedCampaign(campaign)}
                      >
                        <Text style={styles.campaignCardTitle}>{campaign.campaignName}</Text>
                        <Text style={styles.campaignCardDescription} numberOfLines={2}>
                          {campaign.description}
                        </Text>
                        <View style={styles.campaignCardProgress}>
                          <View style={styles.campaignCardProgressBar}>
                            <View 
                              style={[
                                styles.campaignCardProgressFill,
                                { width: `${Math.min(campaign.progress, 100)}%` }
                              ]} 
                            />
                          </View>
                          <Text style={styles.campaignCardProgressText}>
                            {campaign.progress < 0.01 
                              ? '< 0.01%' 
                              : campaign.progress.toFixed(1) + '%'}
                          </Text>
                        </View>
                        <View style={styles.campaignCardFooter}>
                          <Text style={styles.campaignCardAmount}>
                            KES {campaign.raisedAmount.toLocaleString()}
                          </Text>
                          <Text style={styles.campaignCardDays}>
                            {campaign.daysRemaining} days left
                          </Text>
                        </View>
                        {selectedCampaign?.id === campaign.id && (
                          <View style={styles.selectedCampaignCheck}>
                            <Text style={styles.selectedCampaignCheckText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <View style={styles.phoneInputContainer}>
              <TextInput
                placeholder="Enter Phone Number (07...)"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={10}
              />
              {memberData?.phoneNumber === phoneNumber && (
                <View style={styles.phoneHint}>
                  <Text style={styles.phoneHintText}>✓ Your registered number</Text>
                </View>
              )}
            </View>

            <Text style={styles.phoneNote}>
              {memberData?.phoneNumber ? 
                `Registered number: ${memberData.phoneNumber}` : 
                'Enter your M-Pesa registered phone number'}
            </Text>

            <TouchableOpacity 
              style={[
                styles.modalBtn, 
                (!amount || !phoneNumber || !groupId || 
                 (transactionType === 'Contribution' && !selectedPendingContribution) ||
                 (transactionType === 'volunteer' && !selectedCampaign)) && styles.disabledBtn
              ]} 
              onPress={handleMpesaPayment}
              disabled={!amount || !phoneNumber || !groupId || 
                       (transactionType === 'Contribution' && !selectedPendingContribution) ||
                       (transactionType === 'volunteer' && !selectedCampaign)}
            >
              <Text style={styles.modalBtnText}>
                {!groupId ? 'Loading group info...' : 
                 transactionType === 'Contribution' && selectedPendingContribution 
                   ? `Pay KES ${(selectedPendingContribution.amount + (selectedPendingContribution.penaltyApplied || 0)).toLocaleString()}`  // ✅ Shows 550 
                   : transactionType === 'volunteer' && selectedCampaign 
                     ? `Pay to: ${selectedCampaign.campaignName.substring(0, 20)}...` 
                     : 'Pay via MPESA'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                setModalVisible(false);
                setTransactionType('Contribution');
                setSelectedPendingContribution(null);
                setSelectedCampaign(null);
                setShowPendingSelector(false);
                setShowCampaignSelector(false);
                setAmount('');
                if (memberData?.phoneNumber) {
                  setPhoneNumber(memberData.phoneNumber);
                }
              }}
            >
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <MemberBottomNav current="mycontributions" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f4f4f4' 
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FBE7',
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#555' 
  },
  debugWarning: {
    backgroundColor: '#FFE082',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB300',
  },
  debugWarningText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    paddingHorizontal: 10,
    backgroundColor: '#C8E6C9',
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
    elevation: 3,
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  logo: { 
    width: 40, 
    height: 40, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  brandText: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  brandMan: { 
    color: '#000000' 
  },
  brandPower: { 
    color: '#D32F2F' 
  },
  returnButton: { 
    fontSize: 14, 
    color: '#2E7D32', 
    fontWeight: '600' 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginVertical: 16,
    textAlign: 'center',
  },

  // Next Due Card
  nextDueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  nextDueIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  nextDueContent: {
    flex: 1,
  },
  nextDueLabel: {
    fontSize: 12,
    color: '#666',
  },
  nextDueDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  nextDueAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 2,
  },

  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  pendingAlertIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pendingAlertContent: {
    flex: 1,
  },
  pendingAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E65100',
  },
  pendingAlertAmount: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  pendingAlertButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pendingAlertButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  penaltyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  penaltyAlertIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  penaltyAlertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#C62828',
  },

  reminderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  warningReminder: {
    backgroundColor: '#FFF3CD',
    borderLeftColor: '#FFA000',
  },
  urgentReminder: {
    backgroundColor: '#FFEAA7',
    borderLeftColor: '#F39C12',
  },
  criticalReminder: {
    backgroundColor: '#F8D7DA',
    borderLeftColor: '#DC3545',
  },
  reminderIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  reminderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  reminderButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  reminderButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  summaryContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    flex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  cardLabel: { 
    fontSize: 12, 
    color: '#777',
    marginBottom: 4,
  },
  cardValue: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  cardSubValue: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  pendingValue: {
    color: '#FF9800',
  },

  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  quickActionCard: {
    backgroundColor: '#2E8B57',
    flex: 1,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  quickActionIcon: {
    fontSize: 30,
    marginBottom: 8,
    color: '#FFF',
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#E0F2F1',
    textAlign: 'center',
  },

  filterSection: { 
    marginBottom: 12 
  },
  filterLabel: { 
    fontSize: 16, 
    marginBottom: 8,
    fontWeight: '600',
    color: '#333',
  },
  filterOptions: { 
    flexDirection: 'row', 
    gap: 10 
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#C8E6C9',
    borderRadius: 20,
    color: '#2E7D32',
    fontSize: 14,
    marginRight: 10,
  },
  activeFilter: {
    backgroundColor: '#81C784',
    fontWeight: 'bold',
    color: '#1B5E20',
  },

  searchInput: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: '#FFF',
  },

  tableContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 10,
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  columnHeader: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 4,
    fontSize: 11,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
    minHeight: 50,
  },
  tableCell: {
    textAlign: 'center',
    color: '#555',
    fontSize: 11,
    paddingHorizontal: 4,
  },
  statusBadgeCell: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },

  emptyState: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: { 
    textAlign: 'center', 
    fontSize: 14, 
    color: '#999' 
  },

  bottomSpacing: {
    height: 20,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15 
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 6,
    width: '100%',
    padding: 12,
    marginBottom: 5,
    fontSize: 16,
  },

  dropdownContainer: {
    width: '100%',
    marginBottom: 15,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dropdownOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  selectedDropdownOption: {
    backgroundColor: '#4CAF50',
    borderColor: '#2E7D32',
  },
  dropdownOptionText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  selectedDropdownOptionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  pendingSelectorContainer: {
    width: '100%',
    marginBottom: 15,
  },
  pendingLoader: {
    marginVertical: 20,
  },
  noPendingContainer: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  noPendingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  noPendingSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  pendingScroll: {
    flexDirection: 'row',
  },
  pendingCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    width: 180,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPendingCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  overduePendingCard: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  pendingCardAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  pendingCardDue: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  overdueText: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  pendingCardPenalty: {
    fontSize: 11,
    color: '#F44336',
    marginTop: 4,
  },
  selectedPendingCheck: {
    marginTop: 8,
    alignItems: 'center',
  },
  selectedPendingCheckText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  amountWarning: {
    backgroundColor: '#FFF3CD',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  amountWarningText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500',
  },

  campaignSelectorContainer: {
    width: '100%',
    marginBottom: 15,
  },
  campaignLoader: {
    marginVertical: 20,
  },
  noCampaignsContainer: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  noCampaignsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  noCampaignsSubtext: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  campaignScroll: {
    flexDirection: 'row',
  },
  campaignCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    width: 220,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCampaignCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  campaignCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  campaignCardDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  campaignCardProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  campaignCardProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  campaignCardProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  campaignCardProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
  },
  campaignCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignCardAmount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  campaignCardDays: {
    fontSize: 11,
    color: '#FF9800',
  },
  selectedCampaignCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  selectedCampaignCheckText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  phoneInputContainer: {
    width: '100%',
    marginBottom: 5,
  },
  phoneHint: {
    backgroundColor: '#E8F5E9',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  phoneHintText: {
    fontSize: 12,
    color: '#2E7D32',
    textAlign: 'center',
  },
  phoneNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  disabledBtn: {
    backgroundColor: '#9E9E9E',
  },
  modalBtn: {
    backgroundColor: '#2E7D32',
    padding: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: { 
    color: '#FFF', 
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalClose: { 
    marginTop: 12, 
    color: '#D32F2F', 
    fontWeight: 'bold',
    fontSize: 14,
  },
});
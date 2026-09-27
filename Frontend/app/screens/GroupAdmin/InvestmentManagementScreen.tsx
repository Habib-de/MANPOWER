import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

// ✅ AI IMPORTS
import InvestmentAIChat from '../../../components/InvestmentAIChat';
import InvestmentRecommendations from '../../../components/InvestmentRecommendations';
import { InvestmentContext } from '../../../services/geminiService';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'http://192.168.0.101:8080/api';

// ============ TYPES ============
type Group = {
  id: string;
  groupName: string;
  description: string;
  creationDate: string;
  status: string;
};

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
};

type Investment = {
  id: string;
  investmentName: string;
  investmentType: string;
  amountInvested: number;
  currentValue: number;
  investmentDate: string;
  maturityDate: string;
  expectedReturnRate: number;
  actualReturnRate: number;
  riskLevel: string;
  status: string;
  description: string;
  approvedBy: {
    firstName: string;
    lastName: string;
  };
};

type FormData = {
  investmentName: string;
  investmentType: string;
  amountInvested: string;
  currentValue: string;
  investmentDate: string;
  maturityDate: string;
  expectedReturnRate: string;
  riskLevel: string;
  description: string;
  approvedBy: string;
};

type InvestmentStatus = 'ACTIVE' | 'MATURED' | 'SOLD' | 'UNDERPERFORMING' | 'DEFAULTED';

// ============ MAIN COMPONENT ============
export default function InvestmentManagementScreen(): React.JSX.Element {
  const router = useRouter();

  // ============ STATE ============
  const [groupId, setGroupId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupBalance, setGroupBalance] = useState<number>(0);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [newCurrentValue, setNewCurrentValue] = useState('');
  const [updating, setUpdating] = useState(false);
  
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [nearingMaturity, setNearingMaturity] = useState<Investment[]>([]);
  
  // AI States
  const [showAIChat, setShowAIChat] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

// ✅ ADD THESE TWO NEW STATES
const [showRecommendationDetail, setShowRecommendationDetail] = useState(false);
const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);

  const [formData, setFormData] = useState<FormData>({
    investmentName: '',
    investmentType: '',
    amountInvested: '',
    currentValue: '',
    investmentDate: new Date().toISOString().split('T')[0],
    maturityDate: '',
    expectedReturnRate: '',
    riskLevel: 'MEDIUM',
    description: '',
    approvedBy: '',
  });

  const investmentTypes = [
    'STOCKS', 'BONDS', 'REAL_ESTATE', 'MUTUAL_FUNDS', 
    'FIXED_DEPOSIT', 'BUSINESS', 'OTHER'
  ];

  const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
  const statusOptions: InvestmentStatus[] = ['ACTIVE', 'MATURED', 'SOLD', 'UNDERPERFORMING', 'DEFAULTED'];

  // ============ ANIMATION ============
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // ============ API CALLS ============
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const storedGroupId = await AsyncStorage.getItem('userGroupId');
        const storedAdminId = await AsyncStorage.getItem('userId');

        if (storedGroupId && storedAdminId) {
          setGroupId(storedGroupId);
          setAdminId(storedAdminId);
          await Promise.all([
            fetchGroupData(storedGroupId),
            fetchGroupMembers(storedGroupId),
            fetchGroupBalance(storedGroupId),
            fetchGroupInvestments(storedGroupId),
            fetchNearingMaturity(storedGroupId)
          ]);
        } else {
          Alert.alert('Error', 'User session is invalid. Please log in again.');
        }
      } catch (err) {
        console.error('❌ Failed to load storage:', err);
        Alert.alert('Error', 'Could not load user or group data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const handleApiError = (error: unknown, defaultMessage: string) => {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message || defaultMessage;
      console.error(`❌ API Error:`, error.response?.data);
      Alert.alert('Error', message);
    } else {
      console.error('❌ Unexpected error:', error);
      Alert.alert('Error', defaultMessage);
    }
  };

  const fetchGroupData = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups/${gId}`);
      setGroupData(response.data);
    } catch (err) {
      handleApiError(err, 'Could not fetch group details.');
    }
  };

  const fetchGroupMembers = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/members/by-group/${gId}`);
      setMembers(response.data);
      
      const currentUserId = await AsyncStorage.getItem('userId');
      if (currentUserId && response.data.find((m: Member) => m.id === currentUserId)) {
        setFormData(prev => ({ ...prev, approvedBy: currentUserId }));
      }
    } catch (err) {
      handleApiError(err, 'Could not fetch group members.');
    }
  };

  const fetchGroupBalance = async (gId: string) => {
  try {
    const [contributionsRes, expensesRes, investmentsRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/contributions/group/${gId}`),
      axios.get(`${API_BASE_URL}/expenses`),
      axios.get(`${API_BASE_URL}/investments/group/${gId}`)
    ]);

    // ✅ FIX: Only count COMPLETED contributions
    const totalContributions = contributionsRes.data
      .filter((contribution: any) => contribution.status === 'Completed')
      .reduce((sum: number, contribution: any) => sum + contribution.amount, 0);

    console.log('💰 Total Contributions (Completed only):', totalContributions);

    const groupExpenses = expensesRes.data.filter(
      (expense: any) => expense.group?.id === gId
    );
    
    const totalExpenses = groupExpenses.reduce(
      (sum: number, expense: any) => sum + expense.amount, 0
    );

    console.log('💸 Total Expenses:', totalExpenses);

    const groupInvestments = investmentsRes.data.filter(
      (investment: any) => investment.group?.id === gId
    );
    
    const totalInvested = groupInvestments.reduce(
      (sum: number, investment: any) => sum + investment.amountInvested, 0
    );

    console.log('📈 Total Invested:', totalInvested);

    const balance = totalContributions - totalExpenses - totalInvested;
    console.log('💵 Calculated Balance:', balance);
    setGroupBalance(balance);
  } catch (err) {
    console.error('❌ Error calculating balance:', err);
    setGroupBalance(0);
  }
};

  const fetchGroupInvestments = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/investments/group/${gId}`);
      const investmentsData = response.data.map((investment: any) => ({
        id: investment.id,
        investmentName: investment.investmentName,
        investmentType: investment.investmentType,
        amountInvested: investment.amountInvested,
        currentValue: investment.currentValue,
        investmentDate: investment.investmentDate,
        maturityDate: investment.maturityDate,
        expectedReturnRate: investment.expectedReturnRate,
        actualReturnRate: investment.actualReturnRate,
        riskLevel: investment.riskLevel,
        status: investment.status,
        description: investment.description,
        approvedBy: investment.approvedBy || { firstName: 'Unknown', lastName: '' }
      })).sort((a: Investment, b: Investment) => 
        new Date(b.investmentDate).getTime() - new Date(a.investmentDate).getTime()
      );

      setInvestments(investmentsData);
    } catch (err) {
      handleApiError(err, 'Could not fetch investments.');
      setInvestments([]);
    }
  };

  const fetchNearingMaturity = async (gId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/investments/nearing-maturity?days=30`
      );
      setNearingMaturity(response.data);
    } catch (err) {
      console.error('❌ Error fetching nearing maturity:', err);
      setNearingMaturity([]);
    }
  };

  // ============ INVESTMENT OPERATIONS ============
  const updateInvestmentValue = async () => {
    if (!selectedInvestment || !newCurrentValue || parseFloat(newCurrentValue) < 0) {
      Alert.alert('Validation', 'Please enter a valid current value.');
      return;
    }

    setUpdating(true);
    try {
      const currentValue = parseFloat(newCurrentValue);
      
      await axios.patch(
        `${API_BASE_URL}/investments/${selectedInvestment.id}/current-value?currentValue=${currentValue}`
      );

      Alert.alert(
        'Success', 
        `Investment value updated to KES ${currentValue.toLocaleString()}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setUpdateModalVisible(false);
              setNewCurrentValue('');
              setSelectedInvestment(null);
              fetchGroupInvestments(groupId);
              fetchGroupBalance(groupId);
            }
          }
        ]
      );

    } catch (err: unknown) {
      handleApiError(err, 'Failed to update investment value.');
    } finally {
      setUpdating(false);
    }
  };

  const closeInvestment = async (investment: Investment) => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/investments/${investment.id}/status`,
        {},
        { params: { status: 'SOLD' } }
      );
      
      fetchGroupInvestments(groupId);
      fetchGroupBalance(groupId);
      Alert.alert('Success', 'Investment closed successfully!');
      
    } catch (err: any) {
      console.error('❌ FAILED: API Error:', err.message);
      Alert.alert('Error', `Failed: ${err.message}`);
    }
  };

  // ============ HELPERS ============
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#4CAF50';
      case 'SOLD': return '#757575';
      case 'MATURED': return '#2196F3';
      case 'UNDERPERFORMING': return '#FF9800';
      case 'DEFAULTED': return '#F44336';
      default: return '#FF9800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return '#4CAF50';
      case 'MEDIUM': return '#FFC107';
      case 'HIGH': return '#FF9800';
      case 'VERY_HIGH': return '#F44336';
      default: return '#757575';
    }
  };

  const filteredInvestments = investments.filter(inv => {
    const typeMatch = filterType === 'ALL' || inv.investmentType === filterType;
    const statusMatch = filterStatus === 'ALL' || inv.status === filterStatus;
    return typeMatch && statusMatch;
  });

  const showUpdateModal = (investment: Investment) => {
    setSelectedInvestment(investment);
    setNewCurrentValue(investment.currentValue.toString());
    setUpdateModalVisible(true);
  };

  const updateForm = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    if (field === 'amountInvested' && !formData.currentValue) {
      setFormData(prev => ({
        ...prev,
        currentValue: value,
      }));
    }
  };

  const validateDates = (): boolean => {
    if (formData.maturityDate && formData.investmentDate) {
      const investmentDate = new Date(formData.investmentDate);
      const maturityDate = new Date(formData.maturityDate);
      
      if (maturityDate <= investmentDate) {
        Alert.alert('Validation', 'Maturity date must be after investment date.');
        return false;
      }
    }
    return true;
  };

  const validateForm = (): boolean => {
    if (!formData.investmentName.trim()) {
      Alert.alert('Validation', 'Please enter an investment name.');
      return false;
    }
    
    if (!formData.investmentType) {
      Alert.alert('Validation', 'Please select an investment type.');
      return false;
    }

    if (!formData.amountInvested || parseFloat(formData.amountInvested) <= 0) {
      Alert.alert('Validation', 'Please enter a valid investment amount.');
      return false;
    }

    if (!formData.approvedBy) {
      Alert.alert('Validation', 'Please select who approved this investment.');
      return false;
    }

    if (formData.expectedReturnRate && parseFloat(formData.expectedReturnRate) < 0) {
      Alert.alert('Validation', 'Return rate cannot be negative.');
      return false;
    }

    if (!validateDates()) {
      return false;
    }

    const investmentAmount = parseFloat(formData.amountInvested);
    
    if (investmentAmount > groupBalance) {
      Alert.alert(
        'Insufficient Funds', 
        `Investment amount (KES ${investmentAmount.toLocaleString()}) exceeds available balance (KES ${groupBalance.toLocaleString()}).`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !groupData) {
      return;
    }

    setSubmitting(true);
    try {
      const approvedByMember = members.find(m => m.id === formData.approvedBy);
      
      if (!approvedByMember) {
        Alert.alert('Error', 'Selected approver not found in group members.');
        return;
      }

      const payload = {
        group: {
          id: groupData.id,
        },
        investmentName: formData.investmentName,
        investmentType: formData.investmentType,
        amountInvested: parseFloat(formData.amountInvested),
        currentValue: parseFloat(formData.currentValue || formData.amountInvested),
        investmentDate: `${formData.investmentDate}T00:00:00.000Z`,
        maturityDate: formData.maturityDate ? `${formData.maturityDate}T00:00:00.000Z` : null,
        expectedReturnRate: formData.expectedReturnRate ? parseFloat(formData.expectedReturnRate) : null,
        riskLevel: formData.riskLevel,
        status: 'ACTIVE',
        description: formData.description,
        approvedBy: {
          id: approvedByMember.id,
        },
        createdBy: adminId,
        modifiedBy: adminId,
        mansoftTenantId: await AsyncStorage.getItem('mansoftTenantId') || 'tenant-001',
      };

      await axios.post(`${API_BASE_URL}/investments`, payload);

      Alert.alert(
        'Success', 
        `Investment of KES ${parseFloat(formData.amountInvested).toLocaleString()} created successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setFormData({
                investmentName: '',
                investmentType: '',
                amountInvested: '',
                currentValue: '',
                investmentDate: new Date().toISOString().split('T')[0],
                maturityDate: '',
                expectedReturnRate: '',
                riskLevel: 'MEDIUM',
                description: '',
                approvedBy: adminId,
              });
              
              fetchGroupBalance(groupId);
              fetchGroupInvestments(groupId);
              fetchNearingMaturity(groupId);
            }
          }
        ]
      );

    } catch (err: unknown) {
      handleApiError(err, 'Failed to create investment.');
    } finally {
      setSubmitting(false);
    }
  };

  // ============ CALCULATIONS ============
  const investmentAmount = parseFloat(formData.amountInvested) || 0;
  const remainingBalance = groupBalance - investmentAmount;

  const totalPortfolioValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
  const totalInvested = investments.reduce((sum, inv) => sum + inv.amountInvested, 0);
  const portfolioReturn = totalInvested > 0 ? ((totalPortfolioValue - totalInvested) / totalInvested) * 100 : 0;

  const getInvestmentContext = (): InvestmentContext => {
    return {
      totalContributions: groupBalance + totalInvested,
      totalInvested: totalInvested,
      portfolioValue: totalPortfolioValue,
      portfolioReturn: portfolioReturn,
      activeInvestments: investments.filter(i => i.status === 'ACTIVE').length,
      riskLevel: 'MEDIUM',
      recentTransactions: investments.slice(0, 5),
      availableBalance: groupBalance,
      groupName: groupData?.groupName || 'My Group',
    };
  };

  // ============ RENDER ============
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
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

      <Animated.ScrollView 
        contentContainerStyle={[styles.container, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>💰 Investment Management</Text>
        <Text style={styles.subtitle}>Track and manage your group's investments</Text>
        
        {/* ===== AI ACTION BUTTONS ===== */}
        <View style={styles.aiButtonContainer}>
          <TouchableOpacity 
            style={[styles.aiButton, styles.chatButton]}
            onPress={() => setShowAIChat(true)}
            activeOpacity={0.9}
          >
            <View style={styles.aiButtonContent}>
              <Text style={styles.aiButtonIcon}>🤖</Text>
              <View style={styles.aiButtonTextContainer}>
                <Text style={styles.aiButtonText}>AI Advisor</Text>
                <Text style={styles.aiButtonSubtext}>Chat with Gemini</Text>
              </View>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>✨</Text>
              </View>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.aiButton, styles.recommendButton]}
            onPress={() => setShowRecommendations(!showRecommendations)}
            activeOpacity={0.9}
          >
            <View style={styles.aiButtonContent}>
              <Text style={styles.aiButtonIcon}>💡</Text>
              <View style={styles.aiButtonTextContainer}>
                <Text style={styles.aiButtonText}>Recommendations</Text>
                <Text style={styles.aiButtonSubtext}>
                  {showRecommendations ? 'Hide insights' : 'Show AI insights'}
                </Text>
              </View>
              <View style={[styles.aiBadge, showRecommendations && styles.aiBadgeActive]}>
                <Text style={styles.aiBadgeText}>
                  {showRecommendations ? '●' : '○'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ===== DASHBOARD CARDS ===== */}
        <View style={styles.dashboardGrid}>
          <View style={[styles.dashboardCard, styles.balanceCard]}>
            <View style={styles.dashboardCardIcon}>
              <Text style={styles.dashboardCardIconText}>💰</Text>
            </View>
            <Text style={styles.dashboardCardLabel}>Available Balance</Text>
            <Text style={styles.dashboardCardValue}>KES {groupBalance.toLocaleString()}</Text>
            {investmentAmount > 0 && (
              <View style={styles.balancePreview}>
                <Text style={styles.balancePreviewLabel}>After investment:</Text>
                <Text style={[
                  styles.balancePreviewValue,
                  { color: remainingBalance >= 0 ? '#4CAF50' : '#F44336' }
                ]}>
                  KES {remainingBalance.toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.dashboardRow}>
            <View style={[styles.dashboardCard, styles.halfCard]}>
              <Text style={styles.dashboardSmallLabel}>Total Invested</Text>
              <Text style={styles.dashboardSmallValue}>KES {totalInvested.toLocaleString()}</Text>
            </View>
            <View style={[styles.dashboardCard, styles.halfCard]}>
              <Text style={styles.dashboardSmallLabel}>Portfolio Return</Text>
              <Text style={[
                styles.dashboardSmallValue,
                { color: portfolioReturn >= 0 ? '#4CAF50' : '#F44336' }
              ]}>
                {portfolioReturn >= 0 ? '↑' : '↓'} {Math.abs(portfolioReturn).toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* ===== AI RECOMMENDATIONS ===== */}
{showRecommendations && (
  <InvestmentRecommendations 
    context={getInvestmentContext()}
    onRecommendationSelect={(rec) => {
      Alert.alert(
        rec.type.replace('_', ' '),
        `${rec.suggestion}\n\n${rec.reasoning}\n\n📊 Expected Return: ${rec.expectedReturn > 0 ? '+' : ''}${rec.expectedReturn}%\n⚠️ Risk Score: ${rec.riskScore}/10`
      );
    }}
    onMoreInfo={(rec) => {
      // ✅ THIS IS THE PROBLEM - MAKE SURE THIS CODE IS EXACTLY THIS
      console.log('📖 More Info clicked in InvestmentManagementScreen:', rec.suggestion);
      console.log('Setting selectedRecommendation:', rec);
      setSelectedRecommendation(rec);
      console.log('Setting showRecommendationDetail to true');
      setShowRecommendationDetail(true);
    }}
  />
)}

        {/* ===== PORTFOLIO SUMMARY ===== */}
        {investments.length > 0 && (
          <View style={styles.portfolioCard}>
            <View style={styles.portfolioCardHeader}>
              <Text style={styles.portfolioCardTitle}>📈 Portfolio Summary</Text>
              <Text style={styles.portfolioCardCount}>{investments.length} investments</Text>
            </View>
            <View style={styles.portfolioStats}>
              <View style={styles.portfolioStat}>
                <Text style={styles.portfolioStatLabel}>Total Invested</Text>
                <Text style={styles.portfolioStatValue}>KES {totalInvested.toLocaleString()}</Text>
              </View>
              <View style={styles.portfolioStatDivider} />
              <View style={styles.portfolioStat}>
                <Text style={styles.portfolioStatLabel}>Current Value</Text>
                <Text style={styles.portfolioStatValue}>KES {totalPortfolioValue.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ===== NEARING MATURITY ALERT ===== */}
        {nearingMaturity.length > 0 && (
          <View style={styles.maturityAlert}>
            <Ionicons name="warning" size={20} color="#FF9800" />
            <View style={styles.maturityAlertContent}>
              <Text style={styles.maturityAlertTitle}>⚠️ Nearing Maturity</Text>
              <Text style={styles.maturityAlertText}>
                {nearingMaturity.length} investment(s) maturing in 30 days
              </Text>
            </View>
          </View>
        )}

        {/* ===== LOADING ===== */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading investments...</Text>
          </View>
        ) : (
          <>
            {/* ===== NEW INVESTMENT FORM ===== */}
            <View style={styles.formCard}>
              <Text style={styles.formCardTitle}>➕ New Investment</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Investment Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Tech Mutual Fund"
                  placeholderTextColor="#999"
                  value={formData.investmentName}
                  onChangeText={(val) => updateForm('investmentName', val)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Investment Type *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formData.investmentType}
                    onValueChange={(val) => updateForm('investmentType', val)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select investment type..." value="" />
                    {investmentTypes.map((type) => (
                      <Picker.Item 
                        key={type} 
                        label={type.replace('_', ' ')} 
                        value={type} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Amount (KES) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter amount"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={formData.amountInvested}
                    onChangeText={(val) => updateForm('amountInvested', val)}
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Current Value</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Current value"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={formData.currentValue}
                    onChangeText={(val) => updateForm('currentValue', val)}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Investment Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#999"
                    value={formData.investmentDate}
                    onChangeText={(val) => updateForm('investmentDate', val)}
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Maturity Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#999"
                    value={formData.maturityDate}
                    onChangeText={(val) => updateForm('maturityDate', val)}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Expected Return (%)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 12.5"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={formData.expectedReturnRate}
                    onChangeText={(val) => updateForm('expectedReturnRate', val)}
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Risk Level</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={formData.riskLevel}
                      onValueChange={(val) => updateForm('riskLevel', val)}
                      style={styles.picker}
                    >
                      {riskLevels.map((level) => (
                        <Picker.Item key={level} label={level} value={level} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Investment details, strategy, notes..."
                  placeholderTextColor="#999"
                  value={formData.description}
                  onChangeText={(val) => updateForm('description', val)}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Approved By *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formData.approvedBy}
                    onValueChange={(val) => updateForm('approvedBy', val)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select approver..." value="" />
                    {members.map((member) => (
                      <Picker.Item 
                        key={member.id} 
                        label={`${member.firstName} ${member.lastName}`} 
                        value={member.id} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    💰 Create Investment
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* ===== INVESTMENT PORTFOLIO ===== */}
            <View style={styles.portfolioSection}>
              <View style={styles.portfolioSectionHeader}>
                <Text style={styles.portfolioSectionTitle}>📊 Investment Portfolio</Text>
                <Text style={styles.portfolioSectionCount}>
                  {filteredInvestments.length} of {investments.length}
                </Text>
              </View>

              {/* Filters */}
              <View style={styles.filterContainer}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Type</Text>
                  <View style={styles.filterPickerWrapper}>
                    <Picker
                      selectedValue={filterType}
                      onValueChange={setFilterType}
                      style={styles.filterPicker}
                      dropdownIconColor="#666"
                    >
                      <Picker.Item label="All Types" value="ALL" />
                      {investmentTypes.map(type => (
                        <Picker.Item key={type} label={type.replace('_', ' ')} value={type} />
                      ))}
                    </Picker>
                  </View>
                </View>
                
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Status</Text>
                  <View style={styles.filterPickerWrapper}>
                    <Picker
                      selectedValue={filterStatus}
                      onValueChange={setFilterStatus}
                      style={styles.filterPicker}
                      dropdownIconColor="#666"
                    >
                      <Picker.Item label="All Statuses" value="ALL" />
                      {statusOptions.map(status => (
                        <Picker.Item key={status} label={status} value={status} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {filteredInvestments.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>📭</Text>
                  <Text style={styles.emptyStateText}>
                    {investments.length === 0 ? 'No investments yet' : 'No investments match your filters'}
                  </Text>
                </View>
              ) : (
                filteredInvestments.map((investment) => (
                  <View key={investment.id} style={styles.investmentCard}>
                    <View style={styles.investmentCardHeader}>
                      <View style={styles.investmentTitleContainer}>
                        <View style={[styles.investmentDot, { backgroundColor: getStatusColor(investment.status) }]} />
                        <Text style={styles.investmentName}>{investment.investmentName}</Text>
                      </View>
                      <View style={[styles.investmentStatusBadge, { backgroundColor: getStatusColor(investment.status) + '20' }]}>
                        <Text style={[styles.investmentStatusText, { color: getStatusColor(investment.status) }]}>
                          {investment.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.investmentTypeContainer}>
                      <Text style={styles.investmentType}>{investment.investmentType.replace('_', ' ')}</Text>
                      <View style={[styles.investmentRiskBadge, { backgroundColor: getRiskColor(investment.riskLevel) + '20' }]}>
                        <Text style={[styles.investmentRiskText, { color: getRiskColor(investment.riskLevel) }]}>
                          {investment.riskLevel} Risk
                        </Text>
                      </View>
                    </View>

                    <View style={styles.investmentStats}>
                      <View style={styles.investmentStat}>
                        <Text style={styles.investmentStatLabel}>Invested</Text>
                        <Text style={styles.investmentStatValue}>KES {investment.amountInvested.toLocaleString()}</Text>
                      </View>
                      <View style={styles.investmentStatDivider} />
                      <View style={styles.investmentStat}>
                        <Text style={styles.investmentStatLabel}>Current</Text>
                        <Text style={styles.investmentStatValue}>KES {investment.currentValue.toLocaleString()}</Text>
                      </View>
                      <View style={styles.investmentStatDivider} />
                      <View style={styles.investmentStat}>
                        <Text style={styles.investmentStatLabel}>Return</Text>
                        <Text style={[
                          styles.investmentStatValue,
                          { color: (investment.actualReturnRate || 0) >= 0 ? '#4CAF50' : '#F44336' }
                        ]}>
                          {(investment.actualReturnRate || 0).toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    {investment.status === 'ACTIVE' && (
                      <View style={styles.investmentActions}>
                        <TouchableOpacity 
                          style={[styles.investmentActionBtn, styles.updateActionBtn]}
                          onPress={() => showUpdateModal(investment)}
                        >
                          <Ionicons name="trending-up" size={14} color="#fff" />
                          <Text style={styles.investmentActionBtnText}>Update</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.investmentActionBtn, styles.closeActionBtn]}
                          onPress={() => closeInvestment(investment)}
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                          <Text style={styles.investmentActionBtnText}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {investment.description && (
                      <Text style={styles.investmentDescription}>{investment.description}</Text>
                    )}
                    
                    <View style={styles.investmentFooter}>
                      <Text style={styles.investmentDate}>
                        Started: {new Date(investment.investmentDate).toLocaleDateString()}
                      </Text>
                      {investment.maturityDate && (
                        <Text style={[
                          styles.investmentMaturity,
                          { color: new Date(investment.maturityDate) < new Date() ? '#F44336' : '#FF9800' }
                        ]}>
                          Matures: {new Date(investment.maturityDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* Bottom spacing for nav */}
        <View style={styles.bottomSpacing} />
      </Animated.ScrollView>

      {/* ===== UPDATE MODAL ===== */}
      <Modal
        visible={updateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setUpdateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Update {selectedInvestment?.investmentName}
              </Text>
              <TouchableOpacity onPress={() => setUpdateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Current Market Value (KES) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current value"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={newCurrentValue}
              onChangeText={setNewCurrentValue}
            />

            {selectedInvestment && newCurrentValue && (
              <View style={styles.returnPreview}>
                <Text style={styles.returnPreviewText}>
                  New Return: {((parseFloat(newCurrentValue) - selectedInvestment.amountInvested) / selectedInvestment.amountInvested * 100).toFixed(2)}%
                </Text>
                <Text style={styles.returnPreviewSubtext}>
                  Previous: {selectedInvestment.actualReturnRate?.toFixed(2)}%
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setUpdateModalVisible(false);
                  setNewCurrentValue('');
                  setSelectedInvestment(null);
                }}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalUpdateBtn]}
                onPress={updateInvestmentValue}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalUpdateBtnText}>Update Value</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

            {/* ===== RECOMMENDATION DETAIL MODAL ===== */}
      <Modal
        visible={showRecommendationDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRecommendationDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💡 Investment Details</Text>
              <TouchableOpacity onPress={() => setShowRecommendationDetail(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedRecommendation && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Type Badge */}
                <View style={styles.detailTypeContainer}>
                  <Text style={styles.detailTypeIcon}>
                    {selectedRecommendation.type === 'STOCKS' ? '📈' :
                     selectedRecommendation.type === 'BONDS' ? '📊' :
                     selectedRecommendation.type === 'REAL_ESTATE' ? '🏠' :
                     selectedRecommendation.type === 'MUTUAL_FUNDS' ? '💰' :
                     selectedRecommendation.type === 'FIXED_DEPOSIT' ? '🏦' :
                     selectedRecommendation.type === 'BUSINESS' ? '💼' : '📈'}
                  </Text>
                  <Text style={styles.detailType}>
                    {selectedRecommendation.type.replace('_', ' ')}
                  </Text>
                </View>

                {/* Suggestion Title */}
                <Text style={styles.detailTitle}>
                  {selectedRecommendation.suggestion}
                </Text>

                {/* Reasoning Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📝 AI Reasoning</Text>
                  <Text style={styles.detailReasoning}>
                    {selectedRecommendation.reasoning}
                  </Text>
                </View>

                {/* Stats */}
                <View style={styles.detailStatsContainer}>
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatLabel}>Expected Return</Text>
                    <Text style={[styles.detailStatValue, { color: '#4CAF50' }]}>
                      {selectedRecommendation.expectedReturn > 0 ? '+' : ''}{selectedRecommendation.expectedReturn}%
                    </Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatLabel}>Risk Score</Text>
                    <Text style={[
                      styles.detailStatValue,
                      { 
                        color: selectedRecommendation.riskScore <= 3 ? '#4CAF50' : 
                               selectedRecommendation.riskScore <= 6 ? '#FFC107' : 
                               selectedRecommendation.riskScore <= 8 ? '#FF9800' : '#F44336'
                      }
                    ]}>
                      {selectedRecommendation.riskScore}/10
                    </Text>
                  </View>
                </View>

                {/* Risk Level Bar */}
                <View style={styles.detailRiskContainer}>
                  <Text style={styles.detailRiskLabel}>Risk Level</Text>
                  <View style={styles.detailRiskBarContainer}>
                    <View 
                      style={[
                        styles.detailRiskBar,
                        { 
                          width: `${(selectedRecommendation.riskScore / 10) * 100}%`,
                          backgroundColor: selectedRecommendation.riskScore <= 3 ? '#4CAF50' : 
                                         selectedRecommendation.riskScore <= 6 ? '#FFC107' : 
                                         selectedRecommendation.riskScore <= 8 ? '#FF9800' : '#F44336'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.detailRiskText}>
                    {selectedRecommendation.riskScore <= 3 ? '🟢 Low Risk - Safe investment with stable returns' : 
                     selectedRecommendation.riskScore <= 6 ? '🟡 Medium Risk - Balanced risk and reward' : 
                     selectedRecommendation.riskScore <= 8 ? '🟠 High Risk - Higher potential returns but more volatile' : 
                     '🔴 Very High Risk - Significant risk, only for experienced investors'}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.detailActions}>
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, styles.detailCreateBtn]}
                    onPress={() => {
                      // Pre-fill form with recommendation
                      setFormData({
                        ...formData,
                        investmentName: selectedRecommendation.suggestion,
                        investmentType: selectedRecommendation.type,
                        expectedReturnRate: selectedRecommendation.expectedReturn.toString(),
                        riskLevel: selectedRecommendation.riskScore <= 3 ? 'LOW' : 
                                  selectedRecommendation.riskScore <= 6 ? 'MEDIUM' : 
                                  selectedRecommendation.riskScore <= 8 ? 'HIGH' : 'VERY_HIGH',
                        description: selectedRecommendation.reasoning,
                      });
                      setShowRecommendationDetail(false);
                      Alert.alert(
                        '✅ Form Pre-filled!',
                        'Review the investment details below and click "Create Investment".'
                      );
                    }}
                  >
                    <Ionicons name="create" size={18} color="#fff" />
                    <Text style={styles.detailActionText}>Create Investment</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, styles.detailChatBtn]}
                    onPress={() => {
                      setShowRecommendationDetail(false);
                      setShowAIChat(true);
                    }}
                  >
                    <Ionicons name="chatbubble" size={18} color="#2196F3" />
                    <Text style={[styles.detailActionText, { color: '#2196F3' }]}>Ask AI</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== AI CHAT MODAL ===== */}
      <InvestmentAIChat
        visible={showAIChat}
        onClose={() => setShowAIChat(false)}
        context={getInvestmentContext()}
      />
      
      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F5F9F5' 
  },
  
  // ===== HEADER =====
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E9',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  logo: { 
    width: 32, 
    height: 32, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  logoText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  backToHome: { 
    color: '#2E7D32', 
    fontWeight: '600', 
    fontSize: 14 
  },

  // ===== CONTAINER =====
  container: { 
    padding: 16, 
    paddingBottom: 120 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#1B5E20', 
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },

  // ===== AI BUTTONS =====
  aiButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  aiButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  aiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButton: {
    borderTopWidth: 3,
    borderTopColor: '#4CAF50',
  },
  recommendButton: {
    borderTopWidth: 3,
    borderTopColor: '#2196F3',
  },
  aiButtonIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  aiButtonTextContainer: {
    flex: 1,
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  aiButtonSubtext: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  aiBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBadgeActive: {
    backgroundColor: '#4CAF50',
  },
  aiBadgeText: {
    fontSize: 14,
    color: '#666',
  },

  // ===== DASHBOARD =====
  dashboardGrid: {
    marginBottom: 16,
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  balanceCard: {
    marginBottom: 12,
  },
  dashboardCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dashboardCardIconText: {
    fontSize: 20,
  },
  dashboardCardLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  dashboardCardValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 2,
  },
  dashboardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCard: {
    flex: 1,
  },
  dashboardSmallLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  dashboardSmallValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  balancePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  balancePreviewLabel: {
    fontSize: 12,
    color: '#888',
  },
  balancePreviewValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ===== PORTFOLIO CARD =====
  portfolioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  portfolioCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  portfolioCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  portfolioCardCount: {
    fontSize: 12,
    color: '#888',
  },
  portfolioStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  portfolioStat: {
    alignItems: 'center',
    flex: 1,
  },
  portfolioStatLabel: {
    fontSize: 11,
    color: '#888',
  },
  portfolioStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  portfolioStatDivider: {
    width: 1,
    backgroundColor: '#E8F5E9',
  },

  // ===== MATURITY ALERT =====
  maturityAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  maturityAlertContent: {
    marginLeft: 12,
    flex: 1,
  },
  maturityAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E65100',
  },
  maturityAlertText: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },

  // ===== LOADING =====
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 10,
  },

  // ===== FORM =====
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  formCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerWrapper: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    overflow: 'hidden',
  },
  picker: {
    height: 48,
    color: '#333',
  },
  submitBtn: {
    backgroundColor: '#2E7D32',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // ===== PORTFOLIO SECTION =====
  portfolioSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  portfolioSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  portfolioSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  portfolioSectionCount: {
    fontSize: 12,
    color: '#888',
  },

  // ===== FILTERS =====
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    marginBottom: 2,
  },
  filterPickerWrapper: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    overflow: 'hidden',
  },
  filterPicker: {
    height: 40,
    color: '#333',
  },

  // ===== EMPTY STATE =====
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },

  // ===== INVESTMENT CARD =====
  investmentCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  investmentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  investmentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  investmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  investmentName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  investmentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  investmentStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  investmentTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  investmentType: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginRight: 8,
  },
  investmentRiskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  investmentRiskText: {
    fontSize: 10,
    fontWeight: '600',
  },
  investmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  investmentStat: {
    alignItems: 'center',
    flex: 1,
  },
  investmentStatLabel: {
    fontSize: 10,
    color: '#888',
  },
  investmentStatValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 1,
  },
  investmentStatDivider: {
    width: 1,
    backgroundColor: '#E8F5E9',
  },
  investmentActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  investmentActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  updateActionBtn: {
    backgroundColor: '#2196F3',
  },
  closeActionBtn: {
    backgroundColor: '#F44336',
  },
  investmentActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  investmentDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  investmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E8F5E9',
    paddingTop: 8,
  },
  investmentDate: {
    fontSize: 10,
    color: '#888',
  },
  investmentMaturity: {
    fontSize: 10,
    fontWeight: '500',
  },

  // ===== BOTTOM SPACING =====
  bottomSpacing: {
    height: 20,
  },

  // ===== MODAL =====
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F5F5F5',
  },
  modalCancelBtnText: {
    color: '#666',
    fontWeight: '600',
  },
  modalUpdateBtn: {
    backgroundColor: '#2196F3',
  },
  modalUpdateBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  returnPreview: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  returnPreviewText: {
    color: '#1565C0',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14,
  },
  returnPreviewSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },

  // ===== DETAIL MODAL STYLES =====
detailTypeContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#E8F5E9',
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 20,
  alignSelf: 'flex-start',
  marginBottom: 12,
},
detailTypeIcon: {
  fontSize: 18,
  marginRight: 8,
},
detailType: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#2E7D32',
},
detailTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 16,
},
detailSection: {
  backgroundColor: '#F8F9FA',
  padding: 14,
  borderRadius: 10,
  marginBottom: 16,
},
detailSectionTitle: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#555',
  marginBottom: 8,
},
detailReasoning: {
  fontSize: 14,
  color: '#444',
  lineHeight: 20,
},
detailStatsContainer: {
  flexDirection: 'row',
  backgroundColor: '#FFFFFF',
  padding: 14,
  borderRadius: 10,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: '#E8F5E9',
},
detailStat: {
  flex: 1,
  alignItems: 'center',
},
detailStatLabel: {
  fontSize: 11,
  color: '#888',
  marginBottom: 4,
},
detailStatValue: {
  fontSize: 18,
  fontWeight: 'bold',
},
detailStatDivider: {
  width: 1,
  backgroundColor: '#E8F5E9',
},
detailRiskContainer: {
  backgroundColor: '#F8F9FA',
  padding: 14,
  borderRadius: 10,
  marginBottom: 16,
},
detailRiskLabel: {
  fontSize: 12,
  color: '#888',
  marginBottom: 6,
},
detailRiskBarContainer: {
  height: 6,
  backgroundColor: '#E0E0E0',
  borderRadius: 3,
  overflow: 'hidden',
  marginBottom: 6,
},
detailRiskBar: {
  height: '100%',
  borderRadius: 3,
},
detailRiskText: {
  fontSize: 12,
  fontWeight: '500',
  textAlign: 'center',
},
detailActions: {
  flexDirection: 'row',
  gap: 12,
  marginTop: 8,
  marginBottom: 4,
},
detailActionBtn: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 14,
  borderRadius: 10,
  gap: 8,
},
detailCreateBtn: {
  backgroundColor: '#2E7D32',
},
detailChatBtn: {
  backgroundColor: '#E3F2FD',
  borderWidth: 1,
  borderColor: '#2196F3',
},
detailActionText: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#fff',
},
});
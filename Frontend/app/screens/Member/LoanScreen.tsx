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
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
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

// Helper function to parse backend validation errors
const parseBackendError = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    console.log('🔍 Raw error response:', text);
    
    try {
      const errorJson = JSON.parse(text);
      
      if (errorJson.errors && Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
        const firstError = errorJson.errors[0];
        if (firstError.defaultMessage) {
          return firstError.defaultMessage;
        }
      }
      
      if (errorJson.message) {
        let msg = errorJson.message;
        if (msg.includes('Validation failed') && msg.includes('default message [')) {
          const match = msg.match(/default message \[(.*?)\]/);
          if (match && match[1]) {
            return match[1];
          }
        }
        return msg;
      }
      
      if (errorJson.error) {
        return errorJson.error;
      }
      
      return text.substring(0, 200);
    } catch {
      if (text.includes('Loan reason must be at least')) {
        return 'Loan reason must be at least 10 characters. Please provide a more detailed description.';
      }
      if (text.includes('must be at least')) {
        return text.substring(0, 150);
      }
      return text.substring(0, 200);
    }
  } catch (err) {
    return 'An unknown error occurred. Please try again.';
  }
};

// --- INTERFACES ---

interface MemberDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  joinDate: string;
  status: string;
  role: string;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
}

interface GroupDetails {
  id: string;
  groupName: string;
  description: string;
  creationDate: string;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
  status: string;
  members: string[] | MemberDetails[];
}

interface GuarantorInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: string;
  totalShares: number;
  activeLoans: number;
  existingGuarantees: number;
  availableCapacity: number;
}

interface SelectedGuarantor {
  id: string;
  firstName: string;
  lastName: string;
  guaranteeAmount: number;
  availableCapacity: number;
}

interface LoanItem {
  id: string;
  member: MemberDetails;
  group: GroupDetails;
  amount: number;
  interestRate: number;
  startDate: string;
  dueDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'PAID' | 'OVERDUE' | 'PENDING_GUARANTOR';
  outstandingBalance: number;
  totalPaid: number | null;
  reason: string;
  description: string;
  approvedBy?: MemberDetails | null;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
  mlDecisionLogId?: number;
  mlApprovedAmount?: number;
  mlRiskLevel?: string;
  mlConfidenceScore?: number;
  mlRecommendation?: string;
  isMlApproved?: boolean;
  repaymentMonths?: number;
  guarantor?: MemberDetails;
  guarantorAmount?: number;
}

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  transactionType: string;
  status: string;
  description: string;
}

interface LoanScheduleItem {
  period: number;
  month: string;
  principal: number;
  interestRate: number;
  interestAmount: number;
  monthlyRepayment: number;
  refinance: number;
  deposit: number;
  balance: number;
}

interface MLDecisionResponse {
  memberId: string;
  loanAmountRequested: number;
  loanReason: string;
  finalRecommendation: 'APPROVE' | 'REJECT' | 'APPROVE WITH CAUTION' | 'APPROVE_WITH_CAUTION' | 'ERROR';
  finalConfidence: number;
  decisionReasoning: string;
  eligibilityAmount: number;
  eligibilityConfidence: number;
  loanRisk: string;
  riskProbability: number;
  riskConfidence: number;
  sentimentRisk: string;
  sentimentConfidence: number;
  memberStatus: string;
  memberRole: string;
  membershipMonths: number;
  processedAt: string;
  dataSource: string;
  mlOrchestratorVersion: string;
  success: boolean;
  errorMessage: string;
  decisionLogId?: number;
  
  interestRate?: number;
  interestRateBreakdown?: string[];
  eligibilityUsagePercentage?: number;
  
  recommendedRepaymentMonths?: number;
  repaymentTermBreakdown?: string[];
  
  detailedExplanations?: {
    memberId: string;
    explanations: Array<{
      category: string;
      decision: string;
      reason: string;
      keyFactor: string;
      impact: string;
    }>;
    summary: {
      keyRecommendation: string;
      primaryReason: string;
      interestRateJustification: string;
      recommendedTerm?: string;
      confidenceLevel: string;
    };
  };
  
  decisionTable?: {
    interestRateBreakdown: Array<{component: string, value: string, reason: string}>;
    eligibilityFactors: Array<{factor: string, status: string, impact: string}>;
    riskAssessment: Array<{riskCategory: string, level: string, score: string}>;
    recommendations: Array<{action: string, status: string, details: string}>;
    summary: string;
  };
  
  htmlDecisionTable?: string;
}

// Add this after your interfaces, before the component starts
const checkOverdueLoans = (loans: LoanItem[]): LoanItem[] => {
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
      console.log(`🔴 Loan ${loan.id} marked as OVERDUE in UI`);
      // ✅ FIX: Explicitly tell TypeScript this is a LoanItem with status 'OVERDUE'
      return {
        ...loan,
        status: 'OVERDUE' as LoanItem['status']
      };
    }
    
    return loan;
  });
  
  return updatedLoans;
};

// --- COMPONENT START ---

export default function LoanScreen() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'PAID' | 'OVERDUE' | 'PENDING_GUARANTOR'>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [mlDecisionModalVisible, setMlDecisionModalVisible] = useState(false);
  const [detailedExplanationsModalVisible, setDetailedExplanationsModalVisible] = useState(false);
  const [guarantorSelectionModalVisible, setGuarantorSelectionModalVisible] = useState(false);
  const [loanAmountInput, setLoanAmountInput] = useState('');
  const [loanReason, setLoanReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);
  const [isGettingMlDecision, setIsGettingMlDecision] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberData, setMemberData] = useState<MemberDetails | null>(null);
  const [totalContributions, setTotalContributions] = useState<number>(0);
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [loanSchedule, setLoanSchedule] = useState<LoanScheduleItem[]>([]);
  
  // ML Decision State
  const [mlDecision, setMlDecision] = useState<MLDecisionResponse | null>(null);
  const [mlDecisionLogId, setMlDecisionLogId] = useState<number | null>(null);
  
  // Guarantor State
  const [availableGuarantors, setAvailableGuarantors] = useState<GuarantorInfo[]>([]);
  const [selectedGuarantors, setSelectedGuarantors] = useState<SelectedGuarantor[]>([]);
  const [loadingGuarantors, setLoadingGuarantors] = useState(false);
  const [guarantorSearchQuery, setGuarantorSearchQuery] = useState('');
  const [requiredGuaranteeAmount, setRequiredGuaranteeAmount] = useState(0);
  const [currentGuaranteeTotal, setCurrentGuaranteeTotal] = useState(0);
  const [storedGroupId, setStoredGroupId] = useState<string | null>(null);

  const MIN_CONTRIBUTION_FOR_LOAN = 5000;
  const GUARANTEE_REQUIREMENT_PERCENTAGE = 0.5; // 50% of loan amount

  // Calculate required guarantee amount (50% of loan)
  useEffect(() => {
    const loanAmount = parseFloat(loanAmountInput);
    if (!isNaN(loanAmount) && loanAmount > 0) {
      const required = loanAmount * GUARANTEE_REQUIREMENT_PERCENTAGE;
      setRequiredGuaranteeAmount(required);
    } else {
      setRequiredGuaranteeAmount(0);
    }
  }, [loanAmountInput]);

  // Calculate total guarantee amount from selected guarantors
  useEffect(() => {
    const total = selectedGuarantors.reduce((sum, g) => sum + g.guaranteeAmount, 0);
    setCurrentGuaranteeTotal(total);
  }, [selectedGuarantors]);

  // Check if guarantee requirement is met
  const isGuaranteeRequirementMet = () => {
    return currentGuaranteeTotal >= requiredGuaranteeAmount && selectedGuarantors.length > 0;
  };

  // Calculate loan schedule function
  const calculateLoanSchedule = (
    loanAmount: number, 
    interestRate: number, 
    repaymentMonths: number,
    startDate: string
  ): LoanScheduleItem[] => {
    const schedule: LoanScheduleItem[] = [];
    const monthlyInterestRate = interestRate / 100 / 12;
    const principalPayment = loanAmount / repaymentMonths;
    let balance = loanAmount;
    
    const start = new Date(startDate);
    
    for (let i = 0; i <= repaymentMonths; i++) {
      const currentDate = new Date(start);
      currentDate.setMonth(start.getMonth() + i);
      
      const monthYear = currentDate.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });

      if (i === 0) {
        schedule.push({
          period: i + 1,
          month: monthYear,
          principal: 0,
          interestRate: interestRate,
          interestAmount: 0,
          monthlyRepayment: 0,
          refinance: 0,
          deposit: 0,
          balance: balance
        });
      } else {
        const interestAmount = balance * monthlyInterestRate;
        const monthlyRepayment = principalPayment + interestAmount;
        
        schedule.push({
          period: i + 1,
          month: monthYear,
          principal: principalPayment,
          interestRate: interestRate,
          interestAmount: interestAmount,
          monthlyRepayment: monthlyRepayment,
          refinance: 0,
          deposit: 0,
          balance: balance - principalPayment
        });
        
        balance -= principalPayment;
      }
    }
    
    return schedule;
  };

  const viewLoanSchedule = (loan: LoanItem) => {
    const term = loan.repaymentMonths || 6;
    const schedule = calculateLoanSchedule(
      loan.amount,
      loan.interestRate,
      term,
      loan.startDate
    );
    setLoanSchedule(schedule);
    setSelectedLoan(loan);
    setScheduleModalVisible(true);
  };

  // Group-based guarantor selection
  const fetchAvailableGuarantors = async () => {
    if (!memberId || !memberData) return;
    
    setLoadingGuarantors(true);
    try {
      const groupId = await AsyncStorage.getItem('userGroupId');
      
      console.log('🔍 Debug - storedGroupId for guarantors:', groupId);
      
      if (!groupId || groupId === 'null' || groupId === 'undefined') {
        showAlert('Error', 'Group information not found. Please logout and login again.');
        setLoadingGuarantors(false);
        return;
      }
      
      setStoredGroupId(groupId);
      
      const groupRes = await fetch(`${BASE_URL}/groups/${groupId}`);
      
      if (!groupRes.ok) {
        console.error('Failed to fetch group:', groupRes.status);
        showAlert('Error', 'Could not fetch your group information.');
        setLoadingGuarantors(false);
        return;
      }
      
      const memberGroup: GroupDetails = await groupRes.json();
      console.log('📋 Group found:', memberGroup.groupName);
      
      let groupMembers: MemberDetails[] = [];
      
      if (Array.isArray(memberGroup.members) && memberGroup.members.length > 0) {
        if (typeof memberGroup.members[0] === 'object') {
          groupMembers = memberGroup.members as MemberDetails[];
        } else {
          const memberIds = memberGroup.members as string[];
          const memberPromises = memberIds.map(id => 
            fetch(`${BASE_URL}/members/${id}`).then(res => res.json())
          );
          groupMembers = await Promise.all(memberPromises);
        }
      }
      
      const potentialGuarantors = groupMembers.filter(m => m.id !== memberId && m.status === 'Active');
      
      console.log('📋 Potential guarantors found:', potentialGuarantors.length);
      
      if (potentialGuarantors.length === 0) {
        setAvailableGuarantors([]);
        setLoadingGuarantors(false);
        return;
      }
      
      const guarantorInfoPromises = potentialGuarantors.map(async (member) => {
        try {
          const capacityRes = await fetch(`${BASE_URL}/loans/guarantor-capacity/${member.id}`);
          if (capacityRes.ok) {
            const data = await capacityRes.json();
            return {
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              email: member.email,
              phoneNumber: member.phoneNumber,
              status: member.status,
              totalShares: data.availableCapacity ? data.availableCapacity + (data.activeLoans || 0) + (data.existingGuarantees || 0) : 0,
              activeLoans: data.activeLoans || 0,
              existingGuarantees: data.existingGuarantees || 0,
              availableCapacity: data.availableCapacity || 0
            } as GuarantorInfo;
          }
          return null;
        } catch (err) {
          console.error(`Failed to fetch capacity for ${member.id}:`, err);
          return null;
        }
      });
      
      const results = await Promise.all(guarantorInfoPromises);
      const validGuarantors = results.filter(g => g !== null && g.availableCapacity > 0) as GuarantorInfo[];
      setAvailableGuarantors(validGuarantors);
      
      console.log('📋 Valid guarantors with capacity:', validGuarantors.length);
      
    } catch (err) {
      console.error('Error fetching guarantors:', err);
      showAlert('Error', 'Failed to load available guarantors.');
    } finally {
      setLoadingGuarantors(false);
    }
  };

  const openGuarantorSelection = () => {
    if (!loanAmountInput || !loanReason) {
      showAlert('Validation Error', 'Please enter both the loan amount and reason first.');
      return;
    }
    
    const requestedAmount = parseFloat(loanAmountInput);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid positive loan amount.');
      return;
    }
    
    if (totalContributions < MIN_CONTRIBUTION_FOR_LOAN) {
      showAlert(
        'Loan Ineligible',
        `You need a minimum total contribution of KES ${MIN_CONTRIBUTION_FOR_LOAN.toLocaleString('en-KE')} to apply for a loan.`
      );
      return;
    }
    
    fetchAvailableGuarantors();
    setSelectedGuarantors([]);
    setGuarantorSearchQuery('');
    setGuarantorSelectionModalVisible(true);
  };

  const addGuarantor = (guarantor: GuarantorInfo, guaranteeAmount: number) => {
    if (selectedGuarantors.length >= 3) {
      showAlert('Maximum Reached', 'You can only select up to 3 guarantors.');
      return false;
    }
    
    if (selectedGuarantors.some(g => g.id === guarantor.id)) {
      showAlert('Already Selected', `${guarantor.firstName} ${guarantor.lastName} is already selected as a guarantor.`);
      return false;
    }
    
    if (guaranteeAmount > guarantor.availableCapacity) {
      showAlert(
        'Insufficient Capacity', 
        `${guarantor.firstName} ${guarantor.lastName} can only guarantee up to KES ${guarantor.availableCapacity.toLocaleString('en-KE')}.`
      );
      return false;
    }
    
    const newTotal = currentGuaranteeTotal + guaranteeAmount;
    if (newTotal > requiredGuaranteeAmount + (requiredGuaranteeAmount * 0.2)) {
      showAlert(
        'Exceeds Requirement', 
        `Total guarantee (${newTotal.toLocaleString('en-KE')}) exceeds the required amount (${requiredGuaranteeAmount.toLocaleString('en-KE')}) by more than 20%.`
      );
      return false;
    }
    
    setSelectedGuarantors([...selectedGuarantors, {
      id: guarantor.id,
      firstName: guarantor.firstName,
      lastName: guarantor.lastName,
      guaranteeAmount: guaranteeAmount,
      availableCapacity: guarantor.availableCapacity
    }]);
    
    return true;
  };

  const removeGuarantor = (guarantorId: string) => {
    setSelectedGuarantors(selectedGuarantors.filter(g => g.id !== guarantorId));
  };

  const updateGuarantorAmount = (guarantorId: string, newAmount: number) => {
    const guarantor = selectedGuarantors.find(g => g.id === guarantorId);
    if (guarantor && newAmount <= guarantor.availableCapacity && newAmount > 0) {
      setSelectedGuarantors(selectedGuarantors.map(g => 
        g.id === guarantorId ? { ...g, guaranteeAmount: newAmount } : g
      ));
    }
  };

  const filteredGuarantors = availableGuarantors.filter(g => 
    `${g.firstName} ${g.lastName}`.toLowerCase().includes(guarantorSearchQuery.toLowerCase()) ||
    g.email.toLowerCase().includes(guarantorSearchQuery.toLowerCase())
  );

  const fetchData = useCallback(async (currentMemberId: string) => {
    if (!currentMemberId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const memberRes = await fetch(`${BASE_URL}/members/${currentMemberId}`);
      if (memberRes.ok) {
        const member: MemberDetails = await memberRes.json();
        setMemberData(member);
      } else {
        console.error('Failed to fetch member details:', memberRes.status);
      }

      const contributionsRes = await fetch(`${BASE_URL}/contributions/member/${currentMemberId}`);
      if (contributionsRes.ok) {
        const data: Contribution[] = await contributionsRes.json();
        const sum = data.reduce((acc, current) => {
          if (current.transactionType === 'Contribution' && current.status === 'Completed') {
            return acc + current.amount;
          }
          return acc;
        }, 0);
        setTotalContributions(sum);
      }

      const loansRes = await fetch(`${BASE_URL}/loans`);
      if (loansRes.ok) {
        const allLoans: LoanItem[] = await loansRes.json();
        const userLoans = allLoans.filter((loan) => loan.member?.id === currentMemberId);
        // ✅ Check for overdue loans (LOCAL ONLY - no API call)
  const updatedLoans = checkOverdueLoans(userLoans);
  
  // ✅ SORT by startDate - newest first (most recent first)
  const sortedLoans = updatedLoans.sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  
  setLoans(sortedLoans);
      }
    } catch (err) {
      console.error('Network error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add this after your existing fetchData useEffect
useEffect(() => {
  // Check for overdue every 60 seconds
  const interval = setInterval(() => {
    if (memberId) {
      fetchData(memberId);
    }
  }, 60000);

  return () => clearInterval(interval);
}, [memberId, fetchData]);

  useEffect(() => {
    const loadAndFetch = async () => {
      const storedMemberId = await AsyncStorage.getItem('userId');
      if (!storedMemberId) {
        router.replace('/(auth)');
        return;
      }
      setMemberId(storedMemberId);
      fetchData(storedMemberId);
    };
    loadAndFetch();
  }, [fetchData]);

  const getInterestRateFromDetailedExplanations = (decision: MLDecisionResponse): number | null => {
    if (!decision.detailedExplanations?.summary?.interestRateJustification) {
      return null;
    }
    
    const rateText = decision.detailedExplanations.summary.interestRateJustification;
    
    const patterns = [
      /Decision:\s*([\d.]+)%/,
      /rate.*?([\d.]+)%/i,
      /([\d.]+)%\s*rate/i,
      /interest.*?([\d.]+)%/i,
      /([\d.]+)%\s*interest/i,
      /([\d.]+)%/,
    ];
    
    for (const pattern of patterns) {
      const match = rateText.match(pattern);
      if (match && match[1]) {
        const rate = parseFloat(match[1]);
        if (!isNaN(rate)) return rate;
      }
    }
    return null;
  };

  const calculateMlBasedInterestRate = (decision: MLDecisionResponse): number => {
    if (!decision) {
      throw new Error('ML decision is required');
    }

    if (decision.interestRate && !isNaN(decision.interestRate)) {
      return decision.interestRate;
    }

    const detailedRate = getInterestRateFromDetailedExplanations(decision);
    if (detailedRate !== null) return detailedRate;

    if (decision.decisionTable?.interestRateBreakdown) {
      for (const item of decision.decisionTable.interestRateBreakdown) {
        const rateMatch = item.value.match(/([\d.]+)%/);
        if (rateMatch) {
          const rate = parseFloat(rateMatch[1]);
          if (!isNaN(rate)) return rate;
        }
      }
    }

    const riskBasedRates: Record<string, number> = {
      'VERY LOW': 7.0,
      'LOW': 9.0,
      'MEDIUM': 12.0,
      'HIGH': 15.0,
      'VERY HIGH': 18.0
    };
    return riskBasedRates[decision.loanRisk] || 12.0;
  };

  // STAGE 2: Get ML Decision (after guarantor selection)
  const getMlDecision = async () => {
    if (!loanAmountInput || !loanReason) {
      showAlert('Validation Error', 'Please enter both the loan amount and reason.');
      return;
    }
    const requestedAmount = parseFloat(loanAmountInput);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid positive loan amount.');
      return;
    }

    if (!memberId || !memberData) {
      showAlert('Error', 'Member data is missing. Please refresh the app.');
      return;
    }

    if (totalContributions < MIN_CONTRIBUTION_FOR_LOAN) {
      showAlert(
        'Loan Ineligible',
        `You need a minimum total contribution of KES ${MIN_CONTRIBUTION_FOR_LOAN.toLocaleString('en-KE')} to apply for a loan. Your current total contribution is KES ${totalContributions.toLocaleString('en-KE')}.`
      );
      return;
    }

    const hasActiveOrPendingLoan = loans.some(
      (loan) => ['PENDING', 'APPROVED', 'ACTIVE', 'OVERDUE', 'PENDING_GUARANTOR'].includes(loan.status) && loan.outstandingBalance > 0
    );
    if (hasActiveOrPendingLoan) {
      showAlert(
        'Existing Loan',
        'You have an active, pending, or overdue loan. Please settle it before applying for a new one.'
      );
      return;
    }

    setIsGettingMlDecision(true);

    try {
      const mlAssessmentRequest = {
        memberId: memberData.id,
        memberStatus: memberData.status,
        memberRole: memberData.role,
        joinDate: memberData.joinDate,
        loanAmount: requestedAmount,
        loanReason: loanReason
      };

      const res = await fetch(`${BASE_URL}/loan/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mlAssessmentRequest),
      });

      if (res.ok) {
        const mlDecisionResponse: MLDecisionResponse = await res.json();
        setMlDecision(mlDecisionResponse);
        
        if (mlDecisionResponse.success && mlDecisionResponse.decisionLogId) {
          setMlDecisionLogId(mlDecisionResponse.decisionLogId);
        }
        
        if (mlDecisionResponse.success) {
          setMlDecisionModalVisible(true);
          setModalVisible(false);
        } else {
          showAlert('ML Assessment Failed', mlDecisionResponse.errorMessage || 'Failed to get ML decision');
        }
      } else {
        const errorMessage = await parseBackendError(res);
        showAlert('Assessment Failed', errorMessage);
      }
    } catch (err: any) {
      console.error('Network error:', err);
      showAlert('Connection Error', 'Could not connect to the assessment service. Please try again.');
    } finally {
      setIsGettingMlDecision(false);
    }
  };

  // STAGE 3: Create Loan from ML Decision with Guarantors
  const createLoanFromMlDecision = async () => {
    if (!mlDecision || !memberId || !memberData) {
      showAlert('Error', 'Missing required data for loan creation.');
      return;
    }

    if (!mlDecisionLogId) {
      showAlert('Error', 'ML Decision reference is missing. Please restart the loan application process.');
      return;
    }

    // Validate guarantors
    if (!isGuaranteeRequirementMet()) {
      const remaining = requiredGuaranteeAmount - currentGuaranteeTotal;
      showAlert(
        'Guarantee Requirement Not Met',
        `You need guarantors covering at least 50% of the loan amount (KES ${requiredGuaranteeAmount.toLocaleString('en-KE')}).\n\n` +
        `Current total guarantee: KES ${currentGuaranteeTotal.toLocaleString('en-KE')}\n` +
        `Remaining needed: KES ${remaining.toLocaleString('en-KE')}\n\n` +
        `Please add more guarantors or increase guarantee amounts.`
      );
      return;
    }

    const repaymentTerm = mlDecision.recommendedRepaymentMonths || 12;
    
    if (repaymentTerm < 3 || repaymentTerm > 24) {
      showAlert('Error', `Invalid repayment term: ${repaymentTerm} months. Term must be between 3 and 24 months.`);
      return;
    }

    if (!storedGroupId) {
      showAlert('Error', 'Group information missing. Please logout and login again.');
      return;
    }

    setIsSubmittingLoan(true);

    try {
      const groupRes = await fetch(`${BASE_URL}/groups/${storedGroupId}`);
      if (!groupRes.ok) {
        throw new Error('Failed to fetch group');
      }
      const memberGroup = await groupRes.json();

      const approvedAmount = mlDecision.loanAmountRequested || parseFloat(loanAmountInput);
      let mlInterestRate;
      
      try {
        mlInterestRate = calculateMlBasedInterestRate(mlDecision);
      } catch (error: any) {
        showAlert('Interest Rate Error', error.message || 'Could not determine interest rate from AI assessment.');
        setIsSubmittingLoan(false);
        return;
      }
      
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + repaymentTerm);
      
      const primaryGuarantor = selectedGuarantors[0];
      const totalGuaranteeAmount = selectedGuarantors.reduce((sum, g) => sum + g.guaranteeAmount, 0);
      
      const mlLoanPayload = {
        member: { id: memberData.id },
        group: { id: memberGroup.id },
        amount: approvedAmount,
        interestRate: mlInterestRate,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'PENDING_GUARANTOR',
        outstandingBalance: approvedAmount,
        reason: mlDecision.loanReason || loanReason,
        approvedBy: { id: memberData.id },
        mansoftTenantId: memberData.mansoftTenantId,
        mlDecisionLogId: mlDecisionLogId,
        mlApprovedAmount: approvedAmount,
        mlRiskLevel: mlDecision.loanRisk,
        mlConfidenceScore: mlDecision.finalConfidence,
        mlRecommendation: mlDecision.finalRecommendation,
        isMlApproved: true,
        repaymentMonths: repaymentTerm,
        guarantor: { id: primaryGuarantor.id },
        guarantorAmount: primaryGuarantor.guaranteeAmount
      };

      const res = await fetch(`${BASE_URL}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mlLoanPayload),
      });

      if (res.ok) {
        const createdLoan = await res.json();
        
        showAlert(
          '🎉 Loan Application Submitted!', 
          `Your loan of KES ${approvedAmount.toLocaleString('en-KE')} has been submitted for guarantor approval.\n\n` +
          `Risk Level: ${mlDecision.loanRisk}\n` +
          `Interest Rate: ${mlInterestRate}%\n` +
          `Repayment Term: ${repaymentTerm} months\n` +
          `Guarantors: ${selectedGuarantors.length} selected\n` +
          `Total Guarantee: KES ${totalGuaranteeAmount.toLocaleString('en-KE')}\n\n` +
          `⚠️ Your selected guarantors need to accept the guarantee for the loan to be approved.`,
          () => {
            setMlDecisionModalVisible(false);
            setGuarantorSelectionModalVisible(false);
            setLoanAmountInput('');
            setLoanReason('');
            setMlDecision(null);
            setMlDecisionLogId(null);
            setSelectedGuarantors([]);
            fetchData(memberId);
          }
        );
      } else {
        const errorMessage = await parseBackendError(res);
        
        if (errorMessage.includes('guarantor')) {
          showAlert('Guarantor Error', errorMessage);
        } else if (errorMessage.includes('ML Decision Log ID is required')) {
          showAlert('System Error', 'ML decision reference was lost. Please restart the loan application process.');
        } else {
          showAlert('Loan Creation Failed', errorMessage);
        }
      }
    } catch (err: any) {
      console.error('Network error:', err);
      showAlert('Error', err.message || 'Could not connect to the server to create your loan.');
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const getLoanStatusStyle = (status: LoanItem['status']) => {
    switch (status) {
      case 'PENDING': return { color: '#FFA500' };
      case 'PENDING_GUARANTOR': return { color: '#FF9800' };
      case 'APPROVED': return { color: '#4CAF50' };
      case 'ACTIVE': return { color: '#2196F3' };
      case 'REJECTED': return { color: '#D32F2F' };
      case 'PAID': return { color: '#1B5E20' };
      case 'OVERDUE': return { color: '#FF4500' };
      default: return { color: '#333' };
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'VERY LOW': return '#4CAF50';
      case 'LOW': return '#8BC34A';
      case 'MEDIUM': return '#FFC107';
      case 'HIGH': return '#FF9800';
      case 'VERY HIGH': return '#F44336';
      default: return '#666';
    }
  };

  if (loading || isSubmittingLoan || isGettingMlDecision) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#388E3C" />
        <Text style={styles.loadingText}>
          {isGettingMlDecision ? '🤖 AI is assessing your loan...' : 
           isSubmittingLoan ? 'Creating your loan...' : 
           'Loading your financial data...'}
        </Text>
      </SafeAreaView>
    );
  }

  const filteredLoans = loans.filter(loan => filter === 'All' || loan.status === filter);

  const LoanTableRow = ({ item }: { item: LoanItem }) => {
    const canRepay = ['APPROVED', 'ACTIVE', 'OVERDUE'].includes(item.status) && 
                     item.outstandingBalance > 0;
    const isPendingGuarantor = item.status === 'PENDING_GUARANTOR';

    return (
      <TouchableOpacity style={styles.tableRow} onPress={() => viewLoanSchedule(item)}>
        <Text style={styles.tableCell}>{item.startDate}</Text>
        <Text style={[styles.tableCell, styles.amountCell]}>KES {item.amount.toLocaleString('en-KE')}</Text>
        <Text style={[styles.tableCell, getLoanStatusStyle(item.status), { fontWeight: 'bold' }]}>
          {item.isMlApproved ? '🤖 ' : ''}
          {isPendingGuarantor ? '⏳ PENDING GUARANTOR' : item.status}
        </Text>
        <Text style={styles.tableCell}>KES {(item.totalPaid ?? 0).toLocaleString('en-KE')}</Text>
        <Text style={styles.tableCell}>KES {item.outstandingBalance.toLocaleString('en-KE')}</Text>
        <Text style={styles.tableCell}>{item.dueDate}</Text>
        <Text style={styles.tableCell}>{item.reason}</Text>
        <Text style={styles.tableCell}>{item.interestRate}%</Text>
        
        <View style={[styles.tableCell, { flex: 0.6 }]}>
          {canRepay ? (
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => {
                router.push({
                  pathname: '/(member)/loan-repayment',
                  params: { 
                    loanId: item.id,
                    amount: item.amount.toString(),
                    outstanding: item.outstandingBalance.toString(),
                    dueDate: item.dueDate,
                    interestRate: item.interestRate.toString(),
                    status: item.status
                  }
                });
              }}
            >
              <Text style={styles.payButtonText}>💰 Pay</Text>
            </TouchableOpacity>
          ) : isPendingGuarantor ? (
            <Text style={styles.pendingLabel}>⏳ Awaiting</Text>
          ) : (
            <Text style={styles.paidLabel}>{item.status === 'PAID' ? '✅' : '—'}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const LoanScheduleRow = ({ item }: { item: LoanScheduleItem }) => (
    <View style={styles.scheduleRow}>
      <Text style={styles.scheduleCell}>{item.period}</Text>
      <Text style={styles.scheduleCell}>{item.month}</Text>
      <Text style={styles.scheduleCell}>{item.principal.toFixed(2)}</Text>
      <Text style={styles.scheduleCell}>{item.interestRate.toFixed(1)}%</Text>
      <Text style={styles.scheduleCell}>{item.interestAmount.toFixed(2)}</Text>
      <Text style={styles.scheduleCell}>{item.monthlyRepayment.toFixed(2)}</Text>
      <Text style={styles.scheduleCell}>{item.balance.toFixed(2)}</Text>
    </View>
  );

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
          <TouchableOpacity style={styles.contributionsButton} onPress={() => router.replace('/(member)/mycontributions')}>
            <Text style={styles.contributionsButtonText}>↩️ Contributions</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleTextContainer}>
                <Text style={styles.titleText}>My Loans</Text>
                <Text style={styles.subtitleText}>AI-Powered Loan Assessment</Text>
              </View>
              <TouchableOpacity style={styles.logsButton} onPress={() => router.push('/(member)/decision-logs')}>
                <Text style={styles.logsButtonText}>📋 AI Decisions</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, styles.contributionsCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>💰</Text>
                <Text style={styles.summaryCardLabel}>Total Contributions</Text>
              </View>
              <Text style={styles.summaryCardValue}>KES {totalContributions.toLocaleString('en-KE')}</Text>
              <View style={styles.eligibilityBadge}>
                <Text style={styles.eligibilityBadgeText}>
                  {totalContributions >= MIN_CONTRIBUTION_FOR_LOAN ? '✅ Eligible' : '❌ Not Eligible'}
                </Text>
              </View>
            </View>

            <View style={[styles.summaryCard, styles.aiEligibilityCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>🤖</Text>
                <Text style={styles.summaryCardLabel}>AI Assessment</Text>
              </View>
              {mlDecision ? (
                <>
                  <Text style={styles.aiApprovedAmount}>
                    KES {mlDecision.eligibilityAmount?.toLocaleString('en-KE')}
                  </Text>
                  <View style={[styles.riskBadge, { backgroundColor: getRiskColor(mlDecision.loanRisk) + '20' }]}>
                    <Text style={[styles.riskBadgeText, { color: getRiskColor(mlDecision.loanRisk) }]}>
                      {mlDecision.loanRisk} Risk
                    </Text>
                  </View>
                  <Text style={styles.confidenceText}>
                    {(mlDecision.finalConfidence * 100).toFixed(0)}% Confidence
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.aiReadyText}>Ready for Assessment</Text>
                  <View style={styles.aiFeatures}>
                    <Text style={styles.aiFeature}>• Instant Approval</Text>
                    <Text style={styles.aiFeature}>• Risk-Based Rates</Text>
                    <Text style={styles.aiFeature}>• Fair Evaluation</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* AI Info Card */}
          <View style={styles.aiInfoCard}>
            <Text style={styles.aiInfoTitle}>🤖 AI Loan Assessment</Text>
            <Text style={styles.aiInfoText}>
              Get instant loan approval using our AI system. We analyze your profile, contributions, and loan purpose for fast, fair decisions with risk-based interest rates and personalized repayment terms (3-24 months).
            </Text>
          </View>

          {/* Filter Buttons */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['🗂️ All', '⏳ PENDING', '✅ APPROVED', '🔄 ACTIVE', '💳 PAID', '⏰ OVERDUE', '🤝 PENDING GUARANTOR'].map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f.replace(/[🗂️⏳✅🔄💳⏰🤝]/g, '').trim() as any)}
                style={[styles.filterBtn, filter === f.replace(/[🗂️⏳✅🔄💳⏰🤝]/g, '').trim() && styles.activeFilter]}
              >
                <Text style={[styles.filterText, filter === f.replace(/[🗂️⏳✅🔄💳⏰🤝]/g, '').trim() && styles.activeFilterText]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Loans Table */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderCell}>Start Date</Text>
            <Text style={styles.tableHeaderCell}>Amount</Text>
            <Text style={styles.tableHeaderCell}>Status</Text>
            <Text style={styles.tableHeaderCell}>Paid</Text>
            <Text style={styles.tableHeaderCell}>Outstanding</Text>
            <Text style={styles.tableHeaderCell}>Due Date</Text>
            <Text style={styles.tableHeaderCell}>Reason</Text>
            <Text style={styles.tableHeaderCell}>Interest</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Action</Text>
          </View>
          <FlatList
            data={filteredLoans}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <LoanTableRow item={item} />}
            scrollEnabled={false}
            ListEmptyComponent={!loading && <Text style={styles.empty}>📊 No loans found.</Text>}
          />
        </View>
      </ScrollView>

      {/* FAB Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>🤖</Text>
        <Text style={styles.fabText}>AI Loan</Text>
      </TouchableOpacity>

      {/* STAGE 1: Loan Request Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🤖 AI Loan Assessment</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeXButton}>
                <Text style={styles.closeXText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Get Instant AI Decision</Text>
            
            <View style={styles.modalInfoCard}>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Total Contributions:</Text>
                <Text style={styles.modalInfoValue}>KES {totalContributions.toLocaleString('en-KE')}</Text>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Minimum Required:</Text>
                <Text style={styles.modalInfoValue}>KES {MIN_CONTRIBUTION_FOR_LOAN.toLocaleString('en-KE')}</Text>
              </View>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>AI Assessment:</Text>
                <Text style={styles.modalInfoValue}>Real-time Approval & Term Prediction (3-24 months)</Text>
              </View>
            </View>
            
            <TextInput
              placeholder="Enter Loan Amount (KES)"
              keyboardType="numeric"
              value={loanAmountInput}
              onChangeText={setLoanAmountInput}
              style={styles.input}
            />
            <TextInput
              placeholder="Reason for Loan (e.g., medical, school fees, business)"
              value={loanReason}
              onChangeText={setLoanReason}
              style={[styles.input, { height: 80 }]}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.helperText}>💡 Tip: Provide a detailed reason (at least 10 characters) for better AI assessment</Text>
            <TouchableOpacity onPress={openGuarantorSelection} style={styles.mlAssessmentBtn}>
              <Text style={styles.mlAssessmentText}>🤖 Continue to Guarantor Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* GUARANTOR SELECTION MODAL */}
      <Modal visible={guarantorSelectionModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👥 Select Guarantors</Text>
              <TouchableOpacity onPress={() => setGuarantorSelectionModalVisible(false)} style={styles.closeXButton}>
                <Text style={styles.closeXText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Guarantee Requirement Card */}
            <View style={styles.guaranteeRequirementCard}>
              <Text style={styles.guaranteeRequirementTitle}>📋 Guarantee Requirement</Text>
              <Text style={styles.guaranteeRequirementText}>
                You need guarantors covering at least 50% of your loan amount
              </Text>
              <View style={styles.guaranteeProgressContainer}>
                <View style={styles.guaranteeProgressRow}>
                  <Text style={styles.guaranteeProgressLabel}>Loan Amount:</Text>
                  <Text style={styles.guaranteeProgressValue}>KES {parseFloat(loanAmountInput || '0').toLocaleString('en-KE')}</Text>
                </View>
                <View style={styles.guaranteeProgressRow}>
                  <Text style={styles.guaranteeProgressLabel}>Required (50%):</Text>
                  <Text style={styles.guaranteeProgressValue}>KES {requiredGuaranteeAmount.toLocaleString('en-KE')}</Text>
                </View>
                <View style={styles.guaranteeProgressRow}>
                  <Text style={styles.guaranteeProgressLabel}>Total Guaranteed:</Text>
                  <Text style={[styles.guaranteeProgressValue, { color: isGuaranteeRequirementMet() ? '#4CAF50' : '#F44336', fontWeight: 'bold' }]}>
                    KES {currentGuaranteeTotal.toLocaleString('en-KE')}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${Math.min((currentGuaranteeTotal / requiredGuaranteeAmount) * 100, 100)}%` }]} />
                </View>
                <Text style={[
                  styles.guaranteeStatusText,
                  { color: isGuaranteeRequirementMet() ? '#4CAF50' : '#F44336' }
                ]}>
                  {isGuaranteeRequirementMet() ? '✅ Requirement Met!' : `⚠️ Need KES ${(requiredGuaranteeAmount - currentGuaranteeTotal).toLocaleString('en-KE')} more`}
                </Text>
              </View>
            </View>

            {/* Selected Guarantors List */}
            {selectedGuarantors.length > 0 && (
              <View style={styles.selectedGuarantorsCard}>
                <Text style={styles.selectedGuarantorsTitle}>✓ Selected Guarantors ({selectedGuarantors.length}/3)</Text>
                {selectedGuarantors.map((g, index) => (
                  <View key={g.id} style={styles.selectedGuarantorItem}>
                    <View style={styles.selectedGuarantorInfo}>
                      <Text style={styles.selectedGuarantorName}>
                        {index + 1}. {g.firstName} {g.lastName}
                      </Text>
                      <View style={styles.guaranteeAmountInputContainer}>
                        <Text style={styles.guaranteeAmountLabel}>KES</Text>
                        <TextInput
                          style={styles.guaranteeAmountInput}
                          keyboardType="numeric"
                          value={g.guaranteeAmount.toString()}
                          onChangeText={(val) => {
                            const num = parseFloat(val);
                            if (!isNaN(num) && num > 0) {
                              updateGuarantorAmount(g.id, Math.min(num, g.availableCapacity));
                            }
                          }}
                        />
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeGuarantor(g.id)} style={styles.removeGuarantorBtn}>
                      <Text style={styles.removeGuarantorText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Search Input */}
            <TextInput
              placeholder="🔍 Search guarantor by name or email..."
              value={guarantorSearchQuery}
              onChangeText={setGuarantorSearchQuery}
              style={styles.searchInput}
            />

            {/* Available Guarantors List */}
            <ScrollView style={styles.guarantorsList} showsVerticalScrollIndicator={false}>
              {loadingGuarantors ? (
                <ActivityIndicator size="large" color="#388E3C" style={styles.guarantorLoader} />
              ) : filteredGuarantors.length === 0 ? (
                <Text style={styles.noGuarantorsText}>No available guarantors found in your group.</Text>
              ) : (
                filteredGuarantors.map((guarantor) => {
                  const isSelected = selectedGuarantors.some(g => g.id === guarantor.id);
                  const maxGuarantee = Math.min(guarantor.availableCapacity, requiredGuaranteeAmount - currentGuaranteeTotal);
                  
                  return (
                    <View key={guarantor.id} style={[styles.guarantorCard, isSelected && styles.guarantorCardSelected]}>
                      <View style={styles.guarantorInfo}>
                        <View style={styles.guarantorAvatar}>
                          <Text style={styles.guarantorAvatarText}>
                            {guarantor.firstName[0]}{guarantor.lastName[0]}
                          </Text>
                        </View>
                        <View style={styles.guarantorDetails}>
                          <Text style={styles.guarantorName}>{guarantor.firstName} {guarantor.lastName}</Text>
                          <Text style={styles.guarantorEmail}>{guarantor.email}</Text>
                          <Text style={styles.guarantorPhone}>{guarantor.phoneNumber}</Text>
                          <View style={styles.guarantorCapacityRow}>
                            <Text style={styles.guarantorCapacityLabel}>Available Capacity:</Text>
                            <Text style={styles.guarantorCapacityValue}>
                              KES {guarantor.availableCapacity.toLocaleString('en-KE')}
                            </Text>
                          </View>
                          <View style={styles.guarantorStatsRow}>
                            {/* <Text style={styles.guarantorStat}>Active Loans: KES {guarantor.activeLoans.toLocaleString('en-KE')}</Text>
                            <Text style={styles.guarantorStat}>Existing Guarantees: KES {guarantor.existingGuarantees.toLocaleString('en-KE')}</Text> */}
                          </View>
                        </View>
                      </View>
                      
                      {!isSelected && maxGuarantee > 0 && selectedGuarantors.length < 3 && (
                        <TouchableOpacity 
                          style={styles.selectGuarantorBtn}
                          onPress={() => {
                            const defaultAmount = Math.min(maxGuarantee, requiredGuaranteeAmount - currentGuaranteeTotal);
                            addGuarantor(guarantor, defaultAmount);
                          }}
                        >
                          <Text style={styles.selectGuarantorText}>Select</Text>
                        </TouchableOpacity>
                      )}
                      
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>Selected</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity 
              onPress={getMlDecision} 
              style={[styles.mlAssessmentBtn, !isGuaranteeRequirementMet() && styles.mlAssessmentBtnDisabled]}
              disabled={!isGuaranteeRequirementMet()}
            >
              <Text style={styles.mlAssessmentText}>
                {isGuaranteeRequirementMet() ? '🤖 Proceed to AI Assessment' : '⚠️ Add More Guarantors'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* STAGE 3: ML Decision Results Modal - UPDATED with side-by-side buttons */}
      <Modal visible={mlDecisionModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.mlDecisionCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.mlDecisionTitle}>🤖 AI Loan Decision</Text>
              <TouchableOpacity onPress={() => setMlDecisionModalVisible(false)} style={styles.closeXButton}>
                <Text style={styles.closeXText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {mlDecision && (
              <ScrollView style={styles.mlDecisionScrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.mlDecisionResult}>
                  <Text style={[styles.mlDecisionRecommendation, { 
                    color: mlDecision.finalRecommendation === 'APPROVE' ? '#4CAF50' : 
                           mlDecision.finalRecommendation?.includes('CAUTION') ? '#FF9800' : '#F44336' 
                  }]}>
                    {mlDecision.finalRecommendation === 'APPROVE' ? '✅ APPROVED' :
                     mlDecision.finalRecommendation?.includes('CAUTION') ? '⚠️ APPROVE WITH MONITORING' : '❌ REJECTED'}
                  </Text>
                  
                  <Text style={styles.mlDecisionConfidence}>
                    Confidence: {(mlDecision.finalConfidence * 100).toFixed(1)}%
                  </Text>

                  <View style={styles.mlDecisionDetails}>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>Requested Amount:</Text>
                      <Text style={styles.mlDecisionValue}>KES {mlDecision.loanAmountRequested?.toLocaleString('en-KE')}</Text>
                    </View>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>Maximum Eligible:</Text>
                      <Text style={[styles.mlDecisionValue, { color: '#2196F3', fontWeight: 'bold' }]}>
                        KES {mlDecision.eligibilityAmount?.toLocaleString('en-KE')}
                      </Text>
                    </View>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>Risk Level:</Text>
                      <Text style={[styles.mlDecisionValue, { color: getRiskColor(mlDecision.loanRisk) }]}>
                        {mlDecision.loanRisk}
                      </Text>
                    </View>
                    <View style={styles.mlDecisionRow}>
                      <Text style={styles.mlDecisionLabel}>AI Interest Rate:</Text>
                      <Text style={[styles.mlDecisionValue, { color: '#2196F3', fontWeight: 'bold', fontSize: 18 }]}>
                        {calculateMlBasedInterestRate(mlDecision)}%
                      </Text>
                    </View>
                    
                    {mlDecision.recommendedRepaymentMonths && (
                      <View style={styles.mlDecisionRow}>
                        <Text style={styles.mlDecisionLabel}>AI Recommended Term:</Text>
                        <Text style={[styles.mlDecisionValue, { color: '#4CAF50', fontWeight: 'bold', fontSize: 18 }]}>
                          {mlDecision.recommendedRepaymentMonths} months
                        </Text>
                      </View>
                    )}
                    
                    {mlDecision.repaymentTermBreakdown && mlDecision.repaymentTermBreakdown.length > 0 && (
                      <View style={styles.termBreakdownContainer}>
                        <Text style={styles.termBreakdownTitle}>📅 Term Calculation:</Text>
                        {mlDecision.repaymentTermBreakdown.slice(0, 4).map((line, idx) => (
                          <Text key={idx} style={styles.termBreakdownLine}>{line}</Text>
                        ))}
                      </View>
                    )}
                    
                    {mlDecision.interestRateBreakdown && mlDecision.interestRateBreakdown.length > 0 && (
                      <View style={styles.rateBreakdownContainer}>
                        <Text style={styles.rateBreakdownTitle}>📊 Rate Breakdown:</Text>
                        {mlDecision.interestRateBreakdown.slice(0, 5).map((line, idx) => (
                          <Text key={idx} style={styles.rateBreakdownLine}>
                            {line.includes('⭐') ? '✨ ' : '   '}{line.replace('⭐', '').trim()}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Guarantor Summary in ML Decision */}
                  <View style={styles.guarantorSummaryCard}>
                    <Text style={styles.guarantorSummaryTitle}>👥 Guarantor Summary</Text>
                    <Text style={styles.guarantorSummaryText}>
                      Selected Guarantors: {selectedGuarantors.length}
                    </Text>
                    <Text style={styles.guarantorSummaryText}>
                      Total Guarantee Amount: KES {currentGuaranteeTotal.toLocaleString('en-KE')}
                    </Text>
                    <Text style={styles.guarantorSummaryText}>
                      Requirement Met: {isGuaranteeRequirementMet() ? '✅ Yes' : '❌ No'}
                    </Text>
                  </View>

                  <View style={styles.mlDecisionReasoning}>
                    <Text style={styles.mlDecisionReasoningTitle}>AI Reasoning:</Text>
                    <Text style={styles.mlDecisionReasoningText}>{mlDecision.decisionReasoning}</Text>
                  </View>

                  {/* Action Buttons Row - Side by Side */}
                  <View style={styles.actionButtonsRow}>
                    {mlDecision.detailedExplanations && (
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.detailsButtonAction]} 
                        onPress={() => setDetailedExplanationsModalVisible(true)}
                      >
                        <Text style={styles.detailsButtonActionText}>📊 View Detailed Analysis</Text>
                      </TouchableOpacity>
                    )}
                    
                    {(mlDecision.finalRecommendation === 'APPROVE' || mlDecision.finalRecommendation?.includes('CAUTION')) && (
                      <TouchableOpacity 
                        onPress={createLoanFromMlDecision} 
                        style={[styles.actionButton, styles.createLoanButtonAction]} 
                        disabled={isSubmittingLoan}
                      >
                        <Text style={styles.createLoanButtonActionText}>
                          {isSubmittingLoan ? 'Creating...' : '🎉 Create Loan'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Detailed Explanations Modal */}
      <Modal visible={detailedExplanationsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailedModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.detailedModalTitle}>📊 Detailed Analysis</Text>
              <TouchableOpacity onPress={() => setDetailedExplanationsModalVisible(false)} style={styles.closeXButton}>
                <Text style={styles.closeXText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {mlDecision?.detailedExplanations && (
              <ScrollView style={styles.detailedScrollView}>
                {mlDecision.detailedExplanations.explanations.map((exp, index) => (
                  <View key={index} style={styles.explanationCard}>
                    <Text style={styles.explanationCategory}>{exp.category}</Text>
                    <Text style={styles.explanationDecision}>Decision: {exp.decision}</Text>
                    <Text style={styles.explanationReason}>Reason: {exp.reason}</Text>
                    <Text style={styles.explanationFactor}>Key Factor: {exp.keyFactor}</Text>
                    <Text style={[styles.explanationImpact, { 
                      color: exp.impact === 'Positive' ? '#4CAF50' : 
                             exp.impact === 'Negative' ? '#F44336' : 
                             exp.impact === 'Critical' ? '#D32F2F' : '#666' 
                    }]}>Impact: {exp.impact}</Text>
                  </View>
                ))}
                
                {mlDecision.detailedExplanations.summary && (
                  <View style={styles.summaryAnalysisCard}>
                    <Text style={styles.summaryAnalysisTitle}>🎯 Final Summary</Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Recommendation: </Text>
                      {mlDecision.detailedExplanations.summary.keyRecommendation}
                    </Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Primary Reason: </Text>
                      {mlDecision.detailedExplanations.summary.primaryReason}
                    </Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Interest Rate: </Text>
                      {mlDecision.detailedExplanations.summary.interestRateJustification}
                    </Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Recommended Term: </Text>
                      {mlDecision.recommendedRepaymentMonths || 'N/A'} months
                    </Text>
                    <Text style={styles.summaryAnalysisItem}>
                      <Text style={styles.summaryAnalysisLabel}>Confidence Level: </Text>
                      {mlDecision.detailedExplanations.summary.confidenceLevel}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Loan Schedule Modal */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.scheduleModalOverlay}>
          <View style={styles.scheduleModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.scheduleModalTitle}>Loan Schedule</Text>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)} style={styles.closeXButton}>
                <Text style={styles.closeXText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedLoan && (
              <View style={styles.loanDetailsHeader}>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Member's Name:</Text>
                  <Text style={styles.loanDetailValue}>
                    {selectedLoan.member?.firstName} {selectedLoan.member?.lastName}
                  </Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Start Date:</Text>
                  <Text style={styles.loanDetailValue}>{selectedLoan.startDate}</Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>End Date:</Text>
                  <Text style={styles.loanDetailValue}>{selectedLoan.dueDate}</Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Loan Amount:</Text>
                  <Text style={styles.loanDetailValue}>KES {selectedLoan.amount.toLocaleString('en-KE')}</Text>
                </View>
                <View style={styles.loanDetailRow}>
                  <Text style={styles.loanDetailLabel}>Repayment Term:</Text>
                  <Text style={styles.loanDetailValue}>{selectedLoan.repaymentMonths || 6} months</Text>
                </View>
                {selectedLoan.isMlApproved && (
                  <>
                    <View style={styles.loanDetailRow}>
                      <Text style={styles.loanDetailLabel}>AI Approved:</Text>
                      <Text style={[styles.loanDetailValue, { color: '#4CAF50' }]}>Yes 🤖</Text>
                    </View>
                    <View style={styles.loanDetailRow}>
                      <Text style={styles.loanDetailLabel}>Risk Level:</Text>
                      <Text style={[styles.loanDetailValue, { color: getRiskColor(selectedLoan.mlRiskLevel || '') }]}>
                        {selectedLoan.mlRiskLevel}
                      </Text>
                    </View>
                  </>
                )}
                {selectedLoan.guarantor && (
                  <View style={styles.loanDetailRow}>
                    <Text style={styles.loanDetailLabel}>Guarantor:</Text>
                    <Text style={styles.loanDetailValue}>
                      {selectedLoan.guarantor.firstName} {selectedLoan.guarantor.lastName}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.scheduleTableContainer}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.scheduleHeaderCell}>Period</Text>
                <Text style={styles.scheduleHeaderCell}>Month</Text>
                <Text style={styles.scheduleHeaderCell}>Principal</Text>
                <Text style={styles.scheduleHeaderCell}>Int %</Text>
                <Text style={styles.scheduleHeaderCell}>Int Amt</Text>
                <Text style={styles.scheduleHeaderCell}>Monthly Repayment</Text>
                <Text style={styles.scheduleHeaderCell}>Balance</Text>
              </View>
              <FlatList
                data={loanSchedule}
                keyExtractor={(item) => item.period.toString()}
                renderItem={({ item }) => <LoanScheduleRow item={item} />}
                style={styles.scheduleList}
              />
            </View>
          </View>
        </View>
      </Modal>

      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

// --- STYLESHEET ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },
  scrollContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F5E9' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#388E3C' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#C8E6C9', paddingHorizontal: 20, paddingVertical: 15 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 30, height: 30, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 20, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#1B5E20' },
  contributionsButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  contributionsButtonText: { color: '#388E3C', fontWeight: 'bold' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  
  contentContainer: { paddingHorizontal: 20, paddingTop: 20 },
  titleSection: { backgroundColor: '#C8E6C9', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleTextContainer: { flex: 1 },
  titleText: { fontSize: 22, fontWeight: 'bold', color: '#1B5E20' },
  subtitleText: { fontSize: 14, color: '#388E3C', marginTop: 5 },
  logsButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginLeft: 15 },
  logsButtonText: { color: '#388E3C', fontWeight: 'bold', fontSize: 13 },
  
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  contributionsCard: { backgroundColor: '#FFFFFF', borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  aiEligibilityCard: { backgroundColor: '#F8F9FF', borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardIcon: { fontSize: 20, marginRight: 8 },
  summaryCardLabel: { fontSize: 14, color: '#666', fontWeight: '600', textAlign: 'center' },
  summaryCardValue: { fontSize: 20, fontWeight: 'bold', color: '#1B5E20', marginBottom: 8 },
  aiApprovedAmount: { fontSize: 18, fontWeight: 'bold', color: '#2196F3', marginBottom: 6 },
  aiReadyText: { fontSize: 16, fontWeight: '600', color: '#666', marginBottom: 8, textAlign: 'center' },
  eligibilityBadge: { backgroundColor: '#E8F5E8', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  eligibilityBadgeText: { fontSize: 12, fontWeight: '600', color: '#2E7D32' },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 6 },
  riskBadgeText: { fontSize: 12, fontWeight: '600' },
  confidenceText: { fontSize: 11, color: '#666', fontStyle: 'italic' },
  aiFeatures: { alignSelf: 'stretch', marginTop: 4 },
  aiFeature: { fontSize: 11, color: '#666', marginBottom: 2 },
  
  aiInfoCard: { backgroundColor: '#E3F2FD', padding: 15, borderRadius: 8, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  aiInfoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1976D2', marginBottom: 5 },
  aiInfoText: { fontSize: 14, color: '#424242', lineHeight: 18 },
  
  filterRow: { flexGrow: 0, marginBottom: 10, paddingVertical: 5 },
  filterBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0E0E0', marginHorizontal: 5 },
  filterText: { color: '#555', fontWeight: 'bold', fontSize: 12 },
  activeFilter: { backgroundColor: '#388E3C' },
  activeFilterText: { color: '#FFFFFF' },
  
  tableContainer: { paddingHorizontal: 0, backgroundColor: '#E8F5E9', marginHorizontal: 10, marginBottom: 20 },
  tableHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#388E3C', paddingVertical: 12, paddingHorizontal: 5, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  tableHeaderCell: { flex: 1, color: '#FFFFFF', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tableCell: { flex: 1, fontSize: 11, color: '#333', textAlign: 'center' },
  amountCell: { fontWeight: 'bold', color: '#1B5E20' },
  empty: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
  
  fab: { position: 'absolute', right: 20, bottom: 150, backgroundColor: '#2196F3', width: 120, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, zIndex: 1000 },
  fabIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginRight: 5 },
  fabText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 10, width: '90%', padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 15 },
  closeXButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  closeXText: { fontSize: 18, fontWeight: 'bold', color: '#666' },
  modalInfoCard: { backgroundColor: '#f0f9f3', padding: 15, borderRadius: 8, marginBottom: 15 },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  modalInfoLabel: { fontSize: 14, color: '#666' },
  modalInfoValue: { fontSize: 14, fontWeight: 'bold', color: '#388E3C' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, marginBottom: 10 },
  helperText: { fontSize: 11, color: '#666', marginBottom: 8, textAlign: 'center' },
  mlAssessmentBtn: { backgroundColor: '#2196F3', padding: 12, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  mlAssessmentBtnDisabled: { backgroundColor: '#ccc' },
  mlAssessmentText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  
  // Guarantor Selection Styles
  guaranteeRequirementCard: { backgroundColor: '#FFF3E0', padding: 15, borderRadius: 8, marginBottom: 15 },
  guaranteeRequirementTitle: { fontSize: 16, fontWeight: 'bold', color: '#E65100', marginBottom: 8 },
  guaranteeRequirementText: { fontSize: 13, color: '#666', marginBottom: 10 },
  guaranteeProgressContainer: { marginTop: 5 },
  guaranteeProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  guaranteeProgressLabel: { fontSize: 13, color: '#666' },
  guaranteeProgressValue: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  progressBarContainer: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginVertical: 8, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  guaranteeStatusText: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 5 },
  
  selectedGuarantorsCard: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginBottom: 15 },
  selectedGuarantorsTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 },
  selectedGuarantorItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8 },
  selectedGuarantorInfo: { flex: 1 },
  selectedGuarantorName: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  guaranteeAmountInputContainer: { flexDirection: 'row', alignItems: 'center' },
  guaranteeAmountLabel: { fontSize: 14, fontWeight: 'bold', color: '#388E3C', marginRight: 8 },
  guaranteeAmountInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 5, width: 100, textAlign: 'center' },
  removeGuarantorBtn: { backgroundColor: '#FFEBEE', padding: 8, borderRadius: 20 },
  removeGuarantorText: { color: '#F44336', fontSize: 16, fontWeight: 'bold' },
  
  searchInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 15, fontSize: 14 },
  guarantorsList: { maxHeight: 400 },
  guarantorLoader: { padding: 20 },
  noGuarantorsText: { textAlign: 'center', color: '#999', padding: 20 },
  guarantorCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  guarantorCardSelected: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  guarantorInfo: { flex: 1, flexDirection: 'row' },
  guarantorAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  guarantorAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  guarantorDetails: { flex: 1 },
  guarantorName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  guarantorEmail: { fontSize: 12, color: '#666', marginBottom: 2 },
  guarantorPhone: { fontSize: 12, color: '#666', marginBottom: 5 },
  guarantorCapacityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  guarantorCapacityLabel: { fontSize: 12, color: '#666' },
  guarantorCapacityValue: { fontSize: 12, fontWeight: 'bold', color: '#388E3C' },
  guarantorStatsRow: { marginTop: 4 },
  guarantorStat: { fontSize: 10, color: '#999', marginBottom: 2 },
  selectGuarantorBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignSelf: 'center' },
  selectGuarantorText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  selectedBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, alignSelf: 'center' },
  selectedBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  // ML Decision Modal Styles - UPDATED
  mlDecisionCard: { backgroundColor: '#fff', borderRadius: 10, width: '90%', maxHeight: '80%', padding: 16 },
  mlDecisionScrollView: { maxHeight: '85%' },
  mlDecisionTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center' },
  mlDecisionResult: { marginBottom: 8 },
  mlDecisionRecommendation: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  mlDecisionConfidence: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 12 },
  mlDecisionDetails: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 10 },
  mlDecisionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mlDecisionLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  mlDecisionValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  mlDecisionReasoning: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginBottom: 12 },
  mlDecisionReasoningTitle: { fontSize: 14, fontWeight: 'bold', color: '#1976D2', marginBottom: 5 },
  mlDecisionReasoningText: { fontSize: 14, color: '#424242', lineHeight: 18 },
  
  // Action Buttons Row - Side by Side
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  detailsButtonAction: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  
  detailsButtonActionText: {
    color: '#1976D2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  createLoanButtonAction: {
    backgroundColor: '#4CAF50',
  },
  
  createLoanButtonActionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  guarantorSummaryCard: { backgroundColor: '#FFF8E1', padding: 12, borderRadius: 8, marginBottom: 12 },
  guarantorSummaryTitle: { fontSize: 14, fontWeight: 'bold', color: '#F57C00', marginBottom: 5 },
  guarantorSummaryText: { fontSize: 13, color: '#666', marginBottom: 3 },
  
  termBreakdownContainer: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 8 },
  termBreakdownTitle: { fontSize: 13, fontWeight: 'bold', color: '#388E3C', marginBottom: 8 },
  termBreakdownLine: { fontSize: 11, color: '#555', marginBottom: 3 },
  
  rateBreakdownContainer: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 8 },
  rateBreakdownTitle: { fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  rateBreakdownLine: { fontSize: 11, color: '#555', marginBottom: 3, fontFamily: 'monospace' },
  
  detailsButton: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#2196F3' },
  detailsButtonText: { color: '#1976D2', fontWeight: 'bold', fontSize: 14 },
  createLoanBtn: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 5, alignItems: 'center', marginBottom: 10 },
  createLoanText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  
  detailedModalCard: { backgroundColor: '#fff', borderRadius: 10, width: '95%', maxHeight: '80%', padding: 20 },
  detailedModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1976D2', flex: 1, textAlign: 'center' },
  detailedScrollView: { maxHeight: 400 },
  explanationCard: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  explanationCategory: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  explanationDecision: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 3 },
  explanationReason: { fontSize: 14, color: '#666', marginBottom: 3 },
  explanationFactor: { fontSize: 14, fontStyle: 'italic', color: '#777', marginBottom: 3 },
  explanationImpact: { fontSize: 14, fontWeight: 'bold' },
  summaryAnalysisCard: { backgroundColor: '#f0f7ff', padding: 15, borderRadius: 8, marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  summaryAnalysisTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976D2', marginBottom: 10, textAlign: 'center' },
  summaryAnalysisItem: { fontSize: 14, color: '#333', marginBottom: 8, lineHeight: 20 },
  summaryAnalysisLabel: { fontWeight: 'bold', color: '#555' },
  
  scheduleModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  scheduleModalCard: { backgroundColor: '#fff', borderRadius: 10, width: '95%', height: '90%', padding: 20 },
  scheduleModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1B5E20', flex: 1, textAlign: 'center' },
  loanDetailsHeader: { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 5, marginBottom: 15 },
  loanDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  loanDetailLabel: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  loanDetailValue: { fontSize: 12, color: '#666' },
  scheduleTableContainer: { flex: 1 },
  scheduleHeader: { flexDirection: 'row', backgroundColor: '#388E3C', paddingVertical: 8 },
  scheduleHeaderCell: { flex: 1, color: '#FFFFFF', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  scheduleList: { flex: 1 },
  scheduleRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingVertical: 8 },
  scheduleCell: { flex: 1, fontSize: 11, color: '#333', textAlign: 'center' },
  
  payButton: { backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignItems: 'center' },
  payButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  paidLabel: { fontSize: 11, color: '#1B5E20', fontWeight: '600', textAlign: 'center' },
  pendingLabel: { fontSize: 11, color: '#FF9800', fontWeight: '600', textAlign: 'center' },
});
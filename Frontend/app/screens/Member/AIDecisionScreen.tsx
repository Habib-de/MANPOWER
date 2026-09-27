import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  RefreshControl,
  LogBox,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import MemberBottomNav from '../../components/MemberBottomNav';

// Suppress warnings
LogBox.ignoreLogs(['Unexpected text node', 'aria-hidden']);

// Use the SAME IP as your login screen (192.168.0.101)
const BASE_URL = 'http://192.168.0.101:8080/api';
const ORCHESTRATOR_URL = 'http://192.168.0.101:5000/api/v1';

// ✅ UPDATED: DecisionLog interface with per-application rate fields
interface DecisionLog {
  id: number;
  memberId: string;
  memberName?: string;
  requestedAmount: number;
  loanReason: string;
  finalRecommendation: string;
  finalConfidence: number;
  decisionReasoning: string;
  
  eligibilityAmount: number;
  eligibilityConfidence: number;
  
  loanRisk: string;
  riskProbability: number;
  riskConfidence: number;
  
  sentimentRisk: string;
  sentimentConfidence: number;
  
  contributionDisciplineScore?: number;
  contributionDisciplineLevel?: string;
  hasPendingContributions?: boolean;
  hasOverdueContributions?: boolean;
  pendingContributionCount?: number;
  overdueContributionCount?: number;
  totalPendingAmount?: number;
  totalOverdueAmount?: number;
  totalPenalties?: number;
  contributionFlags?: string[];
  
  memberStatus: string;
  memberRole: string;
  membershipMonths: number;
  
  // ✅ NEW: Per-application interest rate fields
  interestRate?: number;
  interestRateBreakdown?: string[];
  eligibilityUsagePercentage?: number;
  
  requiresGuarantor?: boolean;
  dataSource: string;
  processedAt: string;
  
  loanStatus?: string;
  loanId?: string;
}

// Cache for discipline data (same as group admin)
const disciplineCache: Record<string, any> = {};

export default function MemberDecisionLogsScreen() {
  const router = useRouter();
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DecisionLog | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>('');

  const getDisciplineColor = (score?: number, level?: string) => {
    if (level === 'EXCELLENT' || (score && score >= 80)) return '#4CAF50';
    if (level === 'GOOD' || (score && score >= 65)) return '#8BC34A';
    if (level === 'FAIR' || (score && score >= 50)) return '#FFC107';
    if (level === 'POOR' || (score && score >= 35)) return '#FF9800';
    return '#F44336';
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'VERY LOW': case 'VERY_LOW': return '#4CAF50';
      case 'LOW': return '#8BC34A';
      case 'MEDIUM': return '#FFC107';
      case 'HIGH': return '#FF9800';
      case 'VERY HIGH': case 'VERY_HIGH': return '#F44336';
      default: return '#666';
    }
  };

  const getDecisionColor = (decision: string) => {
    if (decision?.includes('REJECT')) return '#F44336';
    if (decision?.includes('CAUTION')) return '#FF9800';
    if (decision?.includes('APPROVE')) return '#4CAF50';
    return '#666';
  };

  // ✅ UPDATED: Get interest rate - prioritize backend rate with breakdown support
  const getInterestRate = (log: DecisionLog): string => {
    // Priority 1: Use interest rate from backend
    if (log.interestRate && log.interestRate > 0) {
      return `${log.interestRate}%`;
    }
    // Priority 2: Fallback based on risk level
    const risk = log.loanRisk?.toUpperCase() || '';
    if (risk.includes('VERY LOW')) return '7.5%';
    if (risk.includes('LOW')) return '9.0%';
    if (risk.includes('MEDIUM')) return '10.0%';
    if (risk.includes('HIGH')) return '13.0%';
    if (risk.includes('VERY HIGH')) return '15.0%';
    return '10.0%';
  };

  // ✅ NEW: Get usage color based on percentage
  const getUsageColor = (usagePercent?: number): string => {
    if (!usagePercent) return '#666';
    if (usagePercent > 80) return '#F44336';
    if (usagePercent > 60) return '#FF9800';
    if (usagePercent > 40) return '#FFC107';
    return '#4CAF50';
  };

  // Fetch contribution discipline (same as group admin)
  const fetchMemberContributionDiscipline = async (mId: string) => {
    if (disciplineCache[mId]) return disciplineCache[mId];
    
    try {
      const res = await fetch(`${BASE_URL}/contributions/member/${mId}`);
      if (!res.ok) return null;
      
      const contributions = await res.json();
      
      const pending = contributions.filter((c: any) => c.status === 'Pending');
      const completed = contributions.filter((c: any) => c.status === 'Completed');
      const overdue = pending.filter((c: any) => {
        const dueDate = c.dueDate || c.due_date || c.transactionDate;
        return dueDate && new Date(dueDate) < new Date();
      });
      
      const pendingCount = pending.length;
      const overdueCount = overdue.length;
      const totalPending = pending.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
      const totalPenalties = contributions.reduce((sum: number, c: any) => sum + (c.penaltyApplied || c.penalty_applied || 0), 0);
      const completionRate = contributions.length > 0 ? completed.length / contributions.length : 0;
      
      const sortedCompleted = completed.sort((a: any, b: any) => 
        new Date(b.transactionDate || b.transaction_date).getTime() - 
        new Date(a.transactionDate || a.transaction_date).getTime()
      );
      const lastDate = sortedCompleted[0]?.transactionDate || sortedCompleted[0]?.transaction_date;
      const daysSinceLast = lastDate 
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      
      const latePayments = completed.filter((c: any) => {
        const payDate = c.paymentDate || c.payment_date;
        const dueDate = c.dueDate || c.due_date;
        return payDate && dueDate && new Date(payDate) > new Date(dueDate);
      }).length;
      
      const flags: string[] = [];
      if (pendingCount > 0) flags.push(`${pendingCount} pending (KES ${totalPending.toLocaleString()})`);
      if (overdueCount > 0) flags.push(`${overdueCount} overdue contributions`);
      if (totalPenalties > 0) flags.push(`Penalties: KES ${totalPenalties.toLocaleString()}`);
      if (daysSinceLast > 90) flags.push(`No contribution for ${daysSinceLast} days`);
      
      let score = 70;
      if (completionRate >= 0.9) score += 15;
      else if (completionRate >= 0.8) score += 10;
      else if (completionRate >= 0.7) score += 5;
      const totalCompleted = completed.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
      if (totalCompleted > 50000) score += 10;
      else if (totalCompleted > 20000) score += 5;
      if (completed.length > 12) score += 10;
      else if (completed.length > 6) score += 5;
      if (daysSinceLast <= 30) score += 10;
      else if (daysSinceLast <= 60) score += 5;
      if (latePayments === 0 && completed.length > 0) score += 5;
      
      if (pendingCount > 0) score -= Math.min(15, pendingCount * 5);
      if (overdueCount > 0) score -= Math.min(30, overdueCount * 10);
      if (totalPenalties > 1000) score -= Math.min(15, Math.floor(totalPenalties / 1000));
      else if (totalPenalties > 100) score -= 3;
      if (completionRate < 0.3) score -= 20;
      else if (completionRate < 0.5) score -= 10;
      if (daysSinceLast > 180) score -= 20;
      else if (daysSinceLast > 90) score -= 10;
      else if (daysSinceLast > 60) score -= 5;
      if (latePayments > 5) score -= 15;
      else if (latePayments > 3) score -= 8;
      else if (latePayments > 0) score -= 3;
      
      score = Math.max(0, Math.min(100, score));
      
      let level = 'UNKNOWN';
      if (score >= 80) level = 'EXCELLENT';
      else if (score >= 65) level = 'GOOD';
      else if (score >= 50) level = 'FAIR';
      else if (score >= 35) level = 'POOR';
      else level = 'CRITICAL';
      
      const result = {
        pendingCount, overdueCount, totalPending, totalPenalties, flags, score, level
      };
      
      disciplineCache[mId] = result;
      return result;
    } catch (e) {
      return null;
    }
  };

  // Get member data from AsyncStorage
  const loadMemberData = async () => {
    try {
      const mId = await AsyncStorage.getItem('userId');
      const firstName = await AsyncStorage.getItem('userFirstName') || '';
      const lastName = await AsyncStorage.getItem('userLastName') || '';
      const role = await AsyncStorage.getItem('userRole');
      
      console.log('📱 Loaded member data:', { mId, firstName, lastName, role });
      
      if (!mId) {
        console.error('No userId found in AsyncStorage');
        router.replace('/(auth)');
        return false;
      }
      
      setMemberId(mId);
      setMemberName(`${firstName} ${lastName}`.trim() || 'Member');
      return true;
    } catch (error) {
      console.error('Error loading member data:', error);
      return false;
    }
  };

  // Fetch logs with fallback
  const fetchDecisionLogs = async () => {
    if (!memberId) {
      console.log('No memberId, skipping fetch');
      return;
    }
    
    setLoading(true);
    console.log('🔍 Fetching decision logs for member:', memberId);
    
    try {
      let logs: DecisionLog[] = [];
      
      // Try orchestrator first
      try {
        const orchRes = await fetch(`${ORCHESTRATOR_URL}/debug/decisions/all`);
        if (orchRes.ok) {
          const allLogs = await orchRes.json();
          logs = allLogs.filter((log: DecisionLog) => log.memberId === memberId);
          console.log(`✅ Orchestrator: Found ${logs.length} logs`);
        } else {
          console.log('Orchestrator returned:', orchRes.status);
          throw new Error('Orchestrator failed');
        }
      } catch (orchError) {
        console.log('Orchestrator error, trying Spring Boot:', orchError);
        
        // Fallback to Spring Boot
        const springRes = await fetch(`${BASE_URL}/loan-decision-log`);
        if (springRes.ok) {
          const allLogs = await springRes.json();
          logs = allLogs.filter((log: DecisionLog) => log.memberId === memberId);
          console.log(`✅ Spring Boot: Found ${logs.length} logs`);
        } else {
          throw new Error('Both endpoints failed');
        }
      }
      
      if (logs.length === 0) {
        console.log('No decision logs found for member');
        setDecisionLogs([]);
        setLoading(false);
        return;
      }
      
      // Enrich with discipline data (using cache for performance)
      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          const discipline = await fetchMemberContributionDiscipline(log.memberId);
          
          if (discipline) {
            return {
              ...log,
              memberName: memberName,
              contributionDisciplineScore: discipline.score,
              contributionDisciplineLevel: discipline.level,
              pendingContributionCount: discipline.pendingCount,
              overdueContributionCount: discipline.overdueCount,
              totalPendingAmount: discipline.totalPending,
              totalPenalties: discipline.totalPenalties,
              contributionFlags: discipline.flags,
              hasPendingContributions: discipline.pendingCount > 0,
              hasOverdueContributions: discipline.overdueCount > 0,
            };
          }
          return { ...log, memberName };
        })
      );
      
      // Sort by date (newest first)
      enrichedLogs.sort((a, b) => 
        new Date(b.processedAt || '').getTime() - new Date(a.processedAt || '').getTime()
      );
      
      console.log(`✅ Final: ${enrichedLogs.length} enriched logs ready`);
      setDecisionLogs(enrichedLogs);
      
    } catch (err) {
      console.error('Error fetching decision logs:', err);
      setDecisionLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDecisionLogs();
    setRefreshing(false);
  }, [memberId]);

  // Load member data on mount
  useEffect(() => {
    const init = async () => {
      const success = await loadMemberData();
      if (success) {
        await fetchDecisionLogs();
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (memberId) {
        fetchDecisionLogs();
      }
    }, [memberId])
  );

  const showDetail = (log: DecisionLog) => {
    setSelectedLog(log);
    setIsDetailModalVisible(true);
  };

  const renderLogCard = (log: DecisionLog, index: number) => {
    const decisionColor = getDecisionColor(log.finalRecommendation);
    const disciplineColor = getDisciplineColor(log.contributionDisciplineScore, log.contributionDisciplineLevel);
    const riskColor = getRiskColor(log.loanRisk);
    const usageColor = getUsageColor(log.eligibilityUsagePercentage);
    
    return (
      <TouchableOpacity key={log.id || index} style={styles.logCard} onPress={() => showDetail(log)}>
        <View style={styles.logCardHeader}>
          <View style={[styles.decisionBadge, { backgroundColor: decisionColor + '20' }]}>
            <Text style={[styles.decisionBadgeText, { color: decisionColor }]}>
              {log.finalRecommendation?.replace('_', ' ') || 'UNKNOWN'}
            </Text>
          </View>
          <Text style={styles.logDate}>
            {log.processedAt ? new Date(log.processedAt).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
        
        <View style={styles.logCardBody}>
          <Text style={styles.logAmount}>
            💰 KES {log.requestedAmount?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.logReason} numberOfLines={2}>
            📝 {log.loanReason || 'No reason provided'}
          </Text>
        </View>
        
        {/* ✅ NEW: Show usage percentage if available */}
        {log.eligibilityUsagePercentage !== undefined && (
          <View style={styles.usageRow}>
            <Text style={[styles.usageText, { color: usageColor }]}>
              📊 Used {log.eligibilityUsagePercentage}% of eligibility limit
            </Text>
          </View>
        )}
        
        <View style={styles.scoresRow}>
          <View style={[styles.scoreBadge, { backgroundColor: disciplineColor + '20' }]}>
            <Text style={[styles.scoreBadgeText, { color: disciplineColor }]}>
              📊 {log.contributionDisciplineLevel || 'N/A'}
              {log.contributionDisciplineScore ? ` (${log.contributionDisciplineScore})` : ''}
            </Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: riskColor + '20' }]}>
            <Text style={[styles.scoreBadgeText, { color: riskColor }]}>
              ⚠️ {log.loanRisk || 'N/A'}
            </Text>
          </View>
        </View>
        
        {log.loanStatus && (
          <View style={styles.loanStatusRow}>
            <Text style={styles.loanStatusText}>
              📋 Loan: {log.loanStatus}
            </Text>
          </View>
        )}
        
        {log.contributionFlags && log.contributionFlags.length > 0 && (
          <View style={styles.flagsRow}>
            {log.contributionFlags.slice(0, 2).map((flag, i) => (
              <Text key={i} style={styles.flagText} numberOfLines={1}>🚩 {flag}</Text>
            ))}
          </View>
        )}
        
        <View style={styles.logCardFooter}>
          <Text style={styles.footerText}>💹 Interest: {getInterestRate(log)}</Text>
          <Text style={styles.footerText}>🎯 Confidence: {((log.finalConfidence || 0) * 100).toFixed(0)}%</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const approvedCount = decisionLogs.filter(l => l.finalRecommendation === 'APPROVE').length;
  const rejectedCount = decisionLogs.filter(l => l.finalRecommendation === 'REJECT').length;
  const cautionCount = decisionLogs.filter(l => l.finalRecommendation?.includes('CAUTION')).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🤖 My AI Decisions</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeText}>👤 {memberName || 'Member'}</Text>
        <Text style={styles.welcomeSubtext}>Your AI loan decision history</Text>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{decisionLogs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#FF9800' }]}>{cautionCount}</Text>
          <Text style={styles.statLabel}>Caution</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F44336' }]}>{rejectedCount}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* How to improve card */}
      {decisionLogs.length > 0 && decisionLogs.some(l => l.finalRecommendation === 'REJECT' || l.finalRecommendation?.includes('CAUTION')) && (
        <View style={styles.improveCard}>
          <Text style={styles.improveTitle}>💡 How to Improve Approval Chances</Text>
          <Text style={styles.improveText}>• Pay pending contributions on time</Text>
          <Text style={styles.improveText}>• Maintain regular monthly contributions</Text>
          <Text style={styles.improveText}>• Request amounts within your eligibility limit</Text>
          <Text style={styles.improveText}>• Provide clear loan purpose descriptions</Text>
          <Text style={styles.improveText}>• Requesting less than 80% of eligibility gives better rates</Text>
        </View>
      )}

      {/* Logs List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loaderText}>Loading your AI decisions...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {decisionLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>No AI decisions yet</Text>
              <Text style={styles.emptySubtext}>Apply for a loan to see your AI assessment here</Text>
              <TouchableOpacity style={styles.applyButton} onPress={() => router.push('/(member)/loans')}>
                <Text style={styles.applyButtonText}>💰 Apply for Loan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            decisionLogs.map((log, index) => renderLogCard(log, index))
          )}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setIsDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            <ScrollView showsVerticalScrollIndicator={true}>
              <Text style={styles.detailTitle}>📋 Decision Details</Text>
              
              {selectedLog && (
                <>
                  <View style={[styles.detailSection, { backgroundColor: getDecisionColor(selectedLog.finalRecommendation) + '15' }]}>
                    <Text style={styles.detailSectionTitle}>Final Decision</Text>
                    <Text style={[styles.detailDecision, { color: getDecisionColor(selectedLog.finalRecommendation) }]}>
                      {selectedLog.finalRecommendation?.replace('_', ' ') || 'N/A'}
                    </Text>
                    <Text style={styles.detailReason}>{selectedLog.decisionReasoning}</Text>
                    <Text style={styles.detailConfidence}>Confidence: {((selectedLog.finalConfidence || 0) * 100).toFixed(0)}%</Text>
                  </View>

                  <View style={[styles.detailSection, { backgroundColor: getDisciplineColor(selectedLog.contributionDisciplineScore, selectedLog.contributionDisciplineLevel) + '15' }]}>
                    <Text style={styles.detailSectionTitle}>📊 Your Contribution Discipline</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Score:</Text>
                      <Text style={[styles.detailValue, { color: getDisciplineColor(selectedLog.contributionDisciplineScore, selectedLog.contributionDisciplineLevel) }]}>
                        {selectedLog.contributionDisciplineScore != null 
                          ? `${selectedLog.contributionDisciplineScore}/100 (${selectedLog.contributionDisciplineLevel || 'N/A'})`
                          : 'Calculating...'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Pending:</Text>
                      <Text style={styles.detailValue}>{selectedLog.pendingContributionCount || 0} (KES {selectedLog.totalPendingAmount?.toLocaleString() || '0'})</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Overdue:</Text>
                      <Text style={[styles.detailValue, { color: (selectedLog.overdueContributionCount || 0) > 0 ? '#F44336' : '#4CAF50' }]}>
                        {selectedLog.overdueContributionCount || 0}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Penalties:</Text>
                      <Text style={styles.detailValue}>KES {selectedLog.totalPenalties?.toLocaleString() || '0'}</Text>
                    </View>
                    {selectedLog.contributionFlags && selectedLog.contributionFlags.length > 0 && (
                      <View style={styles.flagsContainer}>
                        <Text style={styles.flagsTitle}>⚠️ Flags:</Text>
                        {selectedLog.contributionFlags.map((flag, i) => (
                          <Text key={i} style={styles.flagItem}>• {flag}</Text>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>💰 Eligibility</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Eligible:</Text>
                      <Text style={styles.detailValue}>KES {selectedLog.eligibilityAmount?.toLocaleString() || '0'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Requested:</Text>
                      <Text style={styles.detailValue}>KES {selectedLog.requestedAmount?.toLocaleString() || '0'}</Text>
                    </View>
                    {/* ✅ NEW: Show usage percentage */}
                    {selectedLog.eligibilityUsagePercentage !== undefined && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Limit Used:</Text>
                        <Text style={[styles.detailValue, { color: getUsageColor(selectedLog.eligibilityUsagePercentage), fontWeight: 'bold' }]}>
                          {selectedLog.eligibilityUsagePercentage}%
                          {selectedLog.eligibilityUsagePercentage > 80 && ' ⚠️ Higher rate applies'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.detailSection, { backgroundColor: getRiskColor(selectedLog.loanRisk) + '15' }]}>
                    <Text style={styles.detailSectionTitle}>⚠️ Risk Assessment</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Risk Level:</Text>
                      <Text style={[styles.detailValue, { color: getRiskColor(selectedLog.loanRisk) }]}>
                        {selectedLog.loanRisk || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Probability:</Text>
                      <Text style={styles.detailValue}>{((selectedLog.riskProbability || 0) * 100).toFixed(1)}%</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>📝 Loan Purpose</Text>
                    <Text style={styles.detailReason}>{selectedLog.loanReason || 'N/A'}</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sentiment:</Text>
                      <Text style={styles.detailValue}>{selectedLog.sentimentRisk || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>💹 Interest Rate Details</Text>
                    <Text style={[styles.detailValue, { fontSize: 18, fontWeight: 'bold', color: '#2196F3', marginBottom: 8 }]}>
                      {getInterestRate(selectedLog)}
                    </Text>
                    {/* ✅ NEW: Show rate breakdown if available */}
                    {selectedLog.interestRateBreakdown && selectedLog.interestRateBreakdown.length > 0 && (
                      <View style={styles.rateBreakdownContainer}>
                        <Text style={styles.rateBreakdownTitle}>Rate Breakdown:</Text>
                        {selectedLog.interestRateBreakdown.slice(0, 6).map((line, idx) => (
                          <Text key={idx} style={styles.rateBreakdownLine}>
                            {line.includes('⭐') ? '✨ ' : '   '}{line.replace('⭐', '').trim()}
                          </Text>
                        ))}
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Guarantor Required:</Text>
                      <Text style={[styles.detailValue, { color: selectedLog.requiresGuarantor ? '#FF9800' : '#4CAF50' }]}>
                        {selectedLog.requiresGuarantor ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  </View>

                  {/* ✅ NEW: Loan size impact explanation */}
                  {selectedLog.eligibilityUsagePercentage !== undefined && selectedLog.eligibilityUsagePercentage > 60 && (
                    <View style={styles.impactCard}>
                      <Text style={styles.impactTitle}>💡 Loan Size Impact</Text>
                      <Text style={styles.impactText}>
                        You used {selectedLog.eligibilityUsagePercentage}% of your eligible amount.
                        {selectedLog.eligibilityUsagePercentage > 80 
                          ? ' Higher utilization increases your interest rate. Consider requesting a smaller amount for a better rate next time.'
                          : selectedLog.eligibilityUsagePercentage > 60
                          ? ' Moderate utilization - standard rate applied.'
                          : ' Conservative borrowing helps you get better rates!'}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.closeDetailButton} onPress={() => setIsDetailModalVisible(false)}>
              <Text style={styles.closeDetailButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { paddingRight: 10 },
  backButtonText: { fontSize: 16, color: '#8B5CF6', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  headerSpacer: { width: 60 },
  
  welcomeCard: { backgroundColor: '#8B5CF6', margin: 12, padding: 16, borderRadius: 12, alignItems: 'center' },
  welcomeText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  welcomeSubtext: { fontSize: 13, color: '#E8E0FF', marginTop: 4 },
  
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#FFFFFF', marginHorizontal: 12, borderRadius: 10, marginBottom: 8, elevation: 1 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#8B5CF6' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },
  
  improveCard: { backgroundColor: '#FFF8E1', margin: 12, padding: 14, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  improveTitle: { fontSize: 14, fontWeight: 'bold', color: '#E65100', marginBottom: 6 },
  improveText: { fontSize: 12, color: '#555', marginBottom: 3, paddingLeft: 4 },
  
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 12, fontSize: 14, color: '#8B5CF6' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 80 },
  
  emptyState: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#64748B' },
  emptySubtext: { fontSize: 13, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  applyButton: { marginTop: 20, backgroundColor: '#8B5CF6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  applyButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  
  logCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  decisionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  decisionBadgeText: { fontSize: 12, fontWeight: '700' },
  logDate: { fontSize: 11, color: '#94A3B8' },
  logCardBody: { marginBottom: 8 },
  logAmount: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
  logReason: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  usageRow: { marginBottom: 6 },
  usageText: { fontSize: 11, fontWeight: '500' },
  scoresRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scoreBadgeText: { fontSize: 11, fontWeight: '600' },
  loanStatusRow: { marginBottom: 4 },
  loanStatusText: { fontSize: 11, color: '#2196F3', fontWeight: '500' },
  flagsRow: { marginBottom: 6 },
  flagText: { fontSize: 10, color: '#F44336', marginBottom: 1 },
  logCardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  footerText: { fontSize: 11, color: '#64748B' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  detailModal: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, maxHeight: '85%' },
  detailTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'center' },
  detailSection: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 10 },
  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  detailDecision: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  detailReason: { fontSize: 13, color: '#64748B', marginBottom: 4, lineHeight: 18 },
  detailConfidence: { fontSize: 12, color: '#94A3B8' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: '#64748B' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  flagsContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  flagsTitle: { fontSize: 12, fontWeight: '600', color: '#F44336', marginBottom: 4 },
  flagItem: { fontSize: 11, color: '#F44336', marginLeft: 4, marginBottom: 2 },
  rateBreakdownContainer: { marginTop: 8, padding: 8, backgroundColor: '#F5F5F5', borderRadius: 6 },
  rateBreakdownTitle: { fontSize: 12, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  rateBreakdownLine: { fontSize: 10, color: '#555', marginBottom: 2, fontFamily: 'monospace' },
  impactCard: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginTop: 8, borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  impactTitle: { fontSize: 13, fontWeight: 'bold', color: '#1976D2', marginBottom: 4 },
  impactText: { fontSize: 12, color: '#555', lineHeight: 16 },
  closeDetailButton: { backgroundColor: '#8B5CF6', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  closeDetailButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
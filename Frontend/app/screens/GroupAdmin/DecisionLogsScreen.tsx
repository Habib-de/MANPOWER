import React, { useEffect, useState, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

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
  
  // ✅ NEW: Early repayment tracking
  earlyPaymentCount?: number;
  avgDaysEarly?: number;
  
  requiresGuarantor?: boolean;
  dataSource: string;
  processedAt: string;
  
  loanStatus?: string;
  loanId?: string;
}

// Cache for member names and discipline data
const memberNameCache: Record<string, string> = {};
const disciplineCache: Record<string, any> = {};

export default function DecisionLogsScreen() {
  const router = useRouter();
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DecisionLog | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [groupAdminId, setGroupAdminId] = useState<string | null>(null);
  const [userGroupId, setUserGroupId] = useState<string | null>(null);
  
  const [filterDecision, setFilterDecision] = useState<'ALL' | 'APPROVE' | 'REJECT' | 'APPROVE_WITH_CAUTION'>('ALL');
  const [filterDiscipline, setFilterDiscipline] = useState<'ALL' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL'>('ALL');

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

  // ✅ UPDATED: Get interest rate with priority
  const getInterestRate = (log: DecisionLog): string => {
    if (log.interestRate && log.interestRate > 0) return `${log.interestRate}%`;
    const risk = log.loanRisk?.toUpperCase() || '';
    if (risk.includes('VERY LOW')) return '7.5%';
    if (risk.includes('LOW')) return '9.0%';
    if (risk.includes('MEDIUM')) return '10.0%';
    if (risk.includes('HIGH')) return '13.0%';
    if (risk.includes('VERY HIGH')) return '15.0%';
    return '10.0%';
  };

  // ✅ NEW: Get usage color
  const getUsageColor = (usagePercent?: number): string => {
    if (!usagePercent) return '#666';
    if (usagePercent > 80) return '#F44336';
    if (usagePercent > 60) return '#FF9800';
    if (usagePercent > 40) return '#FFC107';
    return '#4CAF50';
  };

  const fetchMemberName = async (memberId: string): Promise<string> => {
    if (memberNameCache[memberId]) return memberNameCache[memberId];
    try {
      const res = await fetch(`${BASE_URL}/members/${memberId}`);
      if (res.ok) {
        const member = await res.json();
        const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || memberId.substring(0, 8);
        memberNameCache[memberId] = name;
        return name;
      }
    } catch (e) {}
    return memberId.substring(0, 8) + '...';
  };

  // ✅ UPDATED: Fetch contribution discipline with early payment tracking
  const fetchMemberContributionDiscipline = async (memberId: string) => {
    if (disciplineCache[memberId]) return disciplineCache[memberId];
    
    try {
      const res = await fetch(`${BASE_URL}/contributions/member/${memberId}`);
      if (!res.ok) return null;
      
      const contributions = await res.json();
      
      const pending = contributions.filter((c: any) => c.status === 'Pending');
      const completed = contributions.filter((c: any) => c.status === 'Completed');
      const overdue = pending.filter((c: any) => {
        const dueDate = c.dueDate || c.due_date || c.transactionDate;
        return dueDate && new Date(dueDate) < new Date();
      });
      
      // ✅ NEW: Track early payments
      const earlyPayments = completed.filter((c: any) => {
        const payDate = c.paymentDate || c.payment_date;
        const dueDate = c.dueDate || c.due_date;
        return payDate && dueDate && new Date(payDate) < new Date(dueDate);
      });
      
      const earlyPaymentCount = earlyPayments.length;
      const avgDaysEarly = earlyPayments.length > 0
        ? earlyPayments.reduce((sum: number, c: any) => {
            const payDate = new Date(c.paymentDate || c.payment_date);
            const dueDate = new Date(c.dueDate || c.due_date);
            const daysEarly = Math.ceil((dueDate.getTime() - payDate.getTime()) / (1000 * 60 * 60 * 24));
            return sum + daysEarly;
          }, 0) / earlyPayments.length
        : 0;
      
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
      if (pendingCount > 0) flags.push(`HAS_PENDING_CONTRIBUTIONS (${pendingCount} pending, KES ${totalPending.toLocaleString()})`);
      if (overdueCount > 0) flags.push(`HAS_OVERDUE_CONTRIBUTIONS (${overdueCount} overdue)`);
      if (totalPenalties > 0) flags.push(`Penalties: KES ${totalPenalties.toLocaleString()}`);
      if (daysSinceLast > 90) flags.push(`No contribution for ${daysSinceLast} days`);
      if (earlyPaymentCount > 0) flags.push(`✅ Early payer (${earlyPaymentCount} times, avg ${Math.round(avgDaysEarly)} days early)`);
      
      // Calculate discipline score (same as orchestrator)
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
      
      // ✅ NEW: Early payment bonus
      if (earlyPaymentCount > 0) {
        const earlyBonus = Math.min(15, earlyPaymentCount * 3);
        score += earlyBonus;
      }
      if (avgDaysEarly > 7) {
        score += 5;
      }
      
      if (pendingCount > 0) score -= Math.min(15, pendingCount * 5);
      if (overdueCount > 0) score -= Math.min(30, overdueCount * 10);
      if (totalPenalties > 1000) score -= Math.min(15, Math.floor(totalPenalties / 1000));
      else if (totalPenalties > 100) score -= 3;
      if (completionRate < 0.3) score -= 20;
      else if (completionRate < 0.5) score -= 10;
      else if (completionRate < 0.6) score -= 5;
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
        pendingCount, overdueCount, totalPending, totalPenalties,
        completionRate, daysSinceLast, latePayments, flags, score, level,
        earlyPaymentCount, avgDaysEarly
      };
      
      disciplineCache[memberId] = result;
      return result;
    } catch (e) {
      return null;
    }
  };

  const fetchDecisionLogs = async () => {
    setLoading(true);
    try {
      const orchRes = await fetch(`${ORCHESTRATOR_URL}/debug/decisions/all`);
      if (!orchRes.ok) throw new Error('Failed to fetch');
      
      let logs: DecisionLog[] = await orchRes.json();
      
      // Filter by group admin's group members
      if (userGroupId && logs.length > 0) {
        try {
          const groupRes = await fetch(`${BASE_URL}/groups/${userGroupId}`);
          if (groupRes.ok) {
            const group = await groupRes.json();
            const memberIds = new Set<string>();
            if (group.members) {
              group.members.forEach((m: any) => {
                const id = typeof m === 'string' ? m : m.id;
                if (id) memberIds.add(id);
              });
            }
            logs = logs.filter(log => memberIds.has(log.memberId));
          }
        } catch (e) {}
      }
      
      // Fetch member names AND contribution discipline for each log
      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          const memberName = await fetchMemberName(log.memberId);
          const discipline = await fetchMemberContributionDiscipline(log.memberId);
          
          if (discipline) {
            return {
              ...log,
              memberName,
              contributionDisciplineScore: discipline.score,
              contributionDisciplineLevel: discipline.level,
              pendingContributionCount: discipline.pendingCount,
              overdueContributionCount: discipline.overdueCount,
              totalPendingAmount: discipline.totalPending,
              totalOverdueAmount: 0,
              totalPenalties: discipline.totalPenalties,
              contributionFlags: discipline.flags,
              hasPendingContributions: discipline.pendingCount > 0,
              hasOverdueContributions: discipline.overdueCount > 0,
              earlyPaymentCount: discipline.earlyPaymentCount,
              avgDaysEarly: discipline.avgDaysEarly,
            };
          }
          
          return { ...log, memberName };
        })
      );
      
      enrichedLogs.sort((a, b) => 
        new Date(b.processedAt || '').getTime() - new Date(a.processedAt || '').getTime()
      );
      
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
  }, [userGroupId]);

  useEffect(() => {
    const init = async () => {
      const adminId = await AsyncStorage.getItem('userId');
      const groupId = await AsyncStorage.getItem('userGroupId');
      setGroupAdminId(adminId);
      setUserGroupId(groupId);
    };
    init();
  }, []);

  useEffect(() => {
    if (userGroupId) fetchDecisionLogs();
  }, [userGroupId]);

  const getFilteredLogs = () => {
    let filtered = decisionLogs;
    if (filterDecision !== 'ALL') {
      filtered = filtered.filter(log => {
        const decision = log.finalRecommendation?.toUpperCase() || '';
        if (filterDecision === 'APPROVE') return decision === 'APPROVE';
        if (filterDecision === 'REJECT') return decision === 'REJECT';
        if (filterDecision === 'APPROVE_WITH_CAUTION') return decision.includes('CAUTION');
        return true;
      });
    }
    if (filterDiscipline !== 'ALL') {
      filtered = filtered.filter(log => log.contributionDisciplineLevel?.toUpperCase() === filterDiscipline);
    }
    return filtered;
  };

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
          <Text style={styles.logMemberName} numberOfLines={1}>
            👤 {log.memberName || log.memberId?.substring(0, 8) + '...'}
          </Text>
          <Text style={styles.logAmount}>
            💰 KES {log.requestedAmount?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.logReason} numberOfLines={2}>
            📝 {log.loanReason || 'No reason provided'}
          </Text>
        </View>
        
        {/* ✅ NEW: Show usage percentage */}
        {log.eligibilityUsagePercentage !== undefined && (
          <View style={styles.usageRow}>
            <Text style={[styles.usageText, { color: usageColor }]}>
              📊 Used {log.eligibilityUsagePercentage}% of limit
            </Text>
          </View>
        )}
        
        {/* ✅ NEW: Show early payment indicator */}
        {log.earlyPaymentCount && log.earlyPaymentCount > 0 && (
          <View style={styles.earlyBadge}>
            <Text style={styles.earlyBadgeText}>
              ⚡ Early payer: {log.earlyPaymentCount}x (avg {Math.round(log.avgDaysEarly || 0)} days early)
            </Text>
          </View>
        )}
        
        <View style={styles.scoresRow}>
          <View style={[styles.scoreBadge, { backgroundColor: disciplineColor + '20' }]}>
            <Text style={[styles.scoreBadgeText, { color: disciplineColor }]}>
              📊 {log.contributionDisciplineLevel || 'UNKNOWN'}
              {log.contributionDisciplineScore ? ` (${log.contributionDisciplineScore})` : ''}
            </Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: riskColor + '20' }]}>
            <Text style={[styles.scoreBadgeText, { color: riskColor }]}>
              ⚠️ {log.loanRisk || 'N/A'}
            </Text>
          </View>
        </View>
        
        {log.contributionFlags && log.contributionFlags.length > 0 && (
          <View style={styles.flagsRow}>
            {log.contributionFlags.slice(0, 2).map((flag, i) => (
              <Text key={i} style={[styles.flagText, flag.includes('✅') && styles.positiveFlag]} numberOfLines={1}>
                {flag.includes('✅') ? '✅ ' : '🚩 '}{flag.replace('✅', '').trim()}
              </Text>
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

  // ============ RENDER ============
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📋 AI Decision Logs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.filterChip, filterDecision === 'ALL' && styles.filterChipActive]} onPress={() => { setFilterDecision('ALL'); setFilterDiscipline('ALL'); }}>
            <Text style={[styles.filterChipText, filterDecision === 'ALL' && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, filterDecision === 'APPROVE' && styles.filterChipActive, { borderColor: '#4CAF50' }]} onPress={() => setFilterDecision('APPROVE')}>
            <Text style={[styles.filterChipText, filterDecision === 'APPROVE' && { color: '#4CAF50' }]}>✅ Approved</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, filterDecision === 'APPROVE_WITH_CAUTION' && styles.filterChipActive, { borderColor: '#FF9800' }]} onPress={() => setFilterDecision('APPROVE_WITH_CAUTION')}>
            <Text style={[styles.filterChipText, filterDecision === 'APPROVE_WITH_CAUTION' && { color: '#FF9800' }]}>⚠️ With Caution</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, filterDecision === 'REJECT' && styles.filterChipActive, { borderColor: '#F44336' }]} onPress={() => setFilterDecision('REJECT')}>
            <Text style={[styles.filterChipText, filterDecision === 'REJECT' && { color: '#F44336' }]}>❌ Rejected</Text>
          </TouchableOpacity>
        </ScrollView>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.disciplineFilterRow}>
          {['ALL', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'].map(level => (
            <TouchableOpacity key={level} style={[styles.filterChipSmall, filterDiscipline === level && styles.filterChipSmallActive, { borderColor: getDisciplineColor(undefined, level) }]} onPress={() => setFilterDiscipline(level as any)}>
              <Text style={[styles.filterChipSmallText, filterDiscipline === level && { color: getDisciplineColor(undefined, level) }]}>{level === 'ALL' ? 'All Levels' : level}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}><Text style={styles.statNumber}>{decisionLogs.length}</Text><Text style={styles.statLabel}>Total Logs</Text></View>
        <View style={styles.statItem}><Text style={[styles.statNumber, { color: '#4CAF50' }]}>{decisionLogs.filter(l => l.finalRecommendation === 'APPROVE').length}</Text><Text style={styles.statLabel}>Approved</Text></View>
        <View style={styles.statItem}><Text style={[styles.statNumber, { color: '#F44336' }]}>{decisionLogs.filter(l => l.finalRecommendation === 'REJECT').length}</Text><Text style={styles.statLabel}>Rejected</Text></View>
        <View style={styles.statItem}><Text style={[styles.statNumber, { color: '#FF9800' }]}>{decisionLogs.filter(l => l.finalRecommendation?.includes('CAUTION')).length}</Text><Text style={styles.statLabel}>Caution</Text></View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#8B5CF6" style={styles.loader} />
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {getFilteredLogs().length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>No decision logs found</Text>
              <Text style={styles.emptySubtext}>Logs will appear when AI processes loan requests</Text>
            </View>
          ) : (
            getFilteredLogs().map((log, index) => renderLogCard(log, index))
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
                    <Text style={[styles.detailDecision, { color: getDecisionColor(selectedLog.finalRecommendation) }]}>{selectedLog.finalRecommendation?.replace('_', ' ') || 'N/A'}</Text>
                    <Text style={styles.detailReason}>{selectedLog.decisionReasoning}</Text>
                    <Text style={styles.detailConfidence}>Confidence: {((selectedLog.finalConfidence || 0) * 100).toFixed(0)}%</Text>
                  </View>

                  <View style={[styles.detailSection, { backgroundColor: getDisciplineColor(selectedLog.contributionDisciplineScore, selectedLog.contributionDisciplineLevel) + '15' }]}>
                    <Text style={styles.detailSectionTitle}>📊 Contribution Discipline</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Score:</Text>
                      <Text style={[styles.detailValue, { color: getDisciplineColor(selectedLog.contributionDisciplineScore, selectedLog.contributionDisciplineLevel) }]}>
                        {selectedLog.contributionDisciplineScore != null 
                          ? `${selectedLog.contributionDisciplineScore}/100 (${selectedLog.contributionDisciplineLevel || 'N/A'})`
                          : 'Loading...'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Pending:</Text><Text style={styles.detailValue}>{selectedLog.pendingContributionCount || 0} (KES {selectedLog.totalPendingAmount?.toLocaleString() || '0'})</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Overdue:</Text><Text style={[styles.detailValue, { color: (selectedLog.overdueContributionCount || 0) > 0 ? '#F44336' : '#4CAF50' }]}>{selectedLog.overdueContributionCount || 0}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Penalties:</Text><Text style={styles.detailValue}>KES {selectedLog.totalPenalties?.toLocaleString() || '0'}</Text></View>
                    
                    {/* ✅ NEW: Early payment info in modal */}
                    {selectedLog.earlyPaymentCount && selectedLog.earlyPaymentCount > 0 && (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Early Payments:</Text>
                          <Text style={[styles.detailValue, { color: '#4CAF50' }]}>{selectedLog.earlyPaymentCount} times</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Avg Days Early:</Text>
                          <Text style={[styles.detailValue, { color: '#4CAF50' }]}>{Math.round(selectedLog.avgDaysEarly || 0)} days</Text>
                        </View>
                      </>
                    )}
                    
                    {selectedLog.contributionFlags && selectedLog.contributionFlags.length > 0 && (
                      <View style={styles.flagsContainer}><Text style={styles.flagsTitle}>⚠️ Flags:</Text>{selectedLog.contributionFlags.map((flag, i) => (
                        <Text key={i} style={[styles.flagItem, flag.includes('✅') && styles.positiveFlagItem]}>{flag.includes('✅') ? '✅' : '•'} {flag.replace('✅', '').trim()}</Text>
                      ))}</View>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>💰 Eligibility</Text>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Eligible:</Text><Text style={styles.detailValue}>KES {selectedLog.eligibilityAmount?.toLocaleString() || '0'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Requested:</Text><Text style={styles.detailValue}>KES {selectedLog.requestedAmount?.toLocaleString() || '0'}</Text></View>
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
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Risk Level:</Text><Text style={[styles.detailValue, { color: getRiskColor(selectedLog.loanRisk) }]}>{selectedLog.loanRisk || 'N/A'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Probability:</Text><Text style={styles.detailValue}>{((selectedLog.riskProbability || 0) * 100).toFixed(1)}%</Text></View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>📝 Loan Purpose</Text>
                    <Text style={styles.detailReason}>{selectedLog.loanReason || 'N/A'}</Text>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Sentiment:</Text><Text style={styles.detailValue}>{selectedLog.sentimentRisk || 'N/A'}</Text></View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>👤 Member Info</Text>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Name:</Text><Text style={styles.detailValue}>{selectedLog.memberName || selectedLog.memberId?.substring(0, 8) + '...'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Status:</Text><Text style={styles.detailValue}>{selectedLog.memberStatus || 'N/A'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Role:</Text><Text style={styles.detailValue}>{selectedLog.memberRole || 'N/A'}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Membership:</Text><Text style={styles.detailValue}>{selectedLog.membershipMonths?.toFixed(1) || '0'} months</Text></View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>💹 Interest Rate Details</Text>
                    <Text style={[styles.detailValue, { fontSize: 18, fontWeight: 'bold', color: '#2196F3', marginBottom: 8 }]}>
                      {getInterestRate(selectedLog)}
                    </Text>
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
                        Member used {selectedLog.eligibilityUsagePercentage}% of eligible amount.
                        {selectedLog.eligibilityUsagePercentage > 80 
                          ? ' Higher utilization increases interest rate.'
                          : selectedLog.eligibilityUsagePercentage > 60
                          ? ' Moderate utilization - standard rate applied.'
                          : ' Conservative borrowing helps get better rates!'}
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
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backButton: { paddingRight: 10 },
  backButtonText: { fontSize: 16, color: '#8B5CF6', fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  headerSpacer: { width: 60 },
  filterContainer: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#FFFFFF' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8, backgroundColor: '#F8FAFC' },
  filterChipActive: { backgroundColor: '#8B5CF615', borderColor: '#8B5CF6' },
  filterChipText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  filterChipTextActive: { color: '#8B5CF6', fontWeight: '700' },
  disciplineFilterRow: { marginTop: 8, paddingBottom: 10 },
  filterChipSmall: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 6, backgroundColor: '#F8FAFC' },
  filterChipSmallActive: { backgroundColor: '#F1F5F9' },
  filterChipSmallText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 4 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#8B5CF6' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },
  loader: { marginTop: 50 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 30 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#64748B' },
  emptySubtext: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  logCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  decisionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  decisionBadgeText: { fontSize: 12, fontWeight: '700' },
  logDate: { fontSize: 11, color: '#94A3B8' },
  logCardBody: { marginBottom: 8 },
  logMemberName: { fontSize: 13, color: '#64748B', marginBottom: 2, fontWeight: '600' },
  logAmount: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
  logReason: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  usageRow: { marginBottom: 6 },
  usageText: { fontSize: 11, fontWeight: '500' },
  earlyBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 6, alignSelf: 'flex-start' },
  earlyBadgeText: { fontSize: 10, color: '#4CAF50', fontWeight: '600' },
  scoresRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scoreBadgeText: { fontSize: 11, fontWeight: '600' },
  flagsRow: { marginBottom: 6 },
  flagText: { fontSize: 10, color: '#F44336', marginBottom: 1 },
  positiveFlag: { color: '#4CAF50' },
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
  positiveFlagItem: { color: '#4CAF50' },
  rateBreakdownContainer: { marginTop: 8, padding: 8, backgroundColor: '#F5F5F5', borderRadius: 6 },
  rateBreakdownTitle: { fontSize: 12, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  rateBreakdownLine: { fontSize: 10, color: '#555', marginBottom: 2, fontFamily: 'monospace' },
  impactCard: { backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginTop: 8, borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  impactTitle: { fontSize: 13, fontWeight: 'bold', color: '#1976D2', marginBottom: 4 },
  impactText: { fontSize: 12, color: '#555', lineHeight: 16 },
  closeDetailButton: { backgroundColor: '#8B5CF6', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  closeDetailButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
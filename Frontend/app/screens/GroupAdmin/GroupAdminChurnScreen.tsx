import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProgressChart, BarChart } from 'react-native-chart-kit';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';
const FLASK_CHURN_URL = 'http://192.168.0.101:5001';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;

interface ChurnDashboardData {
  admin_id: string;
  group_id: string;
  total_members: number;
  recent_activity_30d: number;
  health_score: number;
  risk_breakdown: {
    high: number;
    medium: number;
    low: number;
  };
  at_risk_members: Array<{
    member_id: string;
    name: string;
    churn_probability: number;
    risk_level: string;
    risk_factors: string[];
  }>;
  recommendations: string[];
  last_updated: string;
}

// Interface for single member details (from /predict/member endpoint)
interface MemberDetails {
  member_id: string;
  member_name: string;
  churn_probability: number;
  risk_level: string;
  risk_factors: string[];
  recommendation: string;
  model_confidence: number;
  metrics: {
    days_inactive: number;
    total_saved: number;
    total_loans: number;
    outstanding_debt: number;
    membership_months: number;
    last_communication_days: number;
  };
}

interface Group {
  id: string;
  groupName: string;
}

export default function GroupAdminChurnScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [churnData, setChurnData] = useState<ChurnDashboardData | null>(null);
  const [groupName, setGroupName] = useState('');
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);
  
  // Show all members modal
  const [showAllMembers, setShowAllMembers] = useState(false);

  const fetchGroupName = async (groupId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/groups/${groupId}`);
      if (response.ok) {
        const group: Group = await response.json();
        setGroupName(group.groupName);
      }
    } catch (error) {
      console.error('Error fetching group name:', error);
    }
  };

  const fetchChurnData = async () => {
    try {
      const adminId = await AsyncStorage.getItem('userId');

      if (!adminId) {
        router.replace('/(auth)');
        return;
      }

      const response = await fetch(`${FLASK_CHURN_URL}/api/v1/dashboard/groupadmin/${adminId}`);
      const result = await response.json();
      
      if (result.success) {
        setChurnData(result.data);
        // Fetch the actual group name using the group_id from the response
        if (result.data.group_id) {
          await fetchGroupName(result.data.group_id);
        }
      } else {
        Alert.alert('Error', 'Failed to load churn analysis data');
      }
    } catch (error) {
      console.error('Error fetching churn data:', error);
      Alert.alert(
        'Service Unavailable',
        'Unable to load member risk analysis. Please check if the ML service is running.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch single member details
  const fetchMemberDetails = async (memberId: string) => {
    setLoadingMember(true);
    try {
      const response = await fetch(`${FLASK_CHURN_URL}/api/v1/predict/member/${memberId}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedMember(result.data);
        setModalVisible(true);
      } else {
        Alert.alert('Error', 'Could not load member details');
      }
    } catch (error) {
      console.error('Error fetching member details:', error);
      Alert.alert('Error', 'Failed to load member details');
    } finally {
      setLoadingMember(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChurnData();
  };

  useEffect(() => {
    fetchChurnData();
  }, []);

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'HIGH': return '#F44336';
      case 'MEDIUM': return '#FF9800';
      case 'LOW': return '#4CAF50';
      default: return '#2196F3';
    }
  };

  const getRiskLevelEmoji = (level: string) => {
    switch (level) {
      case 'HIGH': return '🔴';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  };

  // FIXED: Get health score description based on ACTUAL at-risk members, not the broken formula
  const getHealthScoreDescription = (highRisk: number, total: number) => {
    const percentageAtRisk = (highRisk / total) * 100;
    const safeMembers = total - highRisk;
    const realHealthScore = 100 - percentageAtRisk;
    
    if (percentageAtRisk === 0) {
      return {
        emoji: '🌟',
        title: 'Perfect!',
        description: 'All members are safe and engaged!',
        color: '#4CAF50',
        realHealthScore: 100
      };
    } else if (percentageAtRisk < 20) {
      return {
        emoji: '👍',
        title: 'Good',
        description: `${highRisk} member${highRisk > 1 ? 's' : ''} need attention. Most members are doing well.`,
        color: '#8BC34A',
        realHealthScore: realHealthScore
      };
    } else if (percentageAtRisk < 50) {
      return {
        emoji: '⚠️',
        title: 'Warning',
        description: `${highRisk} members (${percentageAtRisk.toFixed(0)}%) might leave soon. Time to reach out.`,
        color: '#FF9800',
        realHealthScore: realHealthScore
      };
    } else if (percentageAtRisk < 80) {
      return {
        emoji: '🚨',
        title: 'Critical',
        description: `${highRisk} members (${percentageAtRisk.toFixed(0)}%) are at risk! Most of your group might leave.`,
        color: '#F44336',
        realHealthScore: realHealthScore
      };
    } else {
      return {
        emoji: '🆘',
        title: 'EMERGENCY!',
        description: `${highRisk} out of ${total} members will leave soon! Only ${safeMembers} active member${safeMembers > 1 ? 's' : ''} remaining.`,
        color: '#B71C1C',
        realHealthScore: realHealthScore
      };
    }
  };

  // Function to get member risk description
  const getMemberRiskDescription = (probability: number, level: string) => {
    const percent = (probability * 100).toFixed(0);
    
    if (level === 'HIGH') {
      return `🔴 This member has a ${percent}% chance of leaving. They need immediate attention!`;
    } else if (level === 'MEDIUM') {
      return `🟡 This member might leave soon (${percent}% chance). Send them a friendly message.`;
    } else {
      return `🟢 This member is safe (${percent}% chance of leaving). Keep up the good engagement!`;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num/1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num/1000).toFixed(1)}K`;
    return num.toString();
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>
            Loading member analysis...
          </Text>
        </View>
        <GroupAdminBottomNav current="none" />
      </SafeAreaView>
    );
  }

  // Get health score description based on ACTUAL risk data, not the broken formula
  const healthDescription = churnData ? 
    getHealthScoreDescription(
      churnData.risk_breakdown.high,
      churnData.total_members
    ) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Simple Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.groupNameHeader}>
            {groupName || 'My Group'}
          </Text>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1565C0" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {churnData && healthDescription ? (
          <View style={styles.content}>
            {/* Last Updated - Simple text */}
            <View style={styles.lastUpdatedContainer}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.lastUpdatedText}>
                Updated: {new Date(churnData.last_updated).toLocaleString()}
              </Text>
            </View>

            {/* Health Score - FIXED with real meaning */}
            <View style={styles.healthCard}>
              <Text style={styles.healthCardLabel}>
                Group Health Score 
              </Text>
              <View style={styles.healthCardValueContainer}>
                <Text style={[styles.healthCardValue, { color: healthDescription.color }]}>
                  {churnData.health_score}%
                </Text>
              </View>
              
              {/* THE REAL STORY - What actually matters */}
              <View style={[styles.healthDescriptionBox, { backgroundColor: healthDescription.color + '20' }]}>
                <Text style={styles.healthDescriptionEmoji}>{healthDescription.emoji}</Text>
                <View style={styles.healthDescriptionTextContainer}>
                  <Text style={[styles.healthDescriptionTitle, { color: healthDescription.color }]}>
                    {healthDescription.title}
                  </Text>
                  <Text style={styles.healthDescriptionText}>
                    {healthDescription.description}
                  </Text>
                </View>
              </View>

              {/* Simple explanation - REMOVED the misleading scale, showing ONLY the truth */}
              <View style={styles.realStatsBox}>
                <Text style={styles.realStatsTitle}>📊 The REAL Numbers:</Text>
                <View style={styles.realStatRow}>
                  <Text style={styles.realStatEmoji}>🔴</Text>
                  <Text style={styles.realStatText}>
                    <Text style={styles.realStatBold}>{churnData.risk_breakdown.high}</Text> members will leave SOON (High Risk)
                  </Text>
                </View>
                <View style={styles.realStatRow}>
                  <Text style={styles.realStatEmoji}>🟡</Text>
                  <Text style={styles.realStatText}>
                    <Text style={styles.realStatBold}>{churnData.risk_breakdown.medium}</Text> members might leave (Medium Risk)
                  </Text>
                </View>
                <View style={styles.realStatRow}>
                  <Text style={styles.realStatEmoji}>🟢</Text>
                  <Text style={styles.realStatText}>
                    <Text style={styles.realStatBold}>{churnData.risk_breakdown.low}</Text> members are SAFE
                  </Text>
                </View>
                
                {/* Warning message if needed */}
                {churnData.risk_breakdown.high > 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningBoxEmoji}>⚠️</Text>
                    <Text style={styles.warningBoxText}>
                      {churnData.risk_breakdown.high} member{churnData.risk_breakdown.high > 1 ? 's' : ''} need your help TODAY!
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Simple Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{churnData.total_members}</Text>
                <Text style={styles.statBoxLabel}>Total Members</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{churnData.recent_activity_30d}</Text>
                <Text style={styles.statBoxLabel}>Activities (30d)</Text>
              </View>
            </View>

            {/* Simple Risk Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                Risk Breakdown (Who needs help)
              </Text>
              
              {/* Simple Progress Bars */}
              <View style={styles.simpleChart}>
                <View style={styles.simpleChartRow}>
                  <Text style={styles.simpleChartLabel}>🔴 High Risk</Text>
                  <View style={styles.simpleChartBarContainer}>
                    <View style={[styles.simpleChartBar, { 
                      width: `${(churnData.risk_breakdown.high / churnData.total_members) * 100}%`,
                      backgroundColor: '#F44336'
                    }]} />
                  </View>
                  <Text style={styles.simpleChartValue}>{churnData.risk_breakdown.high}</Text>
                </View>
                
                <View style={styles.simpleChartRow}>
                  <Text style={styles.simpleChartLabel}>🟡 Medium Risk</Text>
                  <View style={styles.simpleChartBarContainer}>
                    <View style={[styles.simpleChartBar, { 
                      width: `${(churnData.risk_breakdown.medium / churnData.total_members) * 100}%`,
                      backgroundColor: '#FF9800'
                    }]} />
                  </View>
                  <Text style={styles.simpleChartValue}>{churnData.risk_breakdown.medium}</Text>
                </View>
                
                <View style={styles.simpleChartRow}>
                  <Text style={styles.simpleChartLabel}>🟢 Safe</Text>
                  <View style={styles.simpleChartBarContainer}>
                    <View style={[styles.simpleChartBar, { 
                      width: `${(churnData.risk_breakdown.low / churnData.total_members) * 100}%`,
                      backgroundColor: '#4CAF50'
                    }]} />
                  </View>
                  <Text style={styles.simpleChartValue}>{churnData.risk_breakdown.low}</Text>
                </View>
              </View>
            </View>

            {/* At-Risk Members - With "See All" button */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="warning" size={20} color="#F44336" />
                  <Text style={styles.sectionTitle}>
                    Members Needing Attention
                  </Text>
                </View>
                
                {churnData.at_risk_members.length < (churnData.risk_breakdown.high + churnData.risk_breakdown.medium) && (
                  <TouchableOpacity 
                    style={styles.seeAllButton}
                    onPress={() => setShowAllMembers(true)}
                  >
                    <Text style={styles.seeAllButtonText}>See All</Text>
                    <Ionicons name="chevron-forward" size={16} color="#2196F3" />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.sectionSubtext}>
                Tap any member to see why they might leave
              </Text>

              {churnData.at_risk_members.map((member) => (
                <TouchableOpacity
                  key={member.member_id}
                  style={[
                    styles.memberCard,
                    { borderLeftColor: getRiskLevelColor(member.risk_level) }
                  ]}
                  onPress={() => fetchMemberDetails(member.member_id)}
                >
                  <View style={styles.memberHeader}>
                    <View style={styles.memberNameContainer}>
                      <Text style={styles.memberNameEmoji}>
                        {getRiskLevelEmoji(member.risk_level)}
                      </Text>
                      <Text style={styles.memberName}>
                        {member.name}
                      </Text>
                    </View>
                    <View style={[styles.memberRiskBadge, { backgroundColor: getRiskLevelColor(member.risk_level) }]}>
                      <Text style={styles.memberRiskText}>
                        {(member.churn_probability * 100).toFixed(0)}% Risk
                      </Text>
                    </View>
                  </View>
                  
                  {/* Show first risk factor only */}
                  {member.risk_factors.length > 0 && (
                    <View style={styles.simpleRiskFactor}>
                      <Ionicons name="information-circle-outline" size={14} color="#666" />
                      <Text style={styles.simpleRiskFactorText} numberOfLines={1}>
                        {member.risk_factors[0]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Show count if there are more */}
              {churnData.at_risk_members.length < (churnData.risk_breakdown.high + churnData.risk_breakdown.medium) && (
                <TouchableOpacity 
                  style={styles.viewMoreButton}
                  onPress={() => setShowAllMembers(true)}
                >
                  <Text style={styles.viewMoreButtonText}>
                    + {churnData.risk_breakdown.high + churnData.risk_breakdown.medium - churnData.at_risk_members.length} more at-risk members
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Recommendations - Simple Bullet Points */}
            <View style={styles.recommendationsCard}>
              <View style={styles.recommendationsHeader}>
                <Ionicons name="bulb-outline" size={20} color="#FFC107" />
                <Text style={styles.recommendationsTitle}>
                  What To Do Next
                </Text>
              </View>
              
              {churnData.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Text style={styles.recommendationBullet}>👉</Text>
                  <Text style={styles.recommendationText}>
                    {rec.replace('🔴', '').replace('🟡', '').replace('📅', '').replace('📞', '')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="analytics-outline" size={64} color="#999" />
            <Text style={styles.noDataText}>
              No data available
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ===== MEMBER DETAILS MODAL ===== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Member Details</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loadingMember ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.modalLoadingText}>Loading member info...</Text>
              </View>
            ) : selectedMember ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Member Name with Risk Emoji */}
                <View style={styles.modalNameSection}>
                  <Text style={styles.modalNameEmoji}>
                    {getRiskLevelEmoji(selectedMember.risk_level)}
                  </Text>
                  <Text style={styles.modalName}>{selectedMember.member_name}</Text>
                </View>

                {/* Risk Level Badge with Description */}
                <View style={[styles.modalRiskBadge, { backgroundColor: getRiskLevelColor(selectedMember.risk_level) }]}>
                  <Text style={styles.modalRiskBadgeText}>
                    {selectedMember.risk_level} RISK - {(selectedMember.churn_probability * 100).toFixed(0)}% chance of leaving
                  </Text>
                </View>

                {/* Clear explanation of what this risk means */}
                <View style={styles.modalRiskExplanation}>
                  <Text style={styles.modalRiskExplanationText}>
                    {getMemberRiskDescription(selectedMember.churn_probability, selectedMember.risk_level)}
                  </Text>
                </View>

                {/* Quick Stats Grid */}
                <Text style={styles.modalSectionTitle}>📊 Member Statistics</Text>
                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatItem}>
                    <Ionicons name="calendar-outline" size={20} color="#2196F3" />
                    <Text style={styles.modalStatLabel}>Member for</Text>
                    <Text style={styles.modalStatValue}>{selectedMember.metrics.membership_months.toFixed(1)} months</Text>
                  </View>
                  
                  <View style={styles.modalStatItem}>
                    <Ionicons name="time-outline" size={20} color="#F44336" />
                    <Text style={styles.modalStatLabel}>Days inactive</Text>
                    <Text style={styles.modalStatValue}>{selectedMember.metrics.days_inactive}</Text>
                  </View>
                  
                  <View style={styles.modalStatItem}>
                    <Ionicons name="cash-outline" size={20} color="#4CAF50" />
                    <Text style={styles.modalStatLabel}>Total saved</Text>
                    <Text style={styles.modalStatValue}>{formatCurrency(selectedMember.metrics.total_saved)}</Text>
                  </View>
                  
                  <View style={styles.modalStatItem}>
                    <Ionicons name="warning-outline" size={20} color="#FF9800" />
                    <Text style={styles.modalStatLabel}>Outstanding debt</Text>
                    <Text style={styles.modalStatValue}>{formatCurrency(selectedMember.metrics.outstanding_debt)}</Text>
                  </View>
                </View>

                {/* Risk Factors */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>⚠️ Why they might leave</Text>
                  {selectedMember.risk_factors.map((factor, index) => (
                    <View key={index} style={styles.modalFactorItem}>
                      <Text style={styles.modalFactorBullet}>•</Text>
                      <Text style={styles.modalFactorText}>{factor}</Text>
                    </View>
                  ))}
                </View>

                {/* Recommendation */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>💡 What to do</Text>
                  <View style={styles.modalRecommendation}>
                    <Text style={styles.modalRecommendationText}>
                      {selectedMember.recommendation}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalActionButton, styles.modalCallButton]}
                    onPress={() => Alert.alert('Call', `Calling ${selectedMember.member_name}...`)}
                  >
                    <Ionicons name="call" size={18} color="#FFF" />
                    <Text style={styles.modalActionButtonText}>Call Member</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalActionButton, styles.modalMessageButton]}
                    onPress={() => Alert.alert('Message', `Send SMS to ${selectedMember.member_name}`)}
                  >
                    <Ionicons name="chatbubble" size={18} color="#FFF" />
                    <Text style={styles.modalActionButtonText}>Send SMS</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ===== ALL MEMBERS MODAL ===== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAllMembers}
        onRequestClose={() => setShowAllMembers(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All At-Risk Members ({churnData?.risk_breakdown.high! + churnData?.risk_breakdown.medium!})</Text>
              <TouchableOpacity 
                onPress={() => setShowAllMembers(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={churnData?.at_risk_members || []}
              keyExtractor={(item) => item.member_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.allMembersItem,
                    { borderLeftColor: getRiskLevelColor(item.risk_level) }
                  ]}
                  onPress={() => {
                    setShowAllMembers(false);
                    fetchMemberDetails(item.member_id);
                  }}
                >
                  <View style={styles.allMembersHeader}>
                    <Text style={styles.allMembersName}>
                      {getRiskLevelEmoji(item.risk_level)} {item.name}
                    </Text>
                    <View style={[styles.allMembersBadge, { backgroundColor: getRiskLevelColor(item.risk_level) }]}>
                      <Text style={styles.allMembersBadgeText}>
                        {(item.churn_probability * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.allMembersFactor} numberOfLines={1}>
                    {item.risk_factors[0]}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.allMembersList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#E3F2FD'
  },
  
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: '#64B5F6',
    elevation: 3,
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  logo: { 
    width: 35, 
    height: 35, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  groupNameHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1565C0',
    maxWidth: SCREEN_WIDTH - 120,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '600',
    marginLeft: 2,
  },

  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#555' 
  },

  scrollContent: { 
    flexGrow: 1,
  },

  content: {
    padding: 16,
  },

  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },

  healthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  healthCardLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  healthCardValueContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  healthCardValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  
  // New styles for REAL health description
  healthDescriptionBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  healthDescriptionEmoji: {
    fontSize: 40,
  },
  healthDescriptionTextContainer: {
    flex: 1,
  },
  healthDescriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  healthDescriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  
  realStatsBox: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
  },
  realStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  realStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  realStatEmoji: {
    fontSize: 18,
    width: 30,
  },
  realStatText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  realStatBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  warningBoxEmoji: {
    fontSize: 20,
  },
  warningBoxText: {
    fontSize: 14,
    color: '#B71C1C',
    fontWeight: '600',
    flex: 1,
  },

  simpleBadgeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  simpleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
  },
  simpleBadgeEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  simpleBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 3,
  },
  statBoxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  simpleChart: {
    gap: 12,
  },
  simpleChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simpleChartLabel: {
    width: 100,
    fontSize: 14,
    color: '#666',
  },
  simpleChartBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  simpleChartBar: {
    height: '100%',
    borderRadius: 12,
  },
  simpleChartValue: {
    width: 40,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtext: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  seeAllButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginRight: 2,
  },

  memberCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  memberNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberNameEmoji: {
    fontSize: 16,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  memberRiskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberRiskText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  simpleRiskFactor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  simpleRiskFactorText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  viewMoreButton: {
    marginTop: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  viewMoreButtonText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '500',
  },

  recommendationsCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  recommendationBullet: {
    fontSize: 14,
  },
  recommendationText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
    lineHeight: 18,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  modalNameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalNameEmoji: {
    fontSize: 32,
  },
  modalName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalRiskBadge: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalRiskBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalRiskExplanation: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalRiskExplanationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  modalStatItem: {
    width: '47%',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  modalStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  modalStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  modalSection: {
    marginBottom: 20,
  },
  modalFactorItem: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  modalFactorBullet: {
    fontSize: 16,
    color: '#F44336',
  },
  modalFactorText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
    lineHeight: 20,
  },
  modalRecommendation: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
  },
  modalRecommendationText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 8,
  },
  modalCallButton: {
    backgroundColor: '#4CAF50',
  },
  modalMessageButton: {
    backgroundColor: '#2196F3',
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // All Members Modal
  allMembersList: {
    paddingBottom: 20,
  },
  allMembersItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  allMembersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  allMembersName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  allMembersBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  allMembersBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  allMembersFactor: {
    fontSize: 13,
    color: '#666',
  },

  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  useColorScheme,
  RefreshControl,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://192.168.0.101:8080/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
}

interface Group {
  id: string;
  groupName: string;
  description: string;
  creationDate: string;
  members: Member[];
  status?: string;
}

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  paymentDate?: string;
  dueDate?: string;
  status: string;
  isLate?: boolean;
  penaltyApplied?: number;
  totalDue?: number;
  member: Member;
  group: Group;
}

export default function GroupDashboardScreen() {
  const router = useRouter();
  const { setUserRole } = useContext(AuthContext)!;
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [groupAdminName, setGroupAdminName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  const [pendingContributionsTotal, setPendingContributionsTotal] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [inactiveMembersCount, setInactiveMembersCount] = useState(0);
  const [activeGroupsCount, setActiveGroupsCount] = useState(0);
  const [investmentsCount, setInvestmentsCount] = useState(0);
  const [recentCompletedContributions, setRecentCompletedContributions] = useState<Contribution[]>([]);
  const [pendingContributionsList, setPendingContributionsList] = useState<Contribution[]>([]);

  const CARD_MARGIN = SCREEN_WIDTH * 0.02;
  const STAT_CARD_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * 8)) / 3;
  const QUICK_ACTION_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * 8)) / 3;

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleSwitchToMemberView = async () => {
    try {
      await AsyncStorage.setItem('userViewMode', 'member');
      router.replace('/(member)/dashboard');
    } catch (error) {
      console.error('Failed to switch to member view:', error);
      Alert.alert('Error', 'Could not switch to member view. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroupDataAndContributions();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'userEmail', 'userFirstName', 'userLastName',
        'userRole', 'userStatus', 'userTenantId', 'userViewMode'
      ]);
      setUserRole(null);
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchGroupDataAndContributions();
    }, [])
  );

  const fetchGroupDataAndContributions = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const firstName = await AsyncStorage.getItem('userFirstName');
      const lastName = await AsyncStorage.getItem('userLastName');

      setGroupAdminName(`${firstName ?? ''} ${lastName ?? ''}`);

      if (!userId) {
        setLoading(false);
        router.replace('/(auth)');
        return;
      }

      const res = await fetch(`${BASE_URL}/groups/groupadmin/${userId}`);
      if (!res.ok) {
        Alert.alert('Error', 'Failed to load group data. Please try again.');
        setLoading(false);
        return;
      }

      const data: Group[] = await res.json();
      setGroups(data || []);

      const memberCount = data.reduce((sum, group) => sum + (group.members?.length || 0), 0);
      const inactiveCount = data.reduce((sum, group) => {
        const inactiveInGroup = group.members?.filter(m => m.status?.toLowerCase() === 'inactive').length || 0;
        return sum + inactiveInGroup;
      }, 0);
      const activeGroups = data.filter(g => g.status?.toLowerCase() === 'active').length;

      setTotalMembers(memberCount);
      setInactiveMembersCount(inactiveCount);
      setActiveGroupsCount(activeGroups);

      let totalCompletedContributions = 0;
      let totalPendingAmount = 0;
      let overdueContributions = 0;
      const completedContributions: Contribution[] = [];
      const pendingList: Contribution[] = [];

      for (const group of data) {
        try {
          const res = await fetch(`${BASE_URL}/contributions/group/${group.id}`);
          if (res.ok) {
            const contributions: Contribution[] = await res.json();
            
            const completed = contributions.filter(c => c.status === 'Completed');
            const pending = contributions.filter(c => c.status === 'Pending');
            
            const groupCompletedTotal = completed.reduce((sum, c) => sum + c.amount, 0);
            totalCompletedContributions += groupCompletedTotal;
            
            const groupPendingTotal = pending.reduce((sum, c) => sum + (c.amount + (c.penaltyApplied || 0)), 0);
            totalPendingAmount += groupPendingTotal;
            
            const today = new Date();
            const overdue = pending.filter(c => {
              if (c.dueDate) {
                return new Date(c.dueDate) < today;
              }
              return false;
            });
            overdueContributions += overdue.length;
            
            completed.forEach(c => {
              completedContributions.push({
                ...c,
                group: group,
                member: c.member
              });
            });
            
            pending.forEach(c => {
              pendingList.push({
                ...c,
                group: group,
                member: c.member,
                totalDue: c.amount + (c.penaltyApplied || 0)
              });
            });
          }
        } catch (err) {
          console.error(`Error fetching contributions for group ${group.id}:`, err);
        }
      }

      setTotalContributions(totalCompletedContributions);
      setPendingContributionsTotal(totalPendingAmount);
      setOverdueCount(overdueContributions);
      
      const sortedCompleted = completedContributions
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .slice(0, 5);
      setRecentCompletedContributions(sortedCompleted);
      
      setPendingContributionsList(pendingList.slice(0, 5));

      if (data.length > 0) {
        try {
          const investmentsRes = await fetch(`${BASE_URL}/investments/group/${data[0]?.id}`);
          if (investmentsRes.ok) {
            const investments = await investmentsRes.json();
            setInvestmentsCount(investments.length);
          }
        } catch (investmentsErr) {
          console.error('Error fetching investments:', investmentsErr);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      Alert.alert('Error', 'An unexpected error occurred while loading dashboard data.');
      setLoading(false);
    }
  };

  // 8 STAT CARDS (Original 6 + 2 new ones)
  const statCards = [
    // Original cards
    {
      title: 'Total Groups',
      value: groups.length,
      icon: '🏢',
      color: '#2196F3',
      route: '/(groupadmin)/manage-groups'
    },
    {
      title: 'Active Groups',
      value: activeGroupsCount,
      icon: '✅',
      color: '#4CAF50',
      route: '/(groupadmin)/manage-groups'
    },
    {
      title: 'Total Members',
      value: totalMembers,
      icon: '👥',
      color: '#FF9800',
      route: '/(groupadmin)/group-members'
    },
    {
      title: 'Inactive Members',
      value: inactiveMembersCount,
      icon: '⏸️',
      color: '#607D8B',
      route: '/(groupadmin)/group-members'
    },
    {
      title: 'Total Collected',
      value: `KES ${totalContributions.toLocaleString()}`,
      icon: '💰',
      color: '#4CAF50',
      route: '/(groupadmin)/group-contributions'
    },
    {
      title: 'Pending',
      value: `KES ${pendingContributionsTotal.toLocaleString()}`,
      icon: '⏳',
      color: '#FFC107',
      route: '/(groupadmin)/record-contributions'
    },
    // New cards
    {
      title: 'Overdue',
      value: overdueCount,
      icon: '⚠️',
      color: '#F44336',
      route: '/(groupadmin)/record-contributions'
    },
    {
      title: 'Investments',
      value: investmentsCount,
      icon: '💹',
      color: '#9C27B0',
      route: '/(groupadmin)/investments'
    },
  ];

  const quickActions = [
    { name: 'Record Contribution', icon: '💰', route: '/(groupadmin)/record-contributions', color: '#4CAF50' },
    { name: 'Manage Groups', icon: '🏢', route: '/(groupadmin)/manage-groups', color: '#2196F3' },
    { name: 'View Members', icon: '👥', route: '/(groupadmin)/group-members', color: '#FF9800' },
    { name: 'Contribution Report', icon: '🥧', route: '/(groupadmin)/group-contributions', color: '#4CAF50' },
    { name: 'Contribution Settings', icon: '⚙️', route: '/(groupadmin)/group-settings', color: '#9C27B0' },
    { name: 'Send Notification', icon: '🔔', route: '/(groupadmin)/notifications', color: '#9C27B0' },
    { name: 'Loan Management', icon: '📝', route: '/(groupadmin)/loan-management', color: '#F44336' },
    { name: 'Churn Analysis', icon: '📊', route: '/(groupadmin)/churn-analysis', color: '#9C27B0' },
    { name: 'Dividends', icon: '🎁', route: '/(groupadmin)/admin-dividends', color: '#c079cd' },
    { name: 'Documents', icon: '📄', route: '/(groupadmin)/document-management', color: '#607D8B' },
    { name: 'Meeting Management', icon: '📅', route: '/(groupadmin)/meetings', color: '#9C27B0' },
    { name: 'Volunteer Campaign', icon: '🤝', route: '/(groupadmin)/create-campaign', color: '#FF9800' },
    // { name: 'M-PESA Config', icon: '🏦', route: '/(groupadmin)/mpesa-settings', color: '#8c464c' },
  ];

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={[styles.loadingText, isDarkMode && styles.darkLoadingText]}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
      <View style={[styles.headerContainer, isDarkMode && styles.darkHeaderContainer]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.appTitleContainer}>
            <Text style={[styles.titleBlack, isDarkMode && styles.darkTitleBlack]}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>

        <View style={styles.headerIconsContainer}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={handleSwitchToMemberView}
          >
            <Ionicons 
              name="people" 
              size={24} 
              color={isDarkMode ? "#81C784" : "#4CAF50"} 
            />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>
              Member View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(groupadmin)/group-admin-profile')}
          >
            <Ionicons name="person" size={24} color={isDarkMode ? "#90CAF9" : "#2196F3"} />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#F44336" />
            <Text style={[styles.headerIconText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDarkMode && styles.darkScrollContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor={isDarkMode ? '#90CAF9' : '#2196F3'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, isDarkMode && styles.darkWelcomeText]}>
              Welcome back, {groupAdminName}!
            </Text>
            <Text style={[styles.subtitle, isDarkMode && styles.darkSubtitle]}>
              Role: Group Admin
            </Text>
            <Text style={[styles.dateText, isDarkMode && styles.darkDateText]}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>

          {/* 8 Stat Cards Grid - 3 columns, 3 rows (3+3+2) */}
          <View style={styles.statsGrid}>
            {statCards.map((card, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.statCard, 
                  isDarkMode && styles.darkStatCard,
                  { width: STAT_CARD_WIDTH }
                ]}
                onPress={() => card.route && router.push(card.route)}
              >
                <View style={styles.statCardContent}>
                  <View style={styles.statIconContainer}>
                    <View style={[styles.statIconCircle, { backgroundColor: card.color }]}>
                      <Text style={styles.statIconText}>{card.icon}</Text>
                    </View>
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statValue, isDarkMode && styles.darkStatValue]}>
                      {card.value}
                    </Text>
                    <Text style={[styles.statTitle, isDarkMode && styles.darkStatTitle]}>
                      {card.title}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                Quick Actions
              </Text>
            </View>
            
            <View style={[styles.divider, isDarkMode && styles.darkDivider]} />
            
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickActionButton, 
                    isDarkMode && styles.darkQuickActionButton,
                    { width: QUICK_ACTION_WIDTH }
                  ]}
                  onPress={() => router.push(action.route)}
                >
                  <View style={styles.quickActionContent}>
                    <View style={[styles.quickActionIconContainer, { backgroundColor: action.color }]}>
                      <Text style={styles.quickActionIcon}>{action.icon}</Text>
                    </View>
                    <Text style={[styles.quickActionText, isDarkMode && styles.darkQuickActionText]}>
                      {action.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {recentCompletedContributions.length > 0 && (
            <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                  ✅ Recent Completed Contributions
                </Text>
                <TouchableOpacity onPress={() => router.push('/(groupadmin)/group-contributions')}>
                  <Text style={styles.link}>View All</Text>
                </TouchableOpacity>
              </View>
              {recentCompletedContributions.map((contribution, index) => (
                <View key={index} style={styles.contributionItem}>
                  <View style={styles.contributionInfo}>
                    <Text style={[styles.contributionName, isDarkMode && styles.darkContributionName]}>
                      {contribution.member?.firstName} {contribution.member?.lastName}
                    </Text>
                    <Text style={[styles.contributionGroup, isDarkMode && styles.darkContributionGroup]}>
                      {contribution.group?.groupName}
                    </Text>
                  </View>
                  <View style={styles.contributionMeta}>
                    <Text style={[styles.contributionAmount, isDarkMode && styles.darkContributionAmount]}>
                      KES {contribution.amount.toLocaleString()}
                    </Text>
                    <Text style={[styles.contributionDate, isDarkMode && styles.darkContributionDate]}>
                      {formatDate(contribution.transactionDate)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {pendingContributionsList.length > 0 && (
  <View style={[styles.pendingContainer, isDarkMode && styles.darkPendingContainer]}>
    <View style={styles.pendingHeader}>
      <Text style={styles.pendingTitle}>⏳ Pending Contributions</Text>
      <TouchableOpacity onPress={() => router.push('/(groupadmin)/record-contributions')}>
        <Text style={styles.pendingLink}>Record Now →</Text>
      </TouchableOpacity>
    </View>
    {pendingContributionsList.map((contribution, index) => {
      const totalDue = contribution.amount + (contribution.penaltyApplied || 0);
      const hasPenalty = (contribution.penaltyApplied || 0) > 0;
      
      return (
        <View key={index} style={styles.pendingItem}>
          <View style={styles.pendingInfo}>
            <Text style={[styles.pendingName, isDarkMode && styles.darkPendingName]}>
              {contribution.member?.firstName} {contribution.member?.lastName}
            </Text>
            <Text style={[styles.pendingDue, isDarkMode && styles.darkPendingDue]}>
              Due: {formatDate(contribution.dueDate || contribution.transactionDate)}
            </Text>
            {hasPenalty && (
              <Text style={styles.pendingPenalty}>
                ⚠️ Penalty: KES {contribution.penaltyApplied?.toLocaleString()}
              </Text>
            )}
          </View>
          <View style={styles.pendingAmountContainer}>
            <Text style={styles.pendingAmount}>
              KES {totalDue.toLocaleString()}
            </Text>
            {hasPenalty && (
              <Text style={styles.pendingOriginalAmount}>
                (incl. KES {contribution.penaltyApplied?.toLocaleString()} penalty)
              </Text>
            )}
          </View>
        </View>
      );
    })}
  </View>
)}

          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                Your Groups
              </Text>
              <TouchableOpacity onPress={() => router.push('/(groupadmin)/manage-groups')}>
                <Text style={styles.link}>Manage</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.groupsList}>
              {groups.slice(0, 3).map((group, index) => (
                <View key={index} style={styles.groupItem}>
                  <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, isDarkMode && styles.darkGroupName]}>
                      {group.groupName}
                    </Text>
                    <Text style={[styles.groupMembers, isDarkMode && styles.darkGroupMembers]}>
                      {group.members?.length || 0} members
                    </Text>
                  </View>
                  <View style={[
                    styles.groupStatus,
                    { backgroundColor: group.status?.toLowerCase() === 'active' ? '#4CAF50' : '#F44336' }
                  ]}>
                    <Text style={styles.groupStatusText}>
                      {group.status || 'Inactive'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, isDarkMode && styles.darkFooterText]}>
              Powered by: <Text style={styles.footerBrand}>MANSOFT</Text>
            </Text>
            <Text style={[styles.footerSub, isDarkMode && styles.darkFooterSub]}>
              Infinite Possibilities
            </Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.floatingDarkModeButton,
          isDarkMode && styles.floatingDarkModeButtonDark
        ]}
        onPress={toggleDarkMode}
      >
        <Ionicons 
          name={isDarkMode ? "sunny" : "moon"} 
          size={24} 
          color={isDarkMode ? "#FFD700" : "#FFFFFF"} 
        />
      </TouchableOpacity>

      <GroupAdminBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  darkSafeArea: { backgroundColor: '#121212' },
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
  darkLoadingText: {
    color: '#B0B0B0'
  },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: '#64B5F6',
    elevation: 3,
  },
  darkHeaderContainer: {
    backgroundColor: '#1E1E1E',
    borderBottomColor: '#333',
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
  appTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  titleBlack: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  darkTitleBlack: {
    color: '#FFFFFF'
  },
  titleGreen: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#4CAF50', 
    marginLeft: 4 
  },
  headerIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    minWidth: 40,
  },
  headerIconText: {
    fontSize: 8,
    color: '#1565C0',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  darkHeaderIconText: {
    color: '#90CAF9',
  },
  logoutText: {
    color: '#F44336',
  },

  floatingDarkModeButton: {
    position: 'absolute',
    right: 20,
    top: Dimensions.get('window').height / 2 - 28,
    backgroundColor: '#2196F3',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  floatingDarkModeButtonDark: {
    backgroundColor: '#333',
  },

  scrollContent: { 
    flexGrow: 1, 
    paddingBottom: 80 
  },
  darkScrollContent: { 
    backgroundColor: '#121212' 
  },
  mainContent: { 
    padding: 16 
  },

  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 4, 
    color: '#333' 
  },
  darkWelcomeText: { 
    color: '#FFFFFF' 
  },
  subtitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 6, 
    color: '#666' 
  },
  darkSubtitle: { 
    color: '#B0B0B0' 
  },
  dateText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  darkDateText: {
    color: '#888',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  darkStatCard: {
    backgroundColor: '#1E1E1E',
  },
  statCardContent: {
    alignItems: 'center',
    width: '100%',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconText: {
    fontSize: 18,
  },
  statTextContainer: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  darkStatValue: {
    color: '#FFFFFF',
  },
  statTitle: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  darkStatTitle: {
    color: '#B0B0B0',
  },

  sectionContainer: {
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
  darkSectionContainer: {
    backgroundColor: '#1E1E1E',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  darkSectionTitle: {
    color: '#FFFFFF',
  },
  link: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  darkDivider: {
    backgroundColor: '#333',
  },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickActionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    minHeight: 90,
    justifyContent: 'center',
  },
  darkQuickActionButton: {
    backgroundColor: '#1E1E1E',
    borderColor: '#333',
  },
  quickActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  quickActionText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 13,
  },
  darkQuickActionText: {
    color: '#FFFFFF',
  },

  contributionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contributionInfo: {
    flex: 1,
  },
  contributionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  darkContributionName: {
    color: '#FFFFFF',
  },
  contributionGroup: {
    fontSize: 12,
    color: '#666',
  },
  darkContributionGroup: {
    color: '#B0B0B0',
  },
  contributionMeta: {
    alignItems: 'flex-end',
  },
  contributionAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 2,
  },
  darkContributionAmount: {
    color: '#81C784',
  },
  contributionDate: {
    fontSize: 11,
    color: '#999',
  },
  darkContributionDate: {
    color: '#888',
  },

  pendingContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  darkPendingContainer: {
    backgroundColor: '#2D2D1A',
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
  },
  pendingLink: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  pendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  darkPendingName: {
    color: '#FFFFFF',
  },
  pendingDue: {
    fontSize: 11,
    color: '#E65100',
  },
  darkPendingDue: {
    color: '#FFB74D',
  },
  pendingAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E65100',
  },

  groupsList: {
    gap: 12,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  darkGroupName: {
    color: '#FFFFFF',
  },
  groupMembers: {
    fontSize: 12,
    color: '#666',
  },
  darkGroupMembers: {
    color: '#B0B0B0',
  },
  groupStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  footer: { 
    marginTop: 30, 
    alignItems: 'center' 
  },
  footerText: { 
    fontSize: 13, 
    color: '#555' 
  },
  darkFooterText: {
    color: '#B0B0B0',
  },
  footerBrand: { 
    fontWeight: 'bold', 
    color: '#4CAF50' 
  },
  footerSub: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  darkFooterSub: {
    color: '#888',
  },
  pendingPenalty: {
  fontSize: 10,
  color: '#F44336',
  marginTop: 2,
  fontWeight: '500',
},
pendingAmountContainer: {
  alignItems: 'flex-end',
},
pendingOriginalAmount: {
  fontSize: 9,
  color: '#FF9800',
  marginTop: 2,
},
});
import React, { useEffect, useState, useContext } from 'react';
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
import { router } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://192.168.0.101:8080/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  role: string;
  email: string;
}

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  route?: string;
}

export default function AdminDashboardScreen() {
  const { setUserRole } = useContext(AuthContext)!;
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [adminName, setAdminName] = useState('Admin');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [inactiveGroupAdminsCount, setInactiveGroupAdminsCount] = useState(0);

  // Dynamic sizing calculations
  const CARD_MARGIN = SCREEN_WIDTH * 0.02;
  const STAT_CARD_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * 8)) / 3;

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    await fetchMeetings();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'userEmail', 'userFirstName',
        'userLastName', 'userRole', 'userStatus', 'userTenantId',
        'userGroupId', 'userPhoneNumber', 'userJoinDate', 'userCreatedBy',
        'userModifiedBy', 'userCreatedOn', 'userModifiedOn'
      ]);
      setUserRole(null);
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Could not log out. Please try again.');
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(`${BASE_URL}/members`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Member[] = await response.json();
      setMembers(data);

      const count = data.filter(
        (m) => m.role === 'GroupAdmin' && m.status === 'Inactive'
      ).length;
      setInactiveGroupAdminsCount(count);

    } catch (err) {
      console.error('Error fetching members:', err);
      Alert.alert('Error', 'Failed to load member data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`${BASE_URL}/meetings`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setMeetings(data);
    } catch (err) {
      console.error('❌ Failed to fetch meetings:', err);
      Alert.alert('Error', 'Failed to load meeting data.');
    }
  };

  const countByStatus = (status: string) =>
    members.filter((m) => m.status === status).length;

  const countGroupAdmins = () =>
    members.filter((m) => m.role === 'GroupAdmin').length;

  const getUpcomingMeetingsInfo = () => {
    const today = new Date();
    const upcoming = meetings.filter((m) => new Date(m.meetingDate) >= today);

    upcoming.sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());

    const count = upcoming.length;
    const nextDate = count > 0 ? new Date(upcoming[0].meetingDate).toDateString() : 'N/A';

    return { count, nextDate };
  };

  useEffect(() => {
    fetchMembers();
    fetchMeetings();
    const getAdminName = async () => {
      const fname = await AsyncStorage.getItem('userFirstName');
      const lname = await AsyncStorage.getItem('userLastName');
      setAdminName(`${fname ?? 'Admin'} ${lname ?? ''}`.trim());
    };
    getAdminName();
  }, []);

  const statCards: StatCard[] = [
    {
      title: 'Total Members',
      value: members.length,
      icon: '👥',
      color: '#2196F3',
      route: '/(superadmin)/member-management'
    },
    {
      title: 'Active Members',
      value: countByStatus('Active'),
      icon: '✅',
      color: '#4CAF50',
      route: '/(superadmin)/member-management'
    },
    {
      title: 'Terminated Members',
      value: countByStatus('Terminated'),
      icon: '❌',
      color: '#F44336',
      route: '/(superadmin)/member-management'
    },
    {
      title: 'Inactive Members',
      value: countByStatus('Inactive'),
      icon: '⏸️',
      color: '#FF9800',
      route: '/(superadmin)/member-management'
    },
    {
      title: 'Group Admins',
      value: countGroupAdmins(),
      icon: '👑',
      color: '#9C27B0',
      route: '/(superadmin)/manage-group-admins'
    },
    {
      title: 'Inactive Group Admins',
      value: inactiveGroupAdminsCount,
      icon: '👑⏸️',
      color: '#607D8B',
      route: '/(superadmin)/manage-group-admins'
    },
  ];

  const quickActions = [
    { 
      name: 'Meetings', 
      icon: '📅', 
      route: '/(superadmin)/meeting-management', 
      color: '#FF5722' 
    },
    { 
      name: 'System Settings', 
      icon: '⚙️', 
      route: '/(superadmin)/admin-settings', 
      color: '#607D8B' 
    },
    { 
      name: 'Reports', 
      icon: '📊', 
      route: '/(superadmin)/contribution-report', 
      color: '#4CAF50' 
    },
  ];

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
      {/* Enhanced Header */}
      <View style={[styles.headerContainer, isDarkMode && styles.darkHeaderContainer]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.appTitleContainer}>
            <Text style={[styles.titleBlack, isDarkMode && styles.darkTitleBlack]}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>

        <View style={styles.headerIconsContainer}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={toggleDarkMode}
          >
            <Ionicons 
              name={isDarkMode ? "sunny" : "moon"} 
              size={24} 
              color={isDarkMode ? "#FFD700" : "#2196F3"} 
            />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>
              {isDarkMode ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(superadmin)/admin-profile')}
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
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, isDarkMode && styles.darkWelcomeText]}>
              Welcome back, {adminName}!
            </Text>
            <Text style={[styles.subtitle, isDarkMode && styles.darkSubtitle]}>
              Role: Super Admin
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

          {/* Statistics Grid - 3 columns layout */}
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

          {/* Quick Actions - Modern Design */}
          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                Quick Actions
              </Text>
            </View>
            
            {/* Divider line */}
            <View style={[styles.divider, isDarkMode && styles.darkDivider]} />
            
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickActionButton, 
                    isDarkMode && styles.darkQuickActionButton,
                    { width: STAT_CARD_WIDTH }
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

          {/* Upcoming Meetings Section */}
          {getUpcomingMeetingsInfo().count > 0 && (
            <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                  Next Meeting
                </Text>
                <TouchableOpacity onPress={() => router.push('/(superadmin)/meeting-management')}>
                  <Text style={styles.link}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.meetingInfo}>
                <Text style={[styles.meetingDate, isDarkMode && styles.darkMeetingDate]}>
                  {getUpcomingMeetingsInfo().nextDate}
                </Text>
                <Text style={[styles.meetingCount, isDarkMode && styles.darkMeetingCount]}>
                  {getUpcomingMeetingsInfo().count} upcoming meeting{getUpcomingMeetingsInfo().count !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* System Status */}
          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                System Status
              </Text>
              <View style={styles.statusIndicator}>
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={[styles.statusText, isDarkMode && styles.darkStatusText]}>All Systems Operational</Text>
              </View>
            </View>
            <View style={styles.systemStats}>
              <View style={styles.systemStat}>
                <Text style={[styles.systemStatValue, isDarkMode && styles.darkSystemStatValue]}>
                  {members.length}
                </Text>
                <Text style={[styles.systemStatLabel, isDarkMode && styles.darkSystemStatLabel]}>
                  Total Users
                </Text>
              </View>
              <View style={styles.systemStat}>
                <Text style={[styles.systemStatValue, isDarkMode && styles.darkSystemStatValue]}>
                  {countGroupAdmins()}
                </Text>
                <Text style={[styles.systemStatLabel, isDarkMode && styles.darkSystemStatLabel]}>
                  Group Admins
                </Text>
              </View>
              <View style={styles.systemStat}>
                <Text style={[styles.systemStatValue, isDarkMode && styles.darkSystemStatValue]}>
                  {meetings.length}
                </Text>
                <Text style={[styles.systemStatLabel, isDarkMode && styles.darkSystemStatLabel]}>
                  Total Meetings
                </Text>
              </View>
            </View>
          </View>

          {/* Footer */}
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

      <SuperAdminBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E9' },
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

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#FFE0B2',
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
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
    width: 40, 
    height: 40, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  appTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  titleBlack: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  darkTitleBlack: {
    color: '#FFFFFF'
  },
  titleRed: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#D32F2F', 
    marginLeft: 4 
  },
  headerIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  headerIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  headerIconText: {
    fontSize: 10,
    color: '#2E7D32',
    marginTop: 2,
    fontWeight: '500',
  },
  darkHeaderIconText: {
    color: '#81C784',
  },
  logoutText: {
    color: '#D32F2F',
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

  // Welcome Section
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

  // Statistics Grid - 3 columns layout
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

  // Section Styles
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

  // Divider style
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  darkDivider: {
    backgroundColor: '#333',
  },

  // Quick Actions - Modern Design
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

  // Meeting Info
  meetingInfo: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  meetingDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  darkMeetingDate: {
    color: '#FFFFFF',
  },
  meetingCount: {
    fontSize: 14,
    color: '#666',
  },
  darkMeetingCount: {
    color: '#B0B0B0',
  },

  // System Status
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  darkStatusText: {
    color: '#81C784',
  },
  systemStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  systemStat: {
    alignItems: 'center',
  },
  systemStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  darkSystemStatValue: {
    color: '#FFFFFF',
  },
  systemStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  darkSystemStatLabel: {
    color: '#B0B0B0',
  },

  // Footer
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
});
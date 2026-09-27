import React, { useContext, useState, useEffect } from 'react';
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
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../../app/_layout';
import MemberBottomNav from '../../components/MemberBottomNav';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://192.168.0.101:8080/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LoggedInMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  mansoftTenantId: string;
}

interface Contribution {
  id: string;
  member: { id: string };
  group: { id: string };
  transactionType: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  status: string;
  description?: string;
  createdBy: string;
  modifiedBy: string;
  createdOn: string;
  modifiedOn: string;
  mansoftTenantId: string;
}

interface Notification {
  id: string;
  member: { id: string };
  type: string;
  messageContent: string;
  sendDate: string;
  channel: string;
  read: boolean;
  createdOn: string;
}

interface RecentActivity {
  type: 'contribution' | 'reminder' | 'meeting';
  title: string;
  amount?: number;
  date: string;
  description: string;
  icon: string;
  color: string;
}

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  route?: string;
}

function MemberDashboardScreen() {
  const { setUserRole } = useContext(AuthContext)!;
  const colorScheme = useColorScheme();
  
  // Changed: Default to light mode regardless of system preference
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [memberData, setMemberData] = useState<LoggedInMember | null>(null);
  const [loadingMemberData, setLoadingMemberData] = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState<{ message: string; unread: boolean } | null>(null);
  const [upcomingMeeting, setUpcomingMeeting] = useState<{ date: string; title: string } | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [greeting, setGreeting] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingMeetingsCount, setUpcomingMeetingsCount] = useState(0);
  const [allMeetings, setAllMeetings] = useState<any[]>([]);
  const [totalGroupVolunteerContributions, setTotalGroupVolunteerContributions] = useState(0);

  // Dynamic sizing calculations - Changed back to 3 columns for first row
  const CARD_MARGIN = SCREEN_WIDTH * 0.02;
  const STAT_CARD_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * 8)) / 3; // Changed back to 3 columns

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMemberData();
    await fetchContributions();
    await fetchDashboardData();
    setRefreshing(false);
  };

  const fetchMemberData = async () => {
    try {
      const storedId = await AsyncStorage.getItem('userId');
      const storedFirstName = await AsyncStorage.getItem('userFirstName');
      const storedLastName = await AsyncStorage.getItem('userLastName');
      const storedEmail = await AsyncStorage.getItem('userEmail');
      const storedRole = await AsyncStorage.getItem('userRole');
      const storedStatus = await AsyncStorage.getItem('userStatus');
      const storedTenantId = await AsyncStorage.getItem('userTenantId');

      if (storedId && storedFirstName && storedLastName && storedEmail && storedRole && storedStatus && storedTenantId) {
        setMemberData({
          id: storedId,
          firstName: storedFirstName,
          lastName: storedLastName,
          email: storedEmail,
          role: storedRole,
          status: storedStatus,
          mansoftTenantId: storedTenantId,
        });
      } else {
        handleLogout();
      }
    } catch (error) {
      console.error('Error fetching member data from storage:', error);
      handleLogout();
    } finally {
      setLoadingMemberData(false);
    }
  };

  const fetchContributions = async () => {
    if (!memberData?.id) return;
    setLoadingContributions(true);
    try {
      const response = await fetch(`${BASE_URL}/contributions/member/${memberData.id}`);
      if (response.ok) {
        const data: Contribution[] = await response.json();
        setContributions(data);
      } else {
        console.error(`Error fetching contributions: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching contributions:', error);
    } finally {
      setLoadingContributions(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!memberData?.id) return;

    // Fetch Latest Notification
    try {
      const response = await fetch(`${BASE_URL}/notifications`);
      if (response.ok) {
        const allNotifications: Notification[] = await response.json();
        
        const userNotifications = allNotifications.filter(
          (n) => n.member?.id === memberData.id
        );

        userNotifications.sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime());
        const latest = userNotifications.length > 0 ? userNotifications[userNotifications.length - 1] : null;

        if (latest) {
          if (!latest.read) {
            setNotificationStatus({
              message: latest.messageContent || latest.type || 'New unread notification 🔔',
              unread: true
            });
          } else {
            setNotificationStatus({
              message: latest.messageContent || latest.type || 'Latest notification',
              unread: false
            });
          }
        } else {
          setNotificationStatus(null);
        }
      } else {
        console.error(`Error fetching notifications: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    // ✅ FIXED: Fetch meetings and filter by group
  try {
    const response = await fetch(`${BASE_URL}/meetings`);
    console.log('🔍 Meetings API Response status:', response.status);
    
    if (response.ok) {
      const meetingsData = await response.json();
      console.log('📅 All meetings data:', meetingsData.length);
      
      // ✅ Get the user's group ID
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      console.log('👤 User Group ID:', userGroupId);

      // ✅ Filter meetings for the user's group only
      const groupMeetings = meetingsData.filter((m: any) => {
        // Check different possible group ID field names
        const meetingGroupId = m.group?.id || m.groupId || m.group_id;
        return meetingGroupId === userGroupId;
      });
      
      console.log('📋 Group meetings:', groupMeetings.length);

      // ✅ Count upcoming meetings (meetings with future dates)
      const now = new Date();
      const upcomingMeetings = groupMeetings.filter((m: any) => {
        try {
          // ✅ Try different possible date fields
          let meetingDate = null;
          
          if (m.meetingDate) {
            meetingDate = new Date(m.meetingDate);
          } else if (m.date) {
            meetingDate = new Date(m.date);
          } else if (m.startTime) {
            meetingDate = new Date(m.startTime);
          } else if (m.createdOn) {
            meetingDate = new Date(m.createdOn);
          }
          
          // ✅ Combine with meeting time if available
          if (meetingDate && m.meetingTime) {
            const timeParts = m.meetingTime.split(':');
            if (timeParts.length >= 2) {
              meetingDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0);
            }
          }
          
          const isValid = meetingDate !== null && meetingDate.toString() !== 'Invalid Date';
          const isFuture = isValid && (meetingDate as Date) > now;
          
          return isFuture;
        } catch (error) {
          console.log('❌ Error parsing meeting date:', m.title, error);
          return false;
        }
      });
      
      console.log('✅ Upcoming meetings count:', upcomingMeetings.length);
      setUpcomingMeetingsCount(upcomingMeetings.length);

      // ✅ Set the next upcoming meeting for display
      if (upcomingMeetings.length > 0) {
        // Sort by date (soonest first)
        upcomingMeetings.sort((a: any, b: any) => {
          const dateA = new Date(a.meetingDate || a.date || a.startTime);
          const dateB = new Date(b.meetingDate || b.date || b.startTime);
          return dateA.getTime() - dateB.getTime();
        });
        
        const nextMeeting = upcomingMeetings[0];
        console.log('📌 Next meeting:', nextMeeting.title);
        
        let meetingDate = new Date(nextMeeting.meetingDate || nextMeeting.date || nextMeeting.startTime);
        
        // ✅ Combine with time
        if (nextMeeting.meetingTime) {
          const timeParts = nextMeeting.meetingTime.split(':');
          if (timeParts.length >= 2) {
            meetingDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0);
          }
        }
        
        const dateStr = meetingDate.toString() !== 'Invalid Date' 
          ? meetingDate.toLocaleString('en-KE', {
              weekday: 'short', 
              day: '2-digit', 
              month: 'short', 
              hour: '2-digit', 
              minute: '2-digit',
            })
          : 'Date TBD';
        
        setUpcomingMeeting({
          date: dateStr,
          title: nextMeeting.title || 'Upcoming Meeting',
        });
      } else {
        console.log('❌ No upcoming meetings found for this group');
        setUpcomingMeeting(null);
        setUpcomingMeetingsCount(0);
      }
    } else {
      console.error(`❌ Error fetching meetings: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Error fetching meetings:', error);
  }

    // Fetch Total Group Volunteer Contributions
    try {
      // First, get the group ID from member data or storage
      const groupId = await AsyncStorage.getItem('userGroupId');
      if (groupId) {
        const response = await fetch(`${BASE_URL}/contributions/group/${groupId}`);
        if (response.ok) {
          const allGroupContributions = await response.json();
          
          // Filter for volunteer contributions (adjust the condition based on your API)
          const volunteerContributions = allGroupContributions.filter((contribution: Contribution) => 
            contribution.transactionType?.toLowerCase().includes('volunteer') || 
            contribution.description?.toLowerCase().includes('volunteer')
          );
          
          // Calculate total amount
          const totalVolunteerAmount = volunteerContributions.reduce(
            (sum: number, contribution: Contribution) => sum + (contribution.amount || 0), 
            0
          );
          
          setTotalGroupVolunteerContributions(totalVolunteerAmount);
          console.log('📊 Total Group Volunteer Contributions:', totalVolunteerAmount);
        } else {
          console.error(`❌ Error fetching group contributions: ${response.status} ${response.statusText}`);
        }
      } else {
        console.log('⚠️ No group ID found for member');
      }
    } catch (error) {
      console.error('❌ Error fetching group volunteer contributions:', error);
    }
  };

  useEffect(() => {
    fetchMemberData();
  }, []);

  useEffect(() => {
    if (memberData?.id) {
      fetchContributions();
      fetchDashboardData();
    }
  }, [memberData?.id]);

  // Generate recent activities based on contributions and reminders
  useEffect(() => {
    if (!memberData?.id) return;

    const activities: RecentActivity[] = [];

    // Add latest contribution if available
    if (contributions.length > 0) {
      const latestContribution = [...contributions]
        .filter(c => c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed')
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())[0];

      if (latestContribution) {
        activities.push({
          type: 'contribution',
          title: 'Recent Contribution',
          amount: latestContribution.amount,
          date: new Date(latestContribution.transactionDate).toLocaleDateString('en-KE', {
            day: 'numeric',
            month: 'short'
          }),
          description: `KES ${latestContribution.amount.toLocaleString('en-KE')} via ${latestContribution.paymentMethod}`,
          icon: '💰',
          color: '#4CAF50'
        });
      }
    }

    // Add contribution reminder
    const completedContributions = contributions.filter(
      c => c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed'
    );

    if (completedContributions.length > 0) {
      const lastContribution = [...completedContributions].sort(
        (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
      )[0];

      const lastContributionDate = new Date(lastContribution.transactionDate);
      const currentDate = new Date();
      const monthsDiff = (currentDate.getFullYear() - lastContributionDate.getFullYear()) * 12 + 
                        (currentDate.getMonth() - lastContributionDate.getMonth());

      if (monthsDiff >= 1) {
        let reminderMessage = '';
        let reminderColor = '#FF9800';
        
        if (monthsDiff === 1) {
          reminderMessage = 'Monthly contribution reminder';
        } else if (monthsDiff === 2) {
          reminderMessage = 'Urgent: 2 months overdue';
          reminderColor = '#F44336';
        } else if (monthsDiff >= 3) {
          reminderMessage = `Critical: ${monthsDiff} months overdue`;
          reminderColor = '#D32F2F';
        }

        activities.push({
          type: 'reminder',
          title: 'Contribution Reminder',
          date: 'Now',
          description: reminderMessage,
          icon: '⏰',
          color: reminderColor
        });
      }
    } else if (contributions.length === 0) {
      // No contributions made yet
      activities.push({
        type: 'reminder',
        title: 'Welcome!',
        date: 'Now',
        description: 'Make your first contribution to get started',
        icon: '👋',
        color: '#2196F3'
      });
    }

    // Add meeting if exists
    if (upcomingMeeting) {
      activities.push({
        type: 'meeting',
        title: 'Upcoming Meeting',
        date: upcomingMeeting.date !== 'Date TBD' ? upcomingMeeting.date.split(',')[0] : 'TBD',
        description: upcomingMeeting.title,
        icon: '📅',
        color: '#9C27B0'
      });
    }

    setRecentActivities(activities.slice(0, 4)); // Show only 4 most recent activities
  }, [contributions, upcomingMeeting, memberData?.id]);

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
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  const totalContributed = contributions
  .filter(c => c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed')
  .reduce((sum, c) => sum + c.amount, 0);
  const totalContributionsCount = contributions.filter(c => 
    c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed'
  ).length;

  // Statistics Cards - Updated with 4 cards including volunteer contributions
  const statCards: StatCard[] = [
    {
      title: 'Total Contributed',
      value: `KES ${totalContributed.toLocaleString()}`,
      icon: '💰',
      color: '#4CAF50',
      route: '/(member)/mycontributions'
    },
    {
      title: 'Contributions Made',
      value: totalContributionsCount,
      icon: '📊',
      color: '#2196F3',
      route: '/(member)/mycontributions'
    },
    {
      title: upcomingMeetingsCount > 0 ? 'Upcoming Meetings' : 'No Upcoming Meetings',
      value: upcomingMeetingsCount,
      icon: upcomingMeetingsCount > 0 ? '📅' : '⏸️',
      color: upcomingMeetingsCount > 0 ? '#9C27B0' : '#757575',
      route: '/(member)/meetings'
    },
    {
      title: 'Group Volunteer',
      value: `KES ${totalGroupVolunteerContributions.toLocaleString()}`,
      icon: '🤝',
      color: '#FF9800',
      route: '/(member)/volunteercontributions' // You'll need to create this screen
    },
  ];

  // Quick Actions for Members
  const quickActions = [
    { name: 'Make Contribution', icon: '💰', route: '/(member)/mycontributions', color: '#4CAF50' },
    { name: 'Notifications', icon: '🔔', route: '/(member)/notifications', color: '#FF9800' },
    { name: 'My Profile', icon: '👤', route: '/(member)/profile', color: '#2196F3' },
    { name: 'Loan Status', icon: '📝', route: '/(member)/loans', color: '#F44336' },
    { name: 'Dividends', icon: '🎁', route: '/(member)/dividends', color: '#FF9800' },
    { name: 'Guarantee Requests', icon: '🤝', route: '/(member)/guarantor-requests', color: '#9C27B0' },
  ];

  if (loadingMemberData || loadingContributions) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.loadingText, isDarkMode && styles.darkLoadingText]}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memberData) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, isDarkMode && styles.darkLoadingText]}>
            Error loading user data. Please log in again.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = `${memberData.firstName} ${memberData.lastName}`;
  const displayRole = memberData.role;

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
      {/* Enhanced Header with better responsive layout */}
      <View style={[styles.headerContainer, isDarkMode && styles.darkHeaderContainer]}>
        <View style={styles.headerLeft}>
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
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={toggleDarkMode}
          >
            <Ionicons 
              name={isDarkMode ? "sunny" : "moon"} 
              size={22} 
              color={isDarkMode ? "#FFD700" : "#4CAF50"} 
            />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>
              {isDarkMode ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(member)/profile')}
          >
            <Ionicons name="person" size={22} color={isDarkMode ? "#90CAF9" : "#4CAF50"} />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={22} color="#F44336" />
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
            colors={['#4CAF50']}
            tintColor={isDarkMode ? '#81C784' : '#4CAF50'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, isDarkMode && styles.darkWelcomeText]}>
              {greeting}, {displayName}!
            </Text>
            <Text style={[styles.subtitle, isDarkMode && styles.darkSubtitle]}>
              Role: {displayRole}
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

          {/* Statistics Grid - First row with 3 cards */}
          <View style={styles.statsGrid}>
            {statCards.slice(0, 3).map((card, index) => (
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

          {/* Second row - Only the volunteer card */}
          <View style={styles.secondRowContainer}>
            {statCards.slice(3, 4).map((card, index) => (
              <TouchableOpacity
                key={index + 3}
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

          {/* Quick Actions - Updated to match the group admin design */}
          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                Quick Actions
              </Text>
            </View>
            
            {/* Divider line like in the group admin */}
            <View style={[styles.divider, isDarkMode && styles.darkDivider]} />
            
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickActionButton, 
                    isDarkMode && styles.darkQuickActionButton,
                    { width: (SCREEN_WIDTH - (CARD_MARGIN * 8)) / 3 } // Keep 3 columns for quick actions
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

          {/* Recent Activities Section */}
          <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                Recent Activities
              </Text>
              <TouchableOpacity onPress={() => router.push('/(member)/mycontributions')}>
                <Text style={styles.link}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: activity.color }]}>
                    <Text style={styles.activityIconText}>{activity.icon}</Text>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityItemTitle, isDarkMode && styles.darkActivityItemTitle]}>
                      {activity.title}
                    </Text>
                    <Text style={[styles.activityItemDescription, isDarkMode && styles.darkActivityItemDescription]}>
                      {activity.description}
                    </Text>
                  </View>
                  <View style={styles.activityMeta}>
                    <Text style={[styles.activityDate, isDarkMode && styles.darkActivityDate]}>
                      {activity.date}
                    </Text>
                    {activity.amount && (
                      <Text style={[styles.activityAmount, isDarkMode && styles.darkActivityAmount]}>
                        KES {activity.amount.toLocaleString('en-KE')}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noActivities}>
                <Text style={[styles.noActivitiesText, isDarkMode && styles.darkNoActivitiesText]}>
                  No recent activities
                </Text>
                <TouchableOpacity 
                  style={styles.contributeButton}
                  onPress={() => router.push('/(member)/mycontributions')}
                >
                  <Text style={styles.contributeButtonText}>Make Your First Contribution</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Upcoming Events Summary */}
          {(upcomingMeeting || notificationStatus) && (
            <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                  Upcoming & Notifications
                </Text>
              </View>
              
              {upcomingMeeting && (
                <View style={styles.eventItem}>
                  <View style={[styles.eventIcon, { backgroundColor: '#9C27B0' }]}>
                    <Text style={styles.eventIconText}>📅</Text>
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, isDarkMode && styles.darkEventTitle]}>
                      {upcomingMeeting.title}
                    </Text>
                    <Text style={[styles.eventDate, isDarkMode && styles.darkEventDate]}>
                      {upcomingMeeting.date}
                    </Text>
                  </View>
                </View>
              )}
              
              {notificationStatus && (
                <View style={styles.eventItem}>
                  <View style={[styles.eventIcon, { 
                    backgroundColor: notificationStatus.unread ? '#F44336' : '#FF9800' 
                  }]}>
                    <Text style={styles.eventIconText}>🔔</Text>
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={[
                      styles.eventTitle, 
                      isDarkMode && styles.darkEventTitle,
                      notificationStatus.unread && styles.unreadNotification
                    ]}>
                      {notificationStatus.message}
                    </Text>
                    <Text style={[styles.eventDate, isDarkMode && styles.darkEventDate]}>
                      {notificationStatus.unread ? 'Unread' : 'Read'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

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

      <MemberBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E8' },
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
  button: { 
    backgroundColor: '#4CAF50', 
    paddingVertical: 12, 
    borderRadius: 8, 
    width: '60%', 
    marginTop: 20, 
    alignItems: 'center' 
  },
  buttonText: { 
    color: 'white', 
    fontSize: 16, 
    textAlign: 'center' 
  },

  // Enhanced Header Styles with better responsive layout
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#C8E6C9',
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
    elevation: 3,
    minHeight: 60,
  },
  darkHeaderContainer: {
    backgroundColor: '#1E1E1E',
    borderBottomColor: '#333',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flexShrink: 1,
  },
  logo: { 
    width: 36, 
    height: 36, 
    resizeMode: 'contain', 
    marginRight: 6 
  },
  appTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flexShrink: 1,
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
  headerIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    minWidth: 45,
  },
  headerIconText: {
    fontSize: 9,
    color: '#2E7D32',
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

  scrollContent: { 
    flexGrow: 1, 
    paddingBottom: 140 
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

  // Statistics Grid - First row with 3 cards
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  secondRowContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
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

  // Quick Actions - Updated styles to match group admin
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

  // Activity Items
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 16,
    color: '#FFF',
  },
  activityContent: {
    flex: 1,
  },
  activityItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  darkActivityItemTitle: {
    color: '#FFFFFF',
  },
  activityItemDescription: {
    fontSize: 14,
    color: '#666',
  },
  darkActivityItemDescription: {
    color: '#B0B0B0',
  },
  activityMeta: {
    alignItems: 'flex-end',
  },
  activityDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  darkActivityDate: {
    color: '#888',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  darkActivityAmount: {
    color: '#81C784',
  },

  // No Activities
  noActivities: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noActivitiesText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 12,
  },
  darkNoActivitiesText: {
    color: '#888',
  },
  contributeButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  contributeButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Event Items (Upcoming & Notifications)
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventIconText: {
    fontSize: 16,
    color: '#FFF',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  darkEventTitle: {
    color: '#FFFFFF',
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
  },
  darkEventDate: {
    color: '#B0B0B0',
  },
  unreadNotification: {
    color: '#F44336',
    fontWeight: 'bold',
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

export default MemberDashboardScreen;
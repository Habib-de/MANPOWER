import React, { useContext, useState, useEffect, useRef } from 'react';
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
  useWindowDimensions,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../../app/_layout';
import MemberBottomNav, { MemberDesktopNav } from '../../components/MemberBottomNav';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://192.168.0.102:8080/api';

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

const VISIBLE_CARDS = 3;
const AUTO_SLIDE_MS = 5000;

function CardCarousel({
  items,
  cardWidth,
  gap,
  isDarkMode,
}: {
  items: React.ReactNode[];
  cardWidth: number;
  gap: number;
  isDarkMode: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const step = cardWidth + gap;
  const maxIndex = Math.max(0, items.length - VISIBLE_CARDS);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(i, maxIndex));
    indexRef.current = clamped;
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * step, animated: true });
  };

  useEffect(() => {
    if (paused || maxIndex === 0) return;
    const timer = setInterval(() => {
      goTo(indexRef.current >= maxIndex ? 0 : indexRef.current + 1);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [paused, maxIndex, step]);

  const handleScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / step);
    const clamped = Math.max(0, Math.min(i, maxIndex));
    indexRef.current = clamped;
    setIndex(clamped);
    setPaused(false);
  };

  return (
    <View style={styles.carouselWrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollRow}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          if (e.nativeEvent.velocity?.x === 0) handleScrollEnd(e);
        }}
      >
        {items}
      </ScrollView>

      {index > 0 && (
        <TouchableOpacity
          style={[styles.arrowButton, styles.arrowLeft, isDarkMode && styles.arrowButtonDark]}
          onPress={() => { setPaused(true); goTo(index - 1); setTimeout(() => setPaused(false), 100); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={16} color={isDarkMode ? '#FFFFFF' : '#2E7D32'} />
        </TouchableOpacity>
      )}

      {index < maxIndex && (
        <TouchableOpacity
          style={[styles.arrowButton, styles.arrowRight, isDarkMode && styles.arrowButtonDark]}
          onPress={() => { setPaused(true); goTo(index + 1); setTimeout(() => setPaused(false), 100); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-forward" size={16} color={isDarkMode ? '#FFFFFF' : '#2E7D32'} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function MemberDashboardScreen() {
  const { setUserRole } = useContext(AuthContext)!;
  const colorScheme = useColorScheme();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);

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
  const [totalGroupVolunteerContributions, setTotalGroupVolunteerContributions] = useState(0);

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const GRID_GAP = 8;

  const SIDEBAR_WIDTH = isDesktop ? 260 : 0;
  const statsAvailable = windowWidth - SIDEBAR_WIDTH - 32;
  const quickAvailable = statsAvailable - 32;

  const STAT_COLS = 4;
  const QUICK_COLS = isDesktop ? 6 : 3;

  const STAT_CARD_WIDTH = Math.floor((statsAvailable - GRID_GAP * (STAT_COLS - 1)) / STAT_COLS);
  const QUICK_ACTION_WIDTH = Math.floor((quickAvailable - GRID_GAP * (QUICK_COLS - 1)) / QUICK_COLS);
  const MODAL_CARD_WIDTH = Math.floor((windowWidth - 32 - GRID_GAP * 2) / 3);

  const renderCardRow = (cards: React.ReactNode[], cardWidth: number) =>
    isDesktop ? (
      <View style={styles.gridWrap}>{cards}</View>
    ) : (
      <CardCarousel
        items={cards}
        cardWidth={cardWidth}
        gap={GRID_GAP}
        isDarkMode={isDarkMode}
      />
    );

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

    try {
      const response = await fetch(`${BASE_URL}/notifications`);
      if (response.ok) {
        const allNotifications: Notification[] = await response.json();
        const userNotifications = allNotifications.filter((n) => n.member?.id === memberData.id);
        userNotifications.sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime());
        const latest = userNotifications.length > 0 ? userNotifications[userNotifications.length - 1] : null;

        if (latest) {
          setNotificationStatus({
            message: latest.messageContent || latest.type || (latest.read ? 'Latest notification' : 'New unread notification 🔔'),
            unread: !latest.read,
          });
        } else {
          setNotificationStatus(null);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    try {
      const response = await fetch(`${BASE_URL}/meetings`);
      if (response.ok) {
        const meetingsData = await response.json();
        const userGroupId = await AsyncStorage.getItem('userGroupId');

        const groupMeetings = meetingsData.filter((m: any) => {
          const meetingGroupId = m.group?.id || m.groupId || m.group_id;
          return meetingGroupId === userGroupId;
        });

        const now = new Date();
        const upcomingMeetings = groupMeetings.filter((m: any) => {
          try {
            let meetingDate: Date | null = null;
            if (m.meetingDate) meetingDate = new Date(m.meetingDate);
            else if (m.date) meetingDate = new Date(m.date);
            else if (m.startTime) meetingDate = new Date(m.startTime);

            if (meetingDate && m.meetingTime) {
              const [h, min] = m.meetingTime.split(':');
              meetingDate.setHours(parseInt(h), parseInt(min), 0);
            }

            return meetingDate && !isNaN(meetingDate.getTime()) && meetingDate > now;
          } catch {
            return false;
          }
        });

        setUpcomingMeetingsCount(upcomingMeetings.length);

        if (upcomingMeetings.length > 0) {
          upcomingMeetings.sort((a: any, b: any) => {
            const dateA = new Date(a.meetingDate || a.date || a.startTime).getTime();
            const dateB = new Date(b.meetingDate || b.date || b.startTime).getTime();
            return dateA - dateB;
          });

          const nextMeeting = upcomingMeetings[0];
          let meetingDate = new Date(nextMeeting.meetingDate || nextMeeting.date || nextMeeting.startTime);
          if (nextMeeting.meetingTime) {
            const [h, min] = nextMeeting.meetingTime.split(':');
            meetingDate.setHours(parseInt(h), parseInt(min), 0);
          }

          setUpcomingMeeting({
            date: isNaN(meetingDate.getTime())
              ? 'Date TBD'
              : meetingDate.toLocaleString('en-KE', {
                  weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                }),
            title: nextMeeting.title || 'Upcoming Meeting',
          });
        } else {
          setUpcomingMeeting(null);
        }
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }

    try {
      const groupId = await AsyncStorage.getItem('userGroupId');
      if (groupId) {
        const response = await fetch(`${BASE_URL}/contributions/group/${groupId}`);
        if (response.ok) {
          const allGroupContributions = await response.json();
          const volunteerContributions = allGroupContributions.filter((contribution: Contribution) =>
            contribution.transactionType?.toLowerCase().includes('volunteer') ||
            contribution.description?.toLowerCase().includes('volunteer')
          );
          const totalVolunteerAmount = volunteerContributions.reduce(
            (sum: number, c: Contribution) => sum + (c.amount || 0), 0
          );
          setTotalGroupVolunteerContributions(totalVolunteerAmount);
        }
      }
    } catch (error) {
      console.error('Error fetching group volunteer contributions:', error);
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

  useEffect(() => {
    if (!memberData?.id) return;

    const activities: RecentActivity[] = [];

    if (contributions.length > 0) {
      const latestContribution = [...contributions]
        .filter(c => c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed')
        .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())[0];

      if (latestContribution) {
        activities.push({
          type: 'contribution',
          title: 'Recent Contribution',
          amount: latestContribution.amount,
          date: new Date(latestContribution.transactionDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }),
          description: `KES ${latestContribution.amount.toLocaleString('en-KE')} via ${latestContribution.paymentMethod}`,
          icon: '💰',
          color: '#4CAF50',
        });
      }
    }

    const completedContributions = contributions.filter(
      c => c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed'
    );

    if (completedContributions.length > 0) {
      const lastContribution = [...completedContributions].sort(
        (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
      )[0];

      const lastDate = new Date(lastContribution.transactionDate);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());

      if (monthsDiff >= 1) {
        let message = 'Monthly contribution reminder';
        let color = '#FF9800';
        if (monthsDiff === 2) { message = 'Urgent: 2 months overdue'; color = '#F44336'; }
        else if (monthsDiff >= 3) { message = `Critical: ${monthsDiff} months overdue`; color = '#D32F2F'; }

        activities.push({
          type: 'reminder',
          title: 'Contribution Reminder',
          date: 'Now',
          description: message,
          icon: '⏰',
          color,
        });
      }
    } else if (contributions.length === 0) {
      activities.push({
        type: 'reminder',
        title: 'Welcome!',
        date: 'Now',
        description: 'Make your first contribution to get started',
        icon: '👋',
        color: '#2196F3',
      });
    }

    if (upcomingMeeting) {
      activities.push({
        type: 'meeting',
        title: 'Upcoming Meeting',
        date: upcomingMeeting.date !== 'Date TBD' ? upcomingMeeting.date.split(',')[0] : 'TBD',
        description: upcomingMeeting.title,
        icon: '📅',
        color: '#9C27B0',
      });
    }

    setRecentActivities(activities.slice(0, 4));
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

  const totalContributionsCount = contributions.filter(
    c => c.status === 'COMPLETED' || c.status === 'SUCCESS' || c.status === 'Completed'
  ).length;

  const statCards: StatCard[] = [
    { title: 'Total Contributed', value: `KES ${totalContributed.toLocaleString()}`, icon: 'cash', color: '#4CAF50', route: '/(member)/mycontributions' },
    { title: 'Contributions Made', value: totalContributionsCount, icon: 'stats-chart', color: '#2196F3', route: '/(member)/mycontributions' },
    { title: upcomingMeetingsCount > 0 ? 'Upcoming Meetings' : 'No Upcoming Meetings', value: upcomingMeetingsCount, icon: upcomingMeetingsCount > 0 ? 'calendar' : 'pause-circle', color: upcomingMeetingsCount > 0 ? '#9C27B0' : '#757575', route: '/(member)/meetings' },
    { title: 'Group Volunteer', value: `KES ${totalGroupVolunteerContributions.toLocaleString()}`, icon: 'heart', color: '#FF9800', route: '/(member)/volunteercontributions' },
  ];

  const quickActions = [
    { name: 'Make Contribution', icon: 'cash', route: '/(member)/mycontributions', color: '#4CAF50' },
    { name: 'Notifications', icon: 'notifications', route: '/(member)/notifications', color: '#FF9800' },
    { name: 'My Profile', icon: 'person', route: '/(member)/profile', color: '#2196F3' },
    { name: 'Loan Status', icon: 'document-text', route: '/(member)/loans', color: '#F44336' },
    { name: 'Dividends', icon: 'gift', route: '/(member)/dividends', color: '#FF9800' },
    { name: 'Guarantee Requests', icon: 'shield-checkmark', route: '/(member)/guarantor-requests', color: '#9C27B0' },
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

      {/* HEADER */}
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
          <TouchableOpacity style={styles.headerIconButton} onPress={toggleDarkMode}>
            <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={22} color={isDarkMode ? '#FFD700' : '#4CAF50'} />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>
              {isDarkMode ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push('/(member)/profile')}>
            <Ionicons name="person" size={22} color={isDarkMode ? '#90CAF9' : '#4CAF50'} />
            <Text style={[styles.headerIconText, isDarkMode && styles.darkHeaderIconText]}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerIconButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={22} color="#F44336" />
            <Text style={[styles.headerIconText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BODY (sidebar + content) */}
      <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>

        {isDesktop && (
          <MemberDesktopNav current="home" isDarkMode={isDarkMode} />
        )}

        <View style={{ flex: 1 }}>
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

              {/* Welcome */}
              <View style={styles.welcomeSection}>
                <Text style={[styles.welcomeText, isDarkMode && styles.darkWelcomeText]}>
                  {greeting}, {displayName}!
                </Text>
                <Text style={[styles.subtitle, isDarkMode && styles.darkSubtitle]}>
                  Role: {displayRole}
                </Text>
                <Text style={[styles.dateText, isDarkMode && styles.darkDateText]}>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </Text>
              </View>

              {/* Stat Cards */}
              <View style={styles.statsGrid}>
                {statCards.map((card, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    style={[styles.statCard, isDarkMode && styles.darkStatCard, { flexBasis: STAT_CARD_WIDTH, flexGrow: 1 }]}
                    onPress={() => card.route && router.push(card.route as any)}
                  >
                    <View style={[styles.statIconCircle, { backgroundColor: card.color }]}>
                      <Ionicons name={card.icon as any} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.statValue, isDarkMode && styles.darkStatValue]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {card.value}
                    </Text>
                    <Text style={[styles.statTitle, isDarkMode && styles.darkStatTitle]} numberOfLines={2}>
                      {card.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick Actions */}
              <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>Quick Actions</Text>
                  {!isDesktop && (
                    <TouchableOpacity onPress={() => setShowAllActions(true)}>
                      <Text style={styles.link}>See all</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[styles.divider, isDarkMode && styles.darkDivider]} />
                <View style={styles.quickActionsGrid}>
                  {renderCardRow(
                    quickActions.map((action, index) => (
                      <TouchableOpacity
                        key={index}
                        activeOpacity={0.7}
                        style={[styles.quickActionButton, isDarkMode && styles.darkQuickActionButton, { width: QUICK_ACTION_WIDTH }]}
                        onPress={() => router.push(action.route as any)}
                      >
                        <View style={[styles.quickActionIconContainer, { backgroundColor: action.color }]}>
                          <Ionicons name={action.icon as any} size={18} color="#FFFFFF" />
                        </View>
                        <Text style={[styles.quickActionText, isDarkMode && styles.darkQuickActionText]} numberOfLines={2}>
                          {action.name}
                        </Text>
                      </TouchableOpacity>
                    )),
                    QUICK_ACTION_WIDTH
                  )}
                </View>
              </View>

              {/* Recent Activities */}
              <View style={[styles.sectionContainer, isDarkMode && styles.darkSectionContainer]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>Recent Activities</Text>
                  <TouchableOpacity onPress={() => router.push('/(member)/mycontributions')}>
                    <Text style={styles.link}>View All</Text>
                  </TouchableOpacity>
                </View>

                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
                    <View key={index} style={styles.activityItem}>
                      <View style={[styles.activityIcon, { backgroundColor: activity.color }]}>
                        <Ionicons name={activity.icon as any} size={20} color="#FFFFFF" />
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

              {/* Upcoming & Notifications */}
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
                        <Ionicons name="calendar" size={20} color="#FFFFFF" />
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
                      <View style={[styles.eventIcon, { backgroundColor: notificationStatus.unread ? '#F44336' : '#FF9800' }]}>
                        <Ionicons name="notifications" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.eventContent}>
                        <Text style={[styles.eventTitle, isDarkMode && styles.darkEventTitle, notificationStatus.unread && styles.unreadNotification]}>
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
        </View>
      </View>

      {/* MODAL */}
      <Modal
        visible={showAllActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllActions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, isDarkMode && styles.modalSheetDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>
                All Quick Actions
              </Text>
              <TouchableOpacity onPress={() => setShowAllActions(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#333'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalGrid}>
                {quickActions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    style={[styles.quickActionButton, isDarkMode && styles.darkQuickActionButton, { width: MODAL_CARD_WIDTH }]}
                    onPress={() => {
                      setShowAllActions(false);
                      router.push(action.route as any);
                    }}
                  >
                    <View style={[styles.quickActionIconContainer, { backgroundColor: action.color }]}>
                      <Ionicons name={action.icon as any} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.quickActionText, isDarkMode && styles.darkQuickActionText]} numberOfLines={2}>
                      {action.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <MemberBottomNav current="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E8' },
  darkSafeArea: { backgroundColor: '#121212' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  darkLoadingText: { color: '#B0B0B0' },
  button: { backgroundColor: '#4CAF50', paddingVertical: 12, borderRadius: 8, width: '60%', marginTop: 20, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16, textAlign: 'center' },

  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#C8E6C9',
    borderBottomWidth: 1, borderBottomColor: '#A5D6A7', elevation: 3, minHeight: 60,
  },
  darkHeaderContainer: { backgroundColor: '#1E1E1E', borderBottomColor: '#333' },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  logo: { width: 36, height: 36, resizeMode: 'contain', marginRight: 6 },
  appTitleContainer: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  titleBlack: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  darkTitleBlack: { color: '#FFFFFF' },
  titleGreen: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', marginLeft: 4 },
  headerIconButton: { alignItems: 'center', justifyContent: 'center', padding: 4, minWidth: 45 },
  headerIconText: { fontSize: 9, color: '#2E7D32', marginTop: 2, fontWeight: '500', textAlign: 'center' },
  darkHeaderIconText: { color: '#90CAF9' },
  logoutText: { color: '#F44336' },

  scrollContent: { flexGrow: 1, paddingBottom: 140 },
  darkScrollContent: { backgroundColor: '#121212' },
  mainContent: { padding: 16 },

  welcomeSection: { marginBottom: 20 },
  welcomeText: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  darkWelcomeText: { color: '#FFFFFF' },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: '#666' },
  darkSubtitle: { color: '#B0B0B0' },
  dateText: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  darkDateText: { color: '#888' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, alignItems: 'center',
  },
  statIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 2, textAlign: 'center', maxWidth: '100%' },
  statTitle: { fontSize: 10, color: '#666', fontWeight: '500', textAlign: 'center', lineHeight: 12 },
  darkStatCard: { backgroundColor: '#1E1E1E' },
  darkStatValue: { color: '#FFFFFF' },
  darkStatTitle: { color: '#B0B0B0' },

  sectionContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  darkSectionContainer: { backgroundColor: '#1E1E1E' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  darkSectionTitle: { color: '#FFFFFF' },
  link: { fontSize: 14, color: '#2196F3', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#E0E0E0', marginBottom: 16 },
  darkDivider: { backgroundColor: '#333' },

  quickActionsGrid: {},
  quickActionButton: {
    backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'flex-start', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    borderWidth: 1, borderColor: '#F0F0F0', minHeight: 78,
  },
  quickActionIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickActionText: { color: '#333', fontWeight: '500', fontSize: 10, textAlign: 'center', lineHeight: 12 },
  darkQuickActionButton: { backgroundColor: '#1E1E1E', borderColor: '#333' },
  darkQuickActionText: { color: '#FFFFFF' },

  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  activityIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityItemTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  darkActivityItemTitle: { color: '#FFFFFF' },
  activityItemDescription: { fontSize: 14, color: '#666' },
  darkActivityItemDescription: { color: '#B0B0B0' },
  activityMeta: { alignItems: 'flex-end' },
  activityDate: { fontSize: 12, color: '#999', marginBottom: 4 },
  darkActivityDate: { color: '#888' },
  activityAmount: { fontSize: 14, fontWeight: 'bold', color: '#4CAF50' },
  darkActivityAmount: { color: '#81C784' },

  noActivities: { alignItems: 'center', paddingVertical: 20 },
  noActivitiesText: { fontSize: 16, color: '#999', marginBottom: 12 },
  darkNoActivitiesText: { color: '#888' },
  contributeButton: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  contributeButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  eventItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  eventIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  eventContent: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  darkEventTitle: { color: '#FFFFFF' },
  eventDate: { fontSize: 14, color: '#666' },
  darkEventDate: { color: '#B0B0B0' },
  unreadNotification: { color: '#F44336', fontWeight: 'bold' },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scrollRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  carouselWrapper: { position: 'relative' },
  arrowButton: {
    position: 'absolute', top: '50%', marginTop: -14, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3, zIndex: 10,
  },
  arrowButtonDark: { backgroundColor: 'rgba(60,60,60,0.95)' },
  arrowLeft: { left: -8 },
  arrowRight: { right: -8 },

  footer: { marginTop: 30, alignItems: 'center' },
  footerText: { fontSize: 13, color: '#555' },
  darkFooterText: { color: '#B0B0B0' },
  footerBrand: { fontWeight: 'bold', color: '#4CAF50' },
  footerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  darkFooterSub: { color: '#888' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%' },
  modalSheetDark: { backgroundColor: '#1E1E1E' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 24 },
});

export default MemberDashboardScreen;
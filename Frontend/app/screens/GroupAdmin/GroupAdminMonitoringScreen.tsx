// GroupAdminMonitoringScreen.tsx - UPDATED WITH FIX FOR MISSING ANNOUNCEMENTS
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://192.168.0.101:8080/api';

interface Notification {
  id: string;
  title: string;
  messageContent: string;
  createdOn: string;
  createdBy: string;
  groupId: string;
  parentId: string | null;
  senderName: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
  };
  isRead: boolean;
  type: string;
  channel: string;
}

interface SentimentData {
  message: string;
  sentiment: string;
  score: number;
  memberName: string;
  timestamp: string;
}

function GroupAdminMonitoringScreen() {
  const router = useRouter();
  const [discussions, setDiscussions] = useState<(Notification & { comments?: Notification[] })[]>([]);
  const [announcementsWithComments, setAnnouncementsWithComments] = useState<(Notification & { comments?: Notification[] })[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discussions' | 'announcements' | 'sentiment'>('discussions');
  const [summary, setSummary] = useState({
    totalDiscussions: 0,
    totalComments: 0,
    activeMembers: 0,
    positiveSentiment: 0,
    negativeSentiment: 0,
  });

  useEffect(() => {
    initializeMonitoring();
  }, []);

  const initializeMonitoring = async () => {
    try {
      const storedGroupId = await AsyncStorage.getItem('userGroupId');
      const storedUserId = await AsyncStorage.getItem('userId');
      
      if (storedGroupId) {
        setGroupId(storedGroupId);
        fetchAllData(storedGroupId);
      } else {
        Alert.alert('No Group', 'You are not assigned to any group.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
      Alert.alert('Error', 'Failed to load monitoring data');
      setLoading(false);
    }
  };

  const fetchAllData = async (targetGroupId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`);
      if (response.ok) {
        const allNotifications: Notification[] = await response.json();
        
        console.log('=== DEBUG: MONITORING DATA ===');
        console.log('All notifications for monitoring:', allNotifications.length);

        // Get all group notifications
        const groupNotifications = allNotifications.filter((notif: Notification) => 
          notif.groupId === targetGroupId
        );

        console.log('Group notifications:', groupNotifications.length);

        // Get ALL comments in the group
        const allComments = groupNotifications.filter((notif: Notification) => 
          notif.type === 'COMMENT'
        );
        console.log('All comments in group:', allComments.length);

        // Get discussions (non-admin posts with comments)
        const discussionPosts = groupNotifications.filter((notif: Notification) => 
          !notif.parentId && 
          !isAdminNotificationType(notif.type) &&
          notif.type !== 'COMMENT'
        );

        // Get admin announcements
        const adminAnnouncements = groupNotifications.filter((notif: Notification) => 
          !notif.parentId && 
          isAdminNotificationType(notif.type)
        );

        console.log('Admin announcements found:', adminAnnouncements.length);
        console.log('Discussion posts found:', discussionPosts.length);

        // Create a map to hold announcements with their comments
        const announcementsMap = new Map();
        
        // Add existing announcements to the map
        adminAnnouncements.forEach(announcement => {
          announcementsMap.set(announcement.id, {
            ...announcement,
            comments: []
          });
        });

        // Process all comments and attach them to their parent announcements
        allComments.forEach(comment => {
          if (comment.parentId) {
            const parentAnnouncement = announcementsMap.get(comment.parentId);
            if (parentAnnouncement) {
              // Parent exists, add comment to it
              parentAnnouncement.comments.push(comment);
            } else {
              // Parent doesn't exist in our announcements list - create a dummy parent
              // Check if we already have an orphaned comments container
              if (!announcementsMap.has('orphaned-comments')) {
                announcementsMap.set('orphaned-comments', {
                  id: 'orphaned-comments',
                  title: 'Comments on Deleted/Missing Announcements',
                  messageContent: 'These comments were made on announcements that may have been deleted or are no longer available',
                  type: 'ORPHANED_COMMENTS',
                  createdOn: new Date().toISOString(),
                  comments: []
                });
              }
              announcementsMap.get('orphaned-comments').comments.push(comment);
            }
          }
        });

        // Convert map back to array and filter out announcements with no comments
        const announcementsWithCommentsData = Array.from(announcementsMap.values())
          .filter(announcement => announcement.comments.length > 0) // Only show announcements with comments
          .sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());

        console.log('Final announcements with comments:', announcementsWithCommentsData.length);

        // Add comments to discussions
        const discussionsWithComments = discussionPosts.map((post: Notification) => {
          const comments = groupNotifications.filter((notif: Notification) => 
            notif.parentId === post.id
          );
          return {
            ...post,
            comments: comments.sort((a: Notification, b: Notification) => 
              new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime()
            )
          };
        });

        // Calculate summary statistics
        const totalComments = allComments.length;
        const uniqueMembers = new Set(groupNotifications.map(n => n.member?.id)).size;
        
        // Generate sentiment data
        const sentimentAnalysis = generateSentimentAnalysis(allComments);

        setDiscussions(discussionsWithComments.sort((a, b) => 
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        ));
        
        setAnnouncementsWithComments(announcementsWithCommentsData);

        setSentimentData(sentimentAnalysis);

        setSummary({
          totalDiscussions: discussionPosts.length,
          totalComments: totalComments,
          activeMembers: uniqueMembers,
          positiveSentiment: sentimentAnalysis.length > 0 ? 
            Math.round((sentimentAnalysis.filter(s => s.sentiment === 'positive').length / sentimentAnalysis.length) * 100) : 0,
          negativeSentiment: sentimentAnalysis.length > 0 ? 
            Math.round((sentimentAnalysis.filter(s => s.sentiment === 'negative').length / sentimentAnalysis.length) * 100) : 0,
        });

        console.log('=== DEBUG: SUMMARY ===');
        console.log('Total comments:', totalComments);
        console.log('Announcements with comments:', announcementsWithCommentsData.length);
        console.log('Sentiment data points:', sentimentAnalysis.length);
        console.log('=== DEBUG END ===');

      } else {
        throw new Error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      Alert.alert('Error', 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  // Mock sentiment analysis - replace with real API call
  const generateSentimentAnalysis = (notifications: Notification[]): SentimentData[] => {
    const comments = notifications.filter(n => n.type === 'COMMENT' && n.messageContent);
    
    return comments.map(comment => {
      const text = comment.messageContent.toLowerCase();
      let sentiment = 'neutral';
      let score = 0.5;

      // Simple keyword-based sentiment analysis
      const positiveWords = ['good', 'great', 'excellent', 'happy', 'thanks', 'helpful', 'nice', 'love', 'awesome', 'perfect', 'please', 'okay', 'yes'];
      const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'frustrated', 'disappointed', 'poor', 'worst', 'problem', 'issue', 'no', 'cannot'];

      const positiveCount = positiveWords.filter(word => text.includes(word)).length;
      const negativeCount = negativeWords.filter(word => text.includes(word)).length;

      if (positiveCount > negativeCount) {
        sentiment = 'positive';
        score = 0.5 + (positiveCount * 0.1);
      } else if (negativeCount > positiveCount) {
        sentiment = 'negative';
        score = 0.5 - (negativeCount * 0.1);
      }

      return {
        message: comment.messageContent,
        sentiment,
        score: Math.min(Math.max(score, 0.1), 0.9), // Clamp between 0.1 and 0.9
        memberName: comment.member ? `${comment.member.firstName} ${comment.member.lastName}` : 'Unknown Member',
        timestamp: comment.createdOn
      };
    });
  };

  const isAdminNotificationType = (type: string): boolean => {
    const adminTypes = ['Alert', 'Information', 'Reminder', 'Urgent', 'ANNOUNCEMENT', 'ADMIN_NOTIFICATION', 'ORPHANED_COMMENTS'];
    return adminTypes.includes(type);
  };

  const getDisplayName = (notification: Notification) => {
    if (isAdminNotificationType(notification.type)) {
      return 'Group Admin';
    }
    
    return notification.senderName || 
           (notification.member ? `${notification.member.firstName} ${notification.member.lastName}` : 'Member');
  };

  const getNotificationBadge = (type: string): string => {
    const badgeMap: {[key: string]: string} = {
      'Alert': '🚨 ALERT',
      'Information': 'ℹ️ INFORMATION',
      'Reminder': '⏰ REMINDER',
      'Urgent': '🚨 URGENT',
      'ANNOUNCEMENT': '📢 ANNOUNCEMENT',
      'ADMIN_NOTIFICATION': '📢 ADMIN',
      'ORPHANED_COMMENTS': '📝 ORPHANED COMMENTS'
    };
    
    return badgeMap[type] || '📢 NOTIFICATION';
  };

  const getSentimentColor = (sentiment: string) => {
    switch(sentiment) {
      case 'positive': return '#4CAF50';
      case 'negative': return '#F44336';
      case 'neutral': return '#FF9800';
      default: return '#757575';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch(sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '🤔';
    }
  };

  const renderDiscussion = ({ item }: { item: Notification & { comments?: Notification[] } }) => (
    <View style={styles.monitoringCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.memberName}>{getDisplayName(item)}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.createdOn).toLocaleDateString()} at{' '}
          {new Date(item.createdOn).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
          })}
        </Text>
      </View>
      
      <Text style={styles.postTitle}>{item.title || 'Discussion'}</Text>
      <Text style={styles.messageContent}>{item.messageContent}</Text>
      
      <View style={styles.commentsSection}>
        <Text style={styles.commentsTitle}>
          Comments ({item.comments?.length || 0})
        </Text>
        
        {item.comments?.map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{getDisplayName(comment)}</Text>
              <Text style={styles.commentDate}>
                {new Date(comment.createdOn).toLocaleTimeString([], { 
                  hour: '2-digit', minute: '2-digit' 
                })}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.messageContent}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderAnnouncement = ({ item }: { item: Notification & { comments?: Notification[] } }) => (
    <View style={[styles.monitoringCard, styles.announcementCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.announcementBadge}>{getNotificationBadge(item.type)}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.createdOn).toLocaleDateString()}
        </Text>
      </View>
      
      <Text style={styles.announcementTitle}>
        {item.type === 'ORPHANED_COMMENTS' ? item.title : (item.title || 'Announcement')}
      </Text>
      <Text style={styles.messageContent}>{item.messageContent}</Text>
      
      <View style={styles.commentsSection}>
        <Text style={styles.commentsTitle}>
          {item.type === 'ORPHANED_COMMENTS' ? 'All Comments' : 'Member Feedback'} ({item.comments?.length || 0})
        </Text>
        
        {item.comments?.map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{getDisplayName(comment)}</Text>
              <Text style={styles.commentDate}>
                {new Date(comment.createdOn).toLocaleTimeString([], { 
                  hour: '2-digit', minute: '2-digit' 
                })}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.messageContent}</Text>
          </View>
        ))}
        
        {item.comments?.length === 0 && (
          <Text style={styles.noComments}>No feedback yet</Text>
        )}
      </View>
    </View>
  );

  const renderSentimentItem = ({ item }: { item: SentimentData }) => (
    <View style={[styles.sentimentCard, { borderLeftColor: getSentimentColor(item.sentiment) }]}>
      <View style={styles.sentimentHeader}>
        <Text style={styles.memberName}>{item.memberName}</Text>
        <View style={styles.sentimentBadge}>
          <Text style={[styles.sentimentText, { color: getSentimentColor(item.sentiment) }]}>
            {getSentimentIcon(item.sentiment)} {item.sentiment.toUpperCase()} ({Math.round(item.score * 100)}%)
          </Text>
        </View>
      </View>
      <Text style={styles.sentimentMessage}>{item.message}</Text>
      <Text style={styles.sentimentTimestamp}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </View>
  );

  const renderSummary = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>Group Engagement Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{summary.totalDiscussions}</Text>
          <Text style={styles.summaryLabel}>Discussions</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{summary.totalComments}</Text>
          <Text style={styles.summaryLabel}>Total Comments</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{summary.activeMembers}</Text>
          <Text style={styles.summaryLabel}>Active Members</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{summary.positiveSentiment}%</Text>
          <Text style={styles.summaryLabel}>Positive</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.chatTitle}>Group Monitoring</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading monitoring data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        {/* <Text style={styles.chatTitle}>Group Monitoring</Text> */}
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      {renderSummary()}

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'discussions' && styles.activeTab]}
          onPress={() => setActiveTab('discussions')}
        >
          <Text style={[styles.tabText, activeTab === 'discussions' && styles.activeTabText]}>
            💬 Discussions ({discussions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'announcements' && styles.activeTab]}
          onPress={() => setActiveTab('announcements')}
        >
          <Text style={[styles.tabText, activeTab === 'announcements' && styles.activeTabText]}>
            📢 Feedback ({announcementsWithComments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'sentiment' && styles.activeTab]}
          onPress={() => setActiveTab('sentiment')}
        >
          <Text style={[styles.tabText, activeTab === 'sentiment' && styles.activeTabText]}>
            📊 Sentiment ({sentimentData.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {activeTab === 'discussions' ? (
          <FlatList
            data={discussions}
            renderItem={renderDiscussion}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No discussions in the group yet.</Text>
            }
          />
        ) : activeTab === 'announcements' ? (
          <FlatList
            data={announcementsWithComments}
            renderItem={renderAnnouncement}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No announcements with feedback yet.</Text>
            }
          />
        ) : (
          <FlatList
            data={sentimentData}
            renderItem={renderSentimentItem}
            keyExtractor={(item, index) => `${item.timestamp}-${index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No sentiment data available yet.</Text>
            }
          />
        )}
      </View>

      <GroupAdminBottomNav current="chat-monitoring" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  logo: { width: 30, height: 30, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  chatTitle: { fontSize: 16, fontWeight: 'bold', color: '#1565C0' },
  returnButton: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  container: { flex: 1, paddingHorizontal: 16 },
  
  // Summary Styles
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  summaryItem: {
    alignItems: 'center',
    padding: 8,
    minWidth: '45%',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#1976D2',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },

  // Monitoring Card Styles
  monitoringCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  announcementCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#6C757D',
  },
  announcementBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
  },
  messageContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },

  // Comments Section
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 12,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
  },
  commentCard: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
  commentDate: {
    fontSize: 10,
    color: '#6C757D',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  noComments: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },

  // Sentiment Styles
  sentimentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sentimentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sentimentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  sentimentText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sentimentMessage: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
    marginBottom: 8,
  },
  sentimentTimestamp: {
    fontSize: 11,
    color: '#999',
  },

  listContent: {
    paddingBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
});

export default GroupAdminMonitoringScreen;
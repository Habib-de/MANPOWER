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
   Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://192.168.0.102:8080/api';

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
    const [privateMessages, setPrivateMessages] = useState<any[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discussions' | 'announcements' | 'sentiment' | 'private'>('discussions');
    // 👇 ADD THESE 4 STATES FOR REPLYING
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
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
      const storedEmail = await AsyncStorage.getItem('userEmail');
      if (storedEmail) setCurrentUserEmail(storedEmail);
      
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

                const storedUserId = await AsyncStorage.getItem('userId');
                const storedEmail = await AsyncStorage.getItem('userEmail');

                // Fetch DMs where the admin is the RECEIVER, but exclude messages the admin sent
        const myPrivateMessages = allNotifications.filter((notif: any) => 
          notif.type === 'PRIVATE_MESSAGE' && 
          notif.member?.id === storedUserId && // Admin is the receiver
          notif.createdBy !== storedEmail      // Admin is NOT the sender (member sent it)
        );
        myPrivateMessages.sort((a: any, b: any) => 
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        );
        setPrivateMessages(myPrivateMessages);
        
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
          notif.type !== 'COMMENT' &&
          notif.type !== 'PRIVATE_MESSAGE' &&       // 👈 Exclude DMs
          notif.type !== 'VOLUNTEER' &&              // 👈 Exclude volunteer updates
          !notif.type?.toLowerCase().includes('volunteer')
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
        const handleSendReply = async () => {
    console.log('🔥 1. Send button clicked');
    console.log('🔥 2. replyingTo:', replyingTo);
    console.log('🔥 3. replyText:', replyText);
    console.log('🔥 4. currentUserEmail:', currentUserEmail);

    if (!replyText.trim() || !replyingTo) {
      console.log('❌ STOPPED: replyText or replyingTo is empty');
      return;
    }
    setSendingReply(true);

    try {
            const memberIdFromDM = replyingTo.createdBy;   // 👈 This is the member's ID
      console.log('🔥 5. Looking for member with ID:', memberIdFromDM);

      let memberId = null;
      let memberFirstName = '';
      let memberLastName = '';

      if (memberIdFromDM) {
        const memberRes = await fetch(`${API_BASE_URL}/members/${memberIdFromDM}`);   // 👈 Fetch by ID directly
        console.log('🔥 6. Member API status:', memberRes.status);
        
        if (memberRes.ok) {
          const targetMember = await memberRes.json();
          console.log('🔥 8. Target member:', targetMember);
          
          memberId = targetMember.id;
          memberFirstName = targetMember.firstName;
          memberLastName = targetMember.lastName;
        }
      }

      if (!memberId) {
        console.log('❌ STOPPED: Could not find member');
                Alert.alert('Error', `Could not find member with ID: ${replyingTo.createdBy}`);
        setSendingReply(false);
        return;
      }

      const payload = {
        id: '',
        title: `Reply from Group Admin`,
        messageContent: replyText.trim(),
        createdBy: currentUserEmail,
        groupId: groupId,
        parentId: null,
        senderName: 'Group Admin',
        type: 'PRIVATE_MESSAGE',
        member: { 
          id: memberId,
          firstName: memberFirstName,
          lastName: memberLastName
        },
        sendDate: new Date().toISOString(),
        createdOn: new Date().toISOString(),
        channel: 'APP',
        isRead: false,
        mansoftTenantId: 'tenant-001'
      };

      console.log('🔥 9. Sending payload:', payload);

      const res = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('🔥 10. Response status:', res.status);

      if (res.ok) {
        const result = await res.json();
        console.log('✅ 11. Success! Response:', result);
        Alert.alert('Success', 'Reply sent to member!');
        setReplyingTo(null);
        setReplyText('');
      } else {
        const errorText = await res.text();
        console.log('❌ 12. Failed:', errorText);
        Alert.alert('Error', 'Failed: ' + errorText);
      }
    } catch (err) {
      console.log('💥 13. Exception:', err);
      Alert.alert('Error', 'Network error: ' + String(err));
    } finally {
      setSendingReply(false);
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
        <Text style={styles.memberName} numberOfLines={1}>{getDisplayName(item)}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.createdOn).toLocaleDateString()} •{' '}
          {new Date(item.createdOn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      
      <Text style={styles.messageContent} numberOfLines={3}>{item.messageContent}</Text>
      
      {item.comments && item.comments.length > 0 && (
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            💬 {item.comments.length} comment{item.comments.length > 1 ? 's' : ''}
          </Text>
          {item.comments.slice(0, 2).map((comment) => (   // 👈 Show max 2 comments
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{getDisplayName(comment)}</Text>
                <Text style={styles.commentDate}>
                  {new Date(comment.createdOn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={styles.commentText} numberOfLines={2}>{comment.messageContent}</Text>
            </View>
          ))}
          {item.comments.length > 2 && (
            <Text style={styles.moreComments}>+ {item.comments.length - 2} more</Text>
          )}
        </View>
      )}
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
      
      <Text style={styles.messageContent} numberOfLines={3}>{item.messageContent}</Text>
      
      {item.comments && item.comments.length > 0 && (
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            💬 {item.comments.length} feedback{item.comments.length > 1 ? 's' : ''}
          </Text>
          {item.comments.slice(0, 2).map((comment) => (   // 👈 Show max 2 comments
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{getDisplayName(comment)}</Text>
                <Text style={styles.commentDate}>
                  {new Date(comment.createdOn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={styles.commentText} numberOfLines={2}>{comment.messageContent}</Text>
            </View>
          ))}
          {item.comments.length > 2 && (
            <Text style={styles.moreComments}>+ {item.comments.length - 2} more</Text>
          )}
        </View>
      )}
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
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{summary.totalDiscussions}</Text>
          <Text style={styles.summaryLabel}>Discussions</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{summary.totalComments}</Text>
          <Text style={styles.summaryLabel}>Comments</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{summary.activeMembers}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>{summary.positiveSentiment}%</Text>
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

                <TouchableOpacity 
          style={[styles.tab, activeTab === 'private' && styles.activeTab]}
          onPress={() => setActiveTab('private')}
        >
          <Text style={[styles.tabText, activeTab === 'private' && styles.activeTabText]}>
            ✉️ DMs ({privateMessages.length})
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
                ) : activeTab === 'private' ? (
          <FlatList
            data={privateMessages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No direct messages yet.</Text>
            }
                        renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.monitoringCard, { borderLeftColor: '#D32F2F', backgroundColor: '#FFF3E0' }]}
                onPress={() => setReplyingTo(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.memberName, { color: '#D32F2F' }]} numberOfLines={1}>
                    {item.senderName || (item.member ? `${item.member.firstName} ${item.member.lastName}` : 'Member')}
                  </Text>
                  <Text style={styles.timestamp}>
                    {new Date(item.createdOn).toLocaleDateString()} •{' '}
                    {new Date(item.createdOn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.messageContent}>{item.messageContent}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                  <Ionicons name="arrow-undo-outline" size={14} color="#D32F2F" />
                  <Text style={{ fontSize: 11, color: '#D32F2F', fontWeight: '600' }}>Tap to reply</Text>
                </View>
              </TouchableOpacity>
            )}
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
            {/* 👇 REPLY MODAL */}
      <Modal
        visible={!!replyingTo}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyingTo(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reply to Member</Text>
                <Text style={styles.modalSubtitle}>
                  {replyingTo?.senderName || (replyingTo?.member ? `${replyingTo.member.firstName} ${replyingTo.member.lastName}` : '')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.originalMessageBox}>
              <Text style={styles.originalMessageLabel}>Their message:</Text>
              <Text style={styles.originalMessageText} numberOfLines={3}>
                {replyingTo?.messageContent}
              </Text>
            </View>

            <TextInput
              style={styles.replyInput}
              placeholder="Type your reply here..."
              placeholderTextColor="#999"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              numberOfLines={4}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => { setReplyingTo(null); setReplyText(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sendBtn, (!replyText.trim() || sendingReply) && { opacity: 0.6 }]} 
                onPress={handleSendReply}
                disabled={!replyText.trim() || sendingReply}
              >
                {sendingReply ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.sendBtnText}>Send Reply</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>


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
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#EEEEEE',
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },

  // Tab Styles
    tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 4,
    elevation: 1,
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
    fontSize: 10,
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
    padding: 12,                          // 👈 Less padding
    borderRadius: 10,
    marginBottom: 8,                      // 👈 Tighter spacing between cards
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  announcementCard: {
    borderLeftColor: '#FF9800',
    backgroundColor: '#FFF8E1',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  memberName: {
    fontSize: 13,                        // 👈 Smaller
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 10,
    color: '#6C757D',
  },
  announcementBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  messageContent: {
    fontSize: 13,                        // 👈 Smaller
    color: '#333',
    lineHeight: 18,
    marginBottom: 8,
  },

  // Comments Section
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
    marginTop: 4,
  },
  commentsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
  },
  commentCard: {
    backgroundColor: '#F8F9FA',
    padding: 8,                         // 👈 Less padding
    borderRadius: 6,
    marginBottom: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
  },
  commentDate: {
    fontSize: 9,
    color: '#6C757D',
  },
  commentText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
  },
  moreComments: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
    marginTop: 2,
    marginLeft: 4,
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

    // Reply Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#D32F2F',
    fontWeight: '600',
    marginTop: 2,
  },
  originalMessageBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  originalMessageLabel: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  originalMessageText: {
    fontSize: 13,
    color: '#333',
    fontStyle: 'italic',
  },
  replyInput: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  sendBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default GroupAdminMonitoringScreen;
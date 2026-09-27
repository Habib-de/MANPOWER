// GroupChatScreen.tsx - WITH START DISCUSSION BUTTON & UNREAD COUNT
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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

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

function GroupChatScreen() {
  const router = useRouter();
  const [discussions, setDiscussions] = useState<(Notification & { comments?: Notification[] })[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<(Notification & { comments?: Notification[] })[]>([]);
  const [newPost, setNewPost] = useState('');
  const [newDiscussionComment, setNewDiscussionComment] = useState<{[key: string]: string}>({});
  const [newNotificationComment, setNewNotificationComment] = useState<{[key: string]: string}>({});
  const [groupId, setGroupId] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [activeTab, setActiveTab] = useState<'discussions' | 'announcements'>('discussions');
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  
  // ✅ NEW: Unread private messages count
  const [unreadPrivateMessages, setUnreadPrivateMessages] = useState(0);

  useEffect(() => {
    initializeChat();
    
    // ✅ Poll for unread private messages every 10 seconds
    const interval = setInterval(() => {
      if (userId) {
        fetchUnreadPrivateMessages(userId);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [userId]);

  const initializeChat = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedUserName = await AsyncStorage.getItem('userFirstName');
      const storedUserLastName = await AsyncStorage.getItem('userLastName');
      const storedGroupId = await AsyncStorage.getItem('userGroupId');
      
      console.log('Stored user data:', {
        userId: storedUserId,
        userName: storedUserName,
        groupId: storedGroupId,
      });

      if (storedUserId) {
        setUserId(storedUserId);
        setUserName(`${storedUserName || ''} ${storedUserLastName || ''}`.trim());
      }

      if (storedGroupId) {
        setGroupId(storedGroupId);
        await fetchAllData(storedGroupId, storedUserId);
      } else {
        Alert.alert('No Group', 'You are not assigned to any group. Please contact your administrator.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      Alert.alert('Error', 'Failed to initialize chat');
      setLoading(false);
    }
  };

  // ✅ NEW: Fetch unread private message count
  const fetchUnreadPrivateMessages = async (currentUserId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`);
      if (response.ok) {
        const allNotifications = await response.json();
        
        const unreadCount = allNotifications.filter(
          (notif: any) => 
            notif.type === 'PRIVATE_MESSAGE' &&
            notif.member?.id === currentUserId &&
            !notif.isRead
        ).length;
        
        setUnreadPrivateMessages(unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch unread private messages:', error);
    }
  };

  const fetchAllData = async (targetGroupId: string, currentUserId: string | null) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`);
      if (response.ok) {
        const allNotifications: Notification[] = await response.json();
        
        console.log('All notifications fetched:', allNotifications.length);
        console.log('Current user ID:', currentUserId);

        const groupDiscussions = allNotifications.filter((notif: Notification) => 
          notif.groupId === targetGroupId && 
          !notif.parentId && 
          !isAdminNotificationType(notif.type) &&
          notif.type !== 'COMMENT' &&
          notif.type !== 'PRIVATE_MESSAGE'
        );

        const userAnnouncements = allNotifications.filter((notif: Notification) => 
          notif.member?.id === currentUserId &&
          !notif.parentId && 
          isAdminNotificationType(notif.type)
        );

        console.log('Group discussions:', groupDiscussions.length);
        console.log('User announcements:', userAnnouncements.length);

        const discussionsWithComments = groupDiscussions.map((post: Notification) => {
          const comments = allNotifications.filter((notif: Notification) => 
            notif.parentId === post.id && notif.type === 'COMMENT'
          );
          return {
            ...post,
            comments: comments.sort((a: Notification, b: Notification) => 
              new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime()
            )
          };
        });

        const announcementsWithComments = userAnnouncements.map((announcement: Notification) => {
          const comments = allNotifications.filter((notif: Notification) => 
            notif.parentId === announcement.id && notif.type === 'COMMENT'
          );
          return {
            ...announcement,
            comments: comments.sort((a: Notification, b: Notification) => 
              new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime()
            )
          };
        });

        setDiscussions(discussionsWithComments.sort((a: Notification, b: Notification) => 
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        ));
        
        setAdminNotifications(announcementsWithComments.sort((a: Notification, b: Notification) => 
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        ));

        // ✅ Fetch unread private messages
        if (currentUserId) {
          await fetchUnreadPrivateMessages(currentUserId);
        }
      } else {
        throw new Error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      Alert.alert('Error', 'Failed to load discussions and announcements');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to identify admin notification types
  const isAdminNotificationType = (type: string): boolean => {
    const adminTypes = ['Alert', 'Information', 'Reminder', 'Urgent', 'ANNOUNCEMENT', 'ADMIN_NOTIFICATION'];
    return adminTypes.includes(type);
  };

  // Helper function to get display title for admin notifications
  const getAdminNotificationTitle = (notification: Notification): string => {
    if (notification.title && notification.title !== 'undefined') {
      return notification.title;
    }
    
    const typeTitles: {[key: string]: string} = {
      'Alert': '🚨 Important Alert',
      'Information': 'ℹ️ Group Information',
      'Reminder': '⏰ Reminder',
      'Urgent': '🚨 Urgent Notice',
      'ANNOUNCEMENT': '📢 Announcement',
      'ADMIN_NOTIFICATION': '📢 Admin Notification'
    };
    
    return typeTitles[notification.type] || `📢 ${notification.type}`;
  };

  const createPost = async () => {
    if (!newPost.trim() || !groupId || !userId) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setPosting(true);
    
    let memberId = userId;
    try {
      const memberResponse = await fetch(`${API_BASE_URL}/members/${userId}`);
      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        memberId = memberData.id;
      }
    } catch (error) {
      console.error('Failed to fetch member data:', error);
    }

    const postData = {
      title: `Discussion from ${userName}`,
      messageContent: newPost.trim(),
      createdBy: userId,
      groupId: groupId,
      parentId: null,
      senderName: userName,
      type: 'DISCUSSION',
      member: { id: memberId },
      sendDate: new Date().toISOString(),
      channel: 'APP',
      isRead: false,
      mansoftTenantId: 'tenant-001'
    };

    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        setNewPost('');
        setShowCreatePostModal(false);
        const storedUserId = await AsyncStorage.getItem('userId');
        fetchAllData(groupId!, storedUserId);
        Alert.alert('Success', 'Discussion started successfully!');
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to create post: ${errorText}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create discussion. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const createComment = async (parentId: string, commentText: string, isAnnouncement: boolean = false) => {
    if (!commentText.trim() || !groupId || !userId) {
      return;
    }

    let memberId = userId;
    try {
      const memberResponse = await fetch(`${API_BASE_URL}/members/${userId}`);
      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        memberId = memberData.id;
      }
    } catch (error) {
      console.error('Failed to fetch member data:', error);
    }

    const commentData = {
      title: `Comment from ${userName}`,
      messageContent: commentText.trim(),
      createdBy: userId,
      groupId: groupId,
      parentId: parentId,
      senderName: userName,
      type: 'COMMENT',
      member: { id: memberId },
      sendDate: new Date().toISOString(),
      channel: 'APP',
      isRead: false,
      mansoftTenantId: 'tenant-001'
    };

    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      if (response.ok) {
        if (isAnnouncement) {
          setNewNotificationComment(prev => ({...prev, [parentId]: ''}));
        } else {
          setNewDiscussionComment(prev => ({...prev, [parentId]: ''}));
        }
        const storedUserId = await AsyncStorage.getItem('userId');
        fetchAllData(groupId!, storedUserId);
      } else {
        throw new Error('Failed to create comment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    }
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
      'ADMIN_NOTIFICATION': '📢 ADMIN'
    };
    
    return badgeMap[type] || '📢 NOTIFICATION';
  };

  const renderDiscussion = ({ item }: { item: Notification & { comments?: Notification[] } }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Text style={styles.postAuthor}>
          {getDisplayName(item)}
        </Text>
        <Text style={styles.postDate}>
          {new Date(item.createdOn).toLocaleDateString()} at{' '}
          {new Date(item.createdOn).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
          })}
        </Text>
      </View>
      
      <Text style={styles.postTitle}>{item.title || 'Discussion'}</Text>
      <Text style={styles.postMessage}>{item.messageContent}</Text>
      
      <View style={styles.commentsSection}>
        <Text style={styles.commentsTitle}>
          Comments ({item.comments?.length || 0})
        </Text>
        
        {item.comments?.map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>
                {getDisplayName(comment)}
              </Text>
              <Text style={styles.commentDate}>
                {new Date(comment.createdOn).toLocaleTimeString([], { 
                  hour: '2-digit', minute: '2-digit' 
                })}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.messageContent}</Text>
          </View>
        ))}
        
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            value={newDiscussionComment[item.id] || ''}
            onChangeText={(text) => setNewDiscussionComment(prev => ({...prev, [item.id]: text}))}
            placeholder="Write a comment..."
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity 
            style={[
              styles.commentButton,
              (!newDiscussionComment[item.id]?.trim()) && styles.commentButtonDisabled
            ]}
            onPress={() => createComment(item.id, newDiscussionComment[item.id] || '')}
            disabled={!newDiscussionComment[item.id]?.trim()}
          >
            <Text style={styles.commentButtonText}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderAnnouncement = ({ item }: { item: Notification & { comments?: Notification[] } }) => (
    <View style={[styles.postCard, styles.announcementCard]}>
      <View style={styles.announcementHeader}>
        <Text style={styles.announcementBadge}>
          {getNotificationBadge(item.type)}
        </Text>
        <Text style={styles.postDate}>
          {new Date(item.createdOn).toLocaleDateString()} at{' '}
          {new Date(item.createdOn).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
          })}
        </Text>
      </View>
      
      <Text style={styles.announcementTitle}>{getAdminNotificationTitle(item)}</Text>
      <Text style={styles.announcementMessage}>{item.messageContent}</Text>
      
      <View style={styles.commentsSection}>
        <Text style={styles.commentsTitle}>
          Member Feedback ({item.comments?.length || 0})
        </Text>
        
        {item.comments?.map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>
                {getDisplayName(comment)}
              </Text>
              <Text style={styles.commentDate}>
                {new Date(comment.createdOn).toLocaleTimeString([], { 
                  hour: '2-digit', minute: '2-digit' 
                })}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.messageContent}</Text>
          </View>
        ))}
        
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            value={newNotificationComment[item.id] || ''}
            onChangeText={(text) => setNewNotificationComment(prev => ({...prev, [item.id]: text}))}
            placeholder="Share your thoughts about this announcement..."
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity 
            style={[
              styles.commentButton,
              (!newNotificationComment[item.id]?.trim()) && styles.commentButtonDisabled
            ]}
            onPress={() => createComment(item.id, newNotificationComment[item.id] || '', true)}
            disabled={!newNotificationComment[item.id]?.trim()}
          >
            <Text style={styles.commentButtonText}>Comment</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.chatTitle}>Group Communications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading communications...</Text>
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
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

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
            📢 My Announcements ({adminNotifications.length})
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {!groupId ? (
          <View style={styles.noGroupContainer}>
            <Text style={styles.noGroupText}>No group available</Text>
            <Text style={styles.noGroupSubtext}>
              You need to be part of a group to participate in communications.
            </Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={initializeChat}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {activeTab === 'discussions' ? (
              <>
                <TouchableOpacity 
                  style={styles.startDiscussionButton}
                  onPress={() => setShowCreatePostModal(true)}
                >
                  <Text style={styles.startDiscussionIcon}>💬</Text>
                  <View style={styles.startDiscussionTextContainer}>
                    <Text style={styles.startDiscussionTitle}>Start a Discussion</Text>
                    <Text style={styles.startDiscussionSubtitle}>
                      Share your thoughts with the group
                    </Text>
                  </View>
                  <Text style={styles.startDiscussionArrow}>➔</Text>
                </TouchableOpacity>

                {/* ✅ Private Messages Button with Unread Badge */}
                <TouchableOpacity 
                  style={styles.privateMessagesButton}
                  onPress={() => router.push('/(member)/private-chat-list')}
                >
                  <View style={styles.privateMessagesLeft}>
                    <Text style={styles.privateMessagesIcon}>✉️</Text>
                    <View style={styles.privateMessagesTextContainer}>
                      <Text style={styles.privateMessagesTitle}>Private Messages</Text>
                      <Text style={styles.privateMessagesSubtitle}>
                        Chat directly with group members
                      </Text>
                    </View>
                  </View>
                  <View style={styles.privateMessagesRight}>
                    {unreadPrivateMessages > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {unreadPrivateMessages > 99 ? '99+' : unreadPrivateMessages}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.privateMessagesArrow}>➔</Text>
                  </View>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Group Discussions</Text>
                {discussions.length === 0 ? (
                  <View style={styles.noPosts}>
                    <Text style={styles.noPostsText}>No discussions yet</Text>
                    <Text style={styles.noPostsSubtext}>
                      Be the first to start a conversation!
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={discussions}
                    renderItem={renderDiscussion}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.postsList}
                  />
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>My Announcements</Text>
                {adminNotifications.length === 0 ? (
                  <View style={styles.noPosts}>
                    <Text style={styles.noPostsText}>No announcements for you</Text>
                    <Text style={styles.noPostsSubtext}>
                      You'll see admin announcements here when they're sent to you!
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={adminNotifications}
                    renderItem={renderAnnouncement}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.postsList}
                  />
                )}
              </>
            )}
          </>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={showCreatePostModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreatePostModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Start New Discussion</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowCreatePostModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.createPostLabel}>
              What would you like to discuss with the group?
            </Text>
            <TextInput
              style={styles.modalPostInput}
              value={newPost}
              onChangeText={setNewPost}
              placeholder="Share your thoughts, ask questions, or start a conversation..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={8}
              maxLength={500}
              autoFocus
            />
            <Text style={styles.charCount}>
              {newPost.length}/500 characters
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCreatePostModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalPostButton,
                  (!newPost.trim() || posting) && styles.modalPostButtonDisabled
                ]}
                onPress={createPost}
                disabled={!newPost.trim() || posting}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalPostButtonText}>Post Discussion</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <MemberBottomNav current="Groupchat" />
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
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
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
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  startDiscussionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  startDiscussionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  startDiscussionTextContainer: {
    flex: 1,
  },
  startDiscussionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 2,
  },
  startDiscussionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  startDiscussionArrow: {
    fontSize: 18,
    color: '#1976D2',
    fontWeight: 'bold',
  },

  // ✅ Updated Private Messages Button with Badge
  privateMessagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  privateMessagesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privateMessagesRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privateMessagesIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  privateMessagesTextContainer: {
    flex: 1,
  },
  privateMessagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 2,
  },
  privateMessagesSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  privateMessagesArrow: {
    fontSize: 18,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  createPostLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    fontWeight: '500',
  },
  modalPostInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6C757D',
  },
  cancelButtonText: {
    color: '#6C757D',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalPostButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  modalPostButtonDisabled: {
    backgroundColor: '#BBDEFB',
  },
  modalPostButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
  noGroupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noGroupText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  noGroupSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  postsList: {
    paddingBottom: 20,
  },
  postCard: {
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
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  announcementHeader: {
    marginBottom: 8,
  },
  announcementBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  postDate: {
    fontSize: 12,
    color: '#6C757D',
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
  postMessage: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
    marginBottom: 16,
  },
  announcementMessage: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
    marginBottom: 16,
  },
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
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginRight: 8,
    maxHeight: 80,
  },
  commentButton: {
    backgroundColor: '#28A745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  commentButtonDisabled: {
    backgroundColor: '#C3E6CB',
  },
  commentButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noPosts: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPostsText: {
    fontSize: 18,
    color: '#6C757D',
    marginBottom: 8,
  },
  noPostsSubtext: {
    fontSize: 14,
    color: '#ADB5BD',
    textAlign: 'center',
  },
  charCount: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'right',
    marginBottom: 16,
  },
});

export default GroupChatScreen;
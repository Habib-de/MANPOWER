import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import MemberBottomNav from '../../components/MemberBottomNav';

const API_BASE_URL = 'http://172.20.10.2:8080/api';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

interface Message {
  id: string;
  messageContent: string;
  createdBy: string;
  createdOn: string;
  isRead: boolean;
  senderName: string;
  receiverId: string;
  senderId: string;
  type: string;
  isTemp?: boolean;
}

interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageDate: string;
  unreadCount: number;
}

type ChatStage = 'list' | 'members' | 'chat';

export default function MemberChat() {
  const router = useRouter();
  
  // ===== STAGE MANAGEMENT =====
  const [stage, setStage] = useState<ChatStage>('list');
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  
  // ===== USER DATA =====
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(true);
  
  // ===== CONVERSATIONS LIST =====
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ===== MEMBERS LIST =====
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // ===== CHAT =====
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isFetching = useRef(false);

  // ===== INITIALIZATION =====
  useEffect(() => {
    initializeChat();
  }, []);

  // ===== POLLING FOR NEW MESSAGES =====
  useEffect(() => {
    if (stage === 'chat' && selectedUser) {
      const interval = setInterval(fetchMessages, 10000);
      return () => clearInterval(interval);
    }
  }, [stage, selectedUser]);

  const initializeChat = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedFirstName = await AsyncStorage.getItem('userFirstName');
      const storedLastName = await AsyncStorage.getItem('userLastName');
      const storedGroupId = await AsyncStorage.getItem('userGroupId');
      
      if (storedUserId) {
        setUserId(storedUserId);
        setUserName(`${storedFirstName || ''} ${storedLastName || ''}`.trim());
        setGroupId(storedGroupId || '');
        await fetchConversations(storedUserId);
      } else {
        Alert.alert('Error', 'Please login again');
        router.replace('/(auth)');
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      Alert.alert('Error', 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  // ===== STAGE 1: FETCH CONVERSATIONS =====
  const fetchConversations = async (currentUserId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`);
      
      if (response.ok) {
        const allNotifications = await response.json();
        
        const privateMessages = allNotifications.filter(
          (notif: any) => {
            if (notif.type !== 'PRIVATE_MESSAGE') return false;
            const receiverId = notif.member?.id;
            const senderId = notif.createdBy;
            return senderId === currentUserId || receiverId === currentUserId;
          }
        );

        const conversationMap = new Map<string, Conversation>();
        
        privateMessages.forEach((msg: any) => {
          const senderId = msg.createdBy;
          const receiverId = msg.member?.id;
          
          if (!receiverId) return;
          
          const otherUserId = senderId === currentUserId ? receiverId : senderId;
          if (!otherUserId) return;
          
          const key = [currentUserId, otherUserId].sort().join('-');
          
          let otherUserName = 'Unknown';
          if (senderId === currentUserId) {
            otherUserName = msg.member?.firstName 
              ? `${msg.member.firstName} ${msg.member.lastName || ''}`.trim() 
              : 'Unknown';
          } else {
            otherUserName = msg.senderName || 'Unknown';
          }

          if (!conversationMap.has(key)) {
            conversationMap.set(key, {
              id: key,
              otherUserId,
              otherUserName,
              lastMessage: msg.messageContent || '',
              lastMessageDate: msg.createdOn || new Date().toISOString(),
              unreadCount: receiverId === currentUserId && !msg.isRead ? 1 : 0,
            });
          } else {
            const existing = conversationMap.get(key)!;
            if (new Date(msg.createdOn) > new Date(existing.lastMessageDate)) {
              existing.lastMessage = msg.messageContent || '';
              existing.lastMessageDate = msg.createdOn;
            }
            if (receiverId === currentUserId && !msg.isRead) {
              existing.unreadCount += 1;
            }
          }
        });

        const conversationList = Array.from(conversationMap.values());
        conversationList.sort((a, b) => 
          new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
        );

        setConversations(conversationList);
        setFilteredConversations(conversationList);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  // ===== STAGE 2: FETCH MEMBERS =====
  const fetchGroupMembers = async () => {
    setLoadingMembers(true);
    try {
      const groupResponse = await fetch(`${API_BASE_URL}/groups/${groupId}`);
      
      if (!groupResponse.ok) {
        throw new Error('Failed to fetch group details');
      }
      
      const groupData = await groupResponse.json();
      
      let memberIds: string[] = [];
      
      if (groupData.members && Array.isArray(groupData.members)) {
        if (groupData.members.length > 0) {
          if (typeof groupData.members[0] === 'object' && groupData.members[0].id) {
            memberIds = groupData.members.map((m: any) => m.id);
          } else if (typeof groupData.members[0] === 'string') {
            memberIds = groupData.members;
          }
        }
      }

      if (memberIds.length === 0) {
        setMembers([]);
        setFilteredMembers([]);
        setLoadingMembers(false);
        return;
      }

      const memberPromises = memberIds.map(async (memberId: string) => {
        try {
          const id = String(memberId);
          const memberRes = await fetch(`${API_BASE_URL}/members/${id}`);
          if (memberRes.ok) {
            return await memberRes.json();
          }
          return null;
        } catch (err) {
          console.error(`Error fetching member ${memberId}:`, err);
          return null;
        }
      });

      const membersData = await Promise.all(memberPromises);
      
      const validMembers = membersData
        .filter(m => m !== null && m.id !== userId && m.status === 'Active')
        .map(m => ({
          id: String(m.id),
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          status: m.status
        }));

      setMembers(validMembers);
      setFilteredMembers(validMembers);
      
    } catch (error) {
      console.error('Failed to fetch members:', error);
      Alert.alert('Error', 'Could not load group members');
    } finally {
      setLoadingMembers(false);
    }
  };

  // ===== UPDATE CONVERSATION UNREAD COUNT =====
  const updateConversationUnreadCount = (otherUserId: string) => {
    const updatedConversations = conversations.map(conv => {
      if (conv.otherUserId === otherUserId) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    });
    setConversations(updatedConversations);
    
    const updatedFiltered = filteredConversations.map(conv => {
      if (conv.otherUserId === otherUserId) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    });
    setFilteredConversations(updatedFiltered);
  };

  // ===== MARK MESSAGES AS READ (FIXED) =====
  const markMessagesAsRead = async (messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return false;
    
    try {
      console.log('📤 Marking messages as read:', messageIds);
      
      const response = await fetch(`${API_BASE_URL}/notifications/mark-many-as-read`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageIds),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Messages marked as read successfully:', result);
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to mark messages as read:', response.status, errorText);
        
        // ✅ Try marking them one by one as fallback
        console.log('🔄 Trying to mark messages one by one...');
        let allSuccess = true;
        for (const id of messageIds) {
          try {
            const singleResponse = await fetch(`${API_BASE_URL}/notifications/${id}/mark-as-read`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!singleResponse.ok) {
              allSuccess = false;
              console.error(`❌ Failed to mark message ${id} as read`);
            }
          } catch (err) {
            allSuccess = false;
            console.error(`❌ Error marking message ${id} as read:`, err);
          }
        }
        return allSuccess;
      }
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      return false;
    }
  };

  // ===== STAGE 3: FETCH MESSAGES (ONLY FOR SELECTED USER) =====
  const fetchMessages = async () => {
    if (!userId || !selectedUser || isFetching.current) return;
    
    isFetching.current = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`);
      
      if (response.ok) {
        const allNotifications = await response.json();
        
        const privateMessages = allNotifications.filter((notif: any) => {
          if (notif.type !== 'PRIVATE_MESSAGE') return false;
          
          const senderId = notif.createdBy;
          const receiverId = notif.member?.id;
          
          return (senderId === userId && receiverId === selectedUser.id) ||
                 (senderId === selectedUser.id && receiverId === userId);
        });

        console.log(`📥 Found ${privateMessages.length} messages with ${selectedUser.name}`);

        privateMessages.sort((a: any, b: any) => 
          new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime()
        );

        const mappedMessages: Message[] = privateMessages.map((msg: any) => ({
          id: msg.id,
          messageContent: msg.messageContent || '',
          createdBy: msg.createdBy || '',
          createdOn: msg.createdOn || new Date().toISOString(),
          isRead: msg.isRead || false,
          senderName: msg.senderName || 'Unknown',
          receiverId: msg.member?.id || '',
          senderId: msg.createdBy || '',
          type: msg.type || 'PRIVATE_MESSAGE',
          isTemp: false,
        }));

        setMessages(mappedMessages);

        // ✅ Mark messages as read if current user is the receiver
        const unreadMessages = privateMessages.filter(
          (msg: any) => msg.member?.id === userId && !msg.isRead
        );

        if (unreadMessages.length > 0) {
          console.log(`📤 Found ${unreadMessages.length} unread messages to mark as read`);
          
          const success = await markMessagesAsRead(unreadMessages.map((msg: any) => msg.id));
          
          if (success) {
            // ✅ Update local messages to show as read
            setMessages(prev => 
              prev.map(msg => {
                const unread = unreadMessages.find((um: any) => um.id === msg.id);
                if (unread) {
                  return { ...msg, isRead: true };
                }
                return msg;
              })
            );
            
            // ✅ UPDATE CONVERSATION LIST - Remove unread badge
            updateConversationUnreadCount(selectedUser.id);
            
            // ✅ Force refresh conversations from backend to sync
            setTimeout(() => {
              fetchConversations(userId);
            }, 500);
          }
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 200);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      isFetching.current = false;
    }
  };

  // ===== SEND MESSAGE =====
  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !selectedUser) return;

    setSending(true);
    const messageContent = newMessage.trim();
    const tempId = generateUUID();
    
    const tempMessage: Message = {
      id: tempId,
      messageContent,
      createdBy: userId,
      createdOn: new Date().toISOString(),
      isRead: false,
      senderName: userName,
      receiverId: selectedUser.id,
      senderId: userId,
      type: 'PRIVATE_MESSAGE',
      isTemp: true,
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const messageData = {
        id: tempId,
        title: `Private message from ${userName}`,
        messageContent: messageContent,
        createdBy: userId,
        groupId: groupId,
        parentId: null,
        senderName: userName,
        type: 'PRIVATE_MESSAGE',
        member: {
          id: selectedUser.id,
          firstName: selectedUser.name.split(' ')[0] || '',
          lastName: selectedUser.name.split(' ').slice(1).join(' ') || ''
        },
        sendDate: new Date().toISOString(),
        createdOn: new Date().toISOString(),
        channel: 'APP',
        isRead: false,
        mansoftTenantId: 'tenant-001'
      };

      const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        const savedMessage = await response.json();
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId ? { 
              ...savedMessage, 
              senderId: userId, 
              receiverId: selectedUser.id,
              createdBy: userId,
              type: 'PRIVATE_MESSAGE',
              isTemp: false,
            } : msg
          )
        );
        
        await fetchConversations(userId);
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      Alert.alert('Error', 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // ===== HELPERS =====
  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date >= yesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatChatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatChatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  // ===== RENDER FUNCTIONS =====

  const renderConversationList = () => {
    const filtered = conversations.filter(conv =>
      conv.otherUserName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <View style={styles.stageContainer}>
        <View style={styles.listHeader}>
          <View style={styles.headerLeft}>
            <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
          <TouchableOpacity
            style={styles.newChatButton}
            onPress={() => {
              fetchGroupMembers();
              setStage('members');
            }}
          >
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a new chat by tapping the ✏️ icon above
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isUnread = item.unreadCount > 0;
              return (
                <TouchableOpacity
                  style={styles.conversationItem}
                  onPress={() => {
                    setSelectedUser({
                      id: item.otherUserId,
                      name: item.otherUserName,
                    });
                    setStage('chat');
                    setTimeout(fetchMessages, 100);
                  }}
                >
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.otherUserName.charAt(0)}</Text>
                    </View>
                    {isUnread && <View style={styles.onlineDot} />}
                  </View>
                  <View style={styles.conversationInfo}>
                    <View style={styles.conversationHeader}>
                      <Text style={[styles.conversationName, isUnread && styles.unreadName]}>
                        {item.otherUserName}
                      </Text>
                      <Text style={[styles.conversationTime, isUnread && styles.unreadTime]}>
                        {formatTime(item.lastMessageDate)}
                      </Text>
                    </View>
                    <View style={styles.conversationFooter}>
                      <Text style={[styles.lastMessage, isUnread && styles.unreadMessage]} numberOfLines={1}>
                        {item.lastMessage}
                      </Text>
                      {isUnread && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  const renderMemberSelection = () => {
    const filtered = members.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );

    return (
      <View style={styles.stageContainer}>
        <View style={styles.memberHeader}>
          <TouchableOpacity onPress={() => setStage('list')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Chat</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor="#999"
            value={memberSearchQuery}
            onChangeText={setMemberSearchQuery}
          />
        </View>

        {loadingMembers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#25D366" />
            <Text style={styles.loadingText}>Loading members...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No members found</Text>
            <Text style={styles.emptySubtext}>
              {memberSearchQuery ? 'Try a different search term' : 'No other active members in your group'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const fullName = `${item.firstName} ${item.lastName}`;
              return (
                <TouchableOpacity
                  style={styles.memberItem}
                  onPress={() => {
                    setSelectedUser({
                      id: item.id,
                      name: fullName,
                    });
                    setStage('chat');
                    setTimeout(fetchMessages, 100);
                  }}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{item.firstName.charAt(0)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{fullName}</Text>
                    <Text style={styles.memberEmail}>{item.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };

  const renderChat = () => {
    return (
      <View style={styles.stageContainer}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setStage('list')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{selectedUser?.name}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name="call-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isOwnMessage = item.createdBy === userId;
              const showDate = index === 0 || 
                new Date(item.createdOn).toDateString() !== 
                new Date(messages[index - 1]?.createdOn).toDateString();

              return (
                <View>
                  {showDate && (
                    <View style={styles.dateContainer}>
                      <Text style={styles.dateText}>{formatChatDate(item.createdOn)}</Text>
                    </View>
                  )}
                  <View style={[
                    styles.messageContainer,
                    isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
                  ]}>
                    {!isOwnMessage && (
                      <Text style={styles.messageSender}>{item.senderName || selectedUser?.name}</Text>
                    )}
                    <View style={[
                      styles.messageBubble,
                      isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
                    ]}>
                      <Text style={[
                        styles.messageText,
                        isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                      ]}>
                        {item.messageContent}
                      </Text>
                      <View style={styles.messageFooter}>
                        <Text style={[
                          styles.messageTime,
                          isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
                        ]}>
                          {formatChatTime(item.createdOn)}
                        </Text>
                        {isOwnMessage && (
                          <Text style={styles.readStatus}>
                            {item.isTemp ? ' ⏳' : item.isRead ? ' ✓✓' : ' ✓'}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TouchableOpacity style={styles.attachButton}>
                <Ionicons name="add-circle-outline" size={28} color="#999" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || sending) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={22} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  };

  // ===== MAIN RENDER =====
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {stage === 'list' && renderConversationList()}
      {stage === 'members' && renderMemberSelection()}
      {stage === 'chat' && renderChat()}
      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5DDD5',
  },
  stageContainer: {
    flex: 1,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5DDD5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#b1e8b9',
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#075e37',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#066257',
    flex: 1,
    marginLeft: 12,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerStatus: {
    fontSize: 12,
    color: '#B9D9CB',
  },
  headerAction: {
    padding: 8,
  },
  backButton: {
    padding: 4,
  },
  newChatButton: {
    padding: 8,
    backgroundColor: '#021a17', // ← Dark green background so it shows on light green
  borderRadius: 25,
  width: 40,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',

    
  },
  logo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
    marginRight: 10,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },

  listContent: {
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  unreadName: {
    fontWeight: 'bold',
    color: '#000',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadTime: {
    color: '#25D366',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    marginRight: 8,
  },
  unreadMessage: {
    color: '#333',
  },
  unreadBadge: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    color: '#888',
  },

  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateText: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    color: '#888',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '80%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageSender: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    minWidth: 60,
  },
  ownMessageBubble: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#000',
  },
  otherMessageText: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  ownMessageTime: {
    color: '#888',
  },
  otherMessageTime: {
    color: '#888',
  },
  readStatus: {
    fontSize: 10,
    color: '#34B7F1',
    marginLeft: 4,
  },

  inputContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    marginHorizontal: 8,
  },
  sendButton: {
    backgroundColor: '#25D366',
    borderRadius: 25,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#A8D5BA',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});
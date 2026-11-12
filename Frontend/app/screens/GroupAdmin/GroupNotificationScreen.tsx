import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, SafeAreaView, Image, Platform, RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.102:8080/api';

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

const GroupAdminNotificationScreen = () => {
  const router = useRouter();
  
  // Form State
  const [type, setType] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [channel, setChannel] = useState('InApp'); // 👈 Defaulted to InApp
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Data State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [fetchingNotifications, setFetchingNotifications] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserAndNotifications = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      const email = await AsyncStorage.getItem('userEmail');
      const groupId = await AsyncStorage.getItem('userGroupId');
      const mansoftTenantId = await AsyncStorage.getItem('userTenantId');

      if (!id || !email || !groupId || !mansoftTenantId) {
        showAlert('Error', 'Missing user data. Please log in again.', () => {
          router.replace('/(auth)');
        });
        return;
      }

      setUser({ id, email, groupId, mansoftTenantId });

            // Fetch existing notifications
      const res = await axios.get(`${BASE_URL}/notifications`);
      const allNotifications = res.data;
      
      // Filter notifications sent by this admin
      const mySentNotifications = allNotifications.filter(
        (n: any) => n.createdBy === email
      );

      // 👇 ADD THIS: Group them by message + timestamp + type so it shows 1 card per broadcast
      const groupedMap = new Map();

      mySentNotifications.forEach((n: any) => {
        // Create a unique key based on the exact message, type, and time it was sent
        const key = `${n.messageContent}_${n.type}_${n.createdOn}`;
        
        if (!groupedMap.has(key)) {
          // First time seeing this message: save it
          groupedMap.set(key, { ...n, recipientCount: 1 });
        } else {
          // We've seen this message: just increase the recipient count
          const existing = groupedMap.get(key);
          existing.recipientCount += 1;
        }
      });

      // Convert the map back to an array and sort by newest first
      const uniqueNotifications = Array.from(groupedMap.values());
      uniqueNotifications.sort((a: any, b: any) => 
        new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
      );

      setNotifications(uniqueNotifications);

    } catch (error) {
      console.error('Error:', error);
      showAlert('Error', 'Failed to load data.');
    } finally {
      setFetchingNotifications(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserAndNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserAndNotifications();
  };

  const handleSend = async () => {
    if (!type || !messageContent.trim() || !channel) {
      showAlert('Validation', 'All fields are required.');
      return;
    }
    if (!user) return;

    setLoading(true);
    const now = new Date().toISOString();
    const payload = {
      id: '',
      member: { id: user.id, group: { id: user.groupId } },
      type,
      messageContent,
      sendDate: now,
      channel,
      createdBy: user.email,
      modifiedBy: user.email,
      createdOn: now,
      modifiedOn: now,
      mansoftTenantId: user.mansoftTenantId,
      read: false,
    };

    try {
      const response = await axios.post(
        `${BASE_URL}/notifications/send-to-group/${user.groupId}`,
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      showAlert('Success ✅', 'Notification sent successfully!', () => {
        setType('');
        setMessageContent('');
        setShowForm(false); // Hide form on success
        fetchUserAndNotifications(); // Refresh list
      });
    } catch (error: any) {
      const msg = error.response?.data || error.message || 'Failed to send notification.';
      showAlert('Error ❌', msg.toString());
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'Alert': return '#F44336';
      case 'Urgent': return '#FF5722';
      case 'Reminder': return '#FF9800';
      default: return '#2196F3';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.inner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Group Notifications</Text>

        {/* COLLAPSIBLE CREATE FORM */}
        <View style={styles.formCard}>
                    <TouchableOpacity
            style={styles.createToggleButton}
            onPress={() => setShowForm(!showForm)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={showForm ? "remove-circle" : "add-circle"} size={20} color="#1565C0" />
              <Text style={styles.createToggleText}>
                {showForm ? 'Cancel' : 'Create New Notification'}
              </Text>
            </View>
            <Ionicons name={showForm ? "chevron-up" : "chevron-down"} size={20} color="#1565C0" />
          </TouchableOpacity>

                    {/* 👇 NEW: Monitor Chats Link */}
          <View style={styles.divider} />          {/* 👈 ADD: Divider line */}
          
          <TouchableOpacity 
            style={styles.monitorLink}
            onPress={() => router.push('/(groupadmin)/monitor')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={16} color="#1976D2" />
            <Text style={styles.monitorLinkText}>Monitor Chats</Text>
            <Ionicons name="arrow-forward" size={14} color="#1976D2" />
          </TouchableOpacity>

          {showForm && (
            <View style={styles.formBody}>
              <Text style={styles.label}>Notification Type</Text>
              <View style={styles.chipRow}>
                {['Alert', 'Information', 'Reminder', 'Urgent'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, type === t && styles.selectedChip]}
                    onPress={() => setType(t)}
                  >
                    <Text style={type === t ? styles.selectedChipText : styles.chipText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Message</Text>
              <TextInput
                style={styles.textArea}
                value={messageContent}
                onChangeText={setMessageContent}
                placeholder="Type your message here..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />

             

              <TouchableOpacity
                style={[styles.sendButton, loading && { opacity: 0.7 }]}
                onPress={handleSend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send Notification</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* PREVIOUS NOTIFICATIONS LIST */}
        <Text style={styles.sectionTitle}>Previous Notifications</Text>
        
        {fetchingNotifications ? (
          <ActivityIndicator size="large" color="#1565C0" style={{ marginTop: 20 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>No notifications sent yet.</Text>
          </View>
        ) : (
                    notifications.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.notificationCard}
              onPress={() => router.push('/(groupadmin)/monitor')} // 👈 ADD THIS
              activeOpacity={0.7}
            >
              <View style={styles.notifHeader}>
                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                  <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
                    {item.type}
                  </Text>
                </View>
                <Text style={styles.notifDate}>
                  {new Date(item.createdOn).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.notifMessage}>{item.messageContent}</Text>
                            <View style={styles.notifFooter}>
                <Ionicons name="people-outline" size={14} color="#666" />
                <Text style={styles.notifChannel}>
                  Sent to {item.recipientCount} member{item.recipientCount > 1 ? 's' : ''}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#1565C0" style={{ marginLeft: 'auto' }} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
    elevation: 3,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  inner: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#1565C0', marginBottom: 20 },
  
  // Form Styles
  formCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 24, elevation: 2 },
  createToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  createToggleText: { color: '#1565C0', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  formBody: { marginTop: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedChip: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  chipText: { color: '#666', fontWeight: '500', fontSize: 13 },
  selectedChipText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  textArea: {
    backgroundColor: '#F9F9F9',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  sendButton: {
    backgroundColor: '#1565C0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // List Styles
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1565C0', marginBottom: 12 },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  typeText: { fontSize: 11, fontWeight: 'bold' },
  notifDate: { fontSize: 12, color: '#888' },
  notifMessage: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 10 },
  notifFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notifChannel: { fontSize: 11, color: '#666' },
  
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: '#999', marginTop: 10 },

    monitorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',  // 👈 Aligns to the right edge
    gap: 6,
    paddingVertical: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  monitorLinkText: {
    color: '#1976D2',
    fontSize: 13,
    fontWeight: '600',
  },
    divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,      // 👈 Gives space above and below the line
  },
});

export default GroupAdminNotificationScreen;
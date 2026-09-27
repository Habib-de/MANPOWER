import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert, // Import Alert for user feedback
} from 'react-native';
import MemberBottomNav from '../../components/MemberBottomNav';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.0.101:8080/api';

type Notification = {
  id: string;
  member: {
    id: string;
  };
  type: string;
  messageContent: string;
  sendDate: string;
  channel: string;
  read: boolean; // Corresponds to isRead in backend
  // Include other fields if needed, like createdOn, modifiedOn, etc.
  // Although not strictly necessary for this screen, it's good practice
  // to reflect the full entity if you're fetching it.
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Unread' | 'Read'>('All');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        // Optionally redirect to login or show an error
        console.error('User not logged in. Cannot fetch notifications.');
        Alert.alert('Error', 'Please log in to view notifications.');
        router.replace('/login'); // Assuming you have a login route
        return;
      }

      // It's generally more efficient to fetch notifications specific to the user
      // if your backend has such an endpoint (e.g., /notifications/by-user/{userId}).
      // For now, filtering on the client-side as you do is fine if that's not available.
      const res = await fetch(`${BASE_URL}/notifications`); // Fetches ALL notifications
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const allNotifications: Notification[] = await res.json();

      const userNotifications = allNotifications.filter(
        (n) => n.member?.id === userId
      );

      setNotifications(userNotifications);
    } catch (err) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Failed to load notifications. Please try again later.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  /**
   * Marks a single notification as read on the backend and updates local state.
   * @param id The ID of the notification to mark as read.
   */
  const markAsRead = async (id: string) => {
    try {
      // ✅ CHANGED: Using PATCH method and the new specific endpoint
      const response = await fetch(`${BASE_URL}/notifications/${id}/mark-as-read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // No body is needed for this specific PATCH endpoint as designed on the backend
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to mark as read: ${response.status} - ${errorText}`);
      }

      // Update the local state to reflect the change immediately
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
      Alert.alert('Error', 'Could not mark notification as read. Please try again.');
      // Optionally re-fetch notifications if the state might be out of sync
      // fetchNotifications();
    }
  };

  /**
   * Marks all unread notifications as read on the backend and updates local state.
   */
  const markAllAsRead = async () => {
    const unreadNotificationIds = notifications
      .filter((n) => !n.read)
      .map((n) => n.id);

    if (unreadNotificationIds.length === 0) {
      console.log('No unread notifications to mark.');
      Alert.alert('Info', 'All notifications are already read!');
      return;
    }

    try {
      // ✅ CHANGED: Using PATCH method and the new batch endpoint
      const response = await fetch(`${BASE_URL}/notifications/mark-many-as-read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unreadNotificationIds), // Sending array of IDs in the body
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to mark all as read: ${response.status} - ${errorText}`);
      }

      // Update the local state to mark all as read
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      Alert.alert('Success', 'All unread notifications marked as read.');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      Alert.alert('Error', 'Could not mark all notifications as read. Please try again.');
      // Optionally re-fetch notifications if the state might be out of sync
      // fetchNotifications();
    }
  };

  const filteredNotifications =
    filter === 'All'
      ? notifications
      : notifications.filter((n) => n.read === (filter === 'Read'));

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => markAsRead(item.id)} // This calls the updated markAsRead
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.type}</Text>
        {!item.read && <View style={styles.badge} />}
      </View>
      <Text style={styles.message}>{item.messageContent}</Text>
      <View style={styles.footerRow}>
        <Text style={styles.channel}>{item.channel}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.sendDate).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
            <Text style={styles.returnButton}>🏠 Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.bellContainer}>
            <Text style={styles.bell}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {['All', 'Unread', 'Read'].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f as any)}
            style={[
              styles.filterBtn,
              filter === f && styles.activeFilterBtn,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.activeFilterText,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
          <Text style={styles.markAllText}>✓ Mark All as Read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F57C00" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notifications found.</Text>
          }
        />
      )}

      <MemberBottomNav current="notifications" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E0' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFE0B2',
    borderBottomWidth: 1,
    borderBottomColor: '#FFCC80',
    elevation: 3,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 18, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#D84315' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  returnButton: { fontSize: 14, color: '#BF360C', fontWeight: '600' },
  bellContainer: { position: 'relative' },
  bell: { fontSize: 22 },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#FF5722',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  bellBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF8E1',
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFECB3',
    borderRadius: 20,
  },
  activeFilterBtn: {
    backgroundColor: '#FFA726',
  },
  filterText: { fontSize: 13, color: '#BF360C' },
  activeFilterText: { fontWeight: 'bold', color: '#FFF' },
  markAllBtn: {
    marginLeft: 'auto',
    backgroundColor: '#FFAB91',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  markAllText: { fontSize: 12, fontWeight: 'bold', color: '#4E342E' },
  list: { padding: 16, paddingBottom: 90 },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#FFA726',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  badge: {
    width: 10,
    height: 10,
    backgroundColor: '#FF5722',
    borderRadius: 5,
  },
  message: { fontSize: 14, marginTop: 6, color: '#555' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  channel: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#888',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 14,
  },
});
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  // Alert, // COMMENT OUT THIS IMPORT
  ScrollView, ActivityIndicator, SafeAreaView, Image, Platform // ADD Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

// ADD THIS HELPER FUNCTION at the top (after imports, before component)
const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
  }
};

const GroupAdminNotificationScreen = () => {
  const router = useRouter();
  const [type, setType] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);

  const [user, setUser] = useState<any>(null); // raw user data from AsyncStorage

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        const email = await AsyncStorage.getItem('userEmail');
        const groupId = await AsyncStorage.getItem('userGroupId');
        const mansoftTenantId = await AsyncStorage.getItem('userTenantId');

        if (!id || !email || !groupId || !mansoftTenantId) {
          showAlert('Error', 'Missing user data. Please log in again.', () => {
            router.replace('/(auth)/index'); // Redirect to login if user data is missing
          });
          return;
        }

        setUser({ id, email, groupId, mansoftTenantId });
      } catch (error) {
        showAlert('Error', 'Failed to load user info.');
      }
    };

    fetchUser();
  }, []);

  const handleSend = async () => {
    if (!type || !messageContent.trim() || !channel) {
      showAlert('Validation', 'All fields are required.');
      return;
    }

    if (!user) {
      showAlert('Error', 'User info not loaded.');
      return;
    }

    setLoading(true);

    const now = new Date().toISOString();
    const payload = {
      id: '', // Backend should assign ID
      member: {
        id: user.id,
        group: {
          id: user.groupId,
        },
      },
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
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      showAlert('Success ✅', response.data || 'Notification sent', () => {
        setType('');
        setMessageContent('');
        setChannel('');
      });
      
    } catch (error: any) {
      const msg =
        error.response?.data ||
        error.message ||
        'Failed to send notification.';
      showAlert('Error ❌', msg.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with Logo, App Name, and Return to Home Button */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          {/* Ensure the path to your logo is correct */}
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Group Notification</Text>

        <Text style={styles.label}>Notification Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
          {['Alert', 'Information', 'Reminder', 'Urgent'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, type === t && styles.selectedChip]}
              onPress={() => setType(t)}
            >
              <Text style={type === t ? styles.selectedChipText : styles.chipText}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={styles.textArea}
          value={messageContent}
          onChangeText={setMessageContent}
          placeholder="Type your message"
          multiline
          numberOfLines={5}
        />

        <Text style={styles.label}>Channel</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
          {['SMS', 'Email', 'InApp', 'All'].map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, channel === c && styles.selectedChip]}
              onPress={() => setChannel(c)}
            >
              <Text style={channel === c ? styles.selectedChipText : styles.chipText}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.button}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Notification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Persistent Bottom Navigation */}
      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD', // Consistent background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#BBDEFB', // Light blue header background
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9', // Slightly darker border
    // Added shadow for a subtle lift, similar to the profile screen's feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  backToHome: {
    color: '#1565C0', // Blue color for the link
    fontWeight: 'bold',
    fontSize: 14,
  },
  container: { flex: 1, backgroundColor: '#F0F8FF' }, // Main content container background
  inner: {
    padding: 20,
    paddingBottom: 100, // Add padding at the bottom to prevent content from being hidden by the bottom nav
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1A237E', // Darker blue for titles
  },
  label: {
    marginTop: 20,
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
  },
  chipScrollView: {
    paddingVertical: 5, // Consistent vertical padding for chip rows
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginRight: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  selectedChip: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  chipText: {
    color: '#333',
    fontWeight: '500',
  },
  selectedChipText: {
    color: '#fff',
    fontWeight: '600',
  },
  textArea: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    fontSize: 16,
    minHeight: 120, // Ensure adequate height for multiline input
  },
  button: {
    marginTop: 30,
    backgroundColor: '#4CAF50', // Green for send button
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row', // For centering text/indicator
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 18 },
});

export default GroupAdminNotificationScreen;
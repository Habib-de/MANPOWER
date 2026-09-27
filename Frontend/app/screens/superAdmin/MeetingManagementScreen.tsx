import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const BASE_URL = 'http://192.168.0.101:8080/api'; // 🛜 Update to match your local IP if needed

function MeetingManagementScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetings = async () => {
    try {
      const response = await fetch(`${BASE_URL}/meetings`);
      if (!response.ok) throw new Error('Failed to fetch meetings');
      const data = await response.json();
      setMeetings(data);
    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('Error', 'Could not load meetings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const goToScheduleMeeting = () => {
    navigation.navigate('ScheduleNewMeeting' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Meeting Management (System-Wide)</Text>
        <Text style={styles.subtitle}>
          View all scheduled meetings for GroupAdmins and manage them accordingly.
        </Text>

        <TouchableOpacity style={styles.scheduleButton} onPress={goToScheduleMeeting}>
          <Text style={styles.scheduleText}>➕ Schedule New Meeting</Text>
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>📋 Upcoming Meetings for GroupAdmins</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" />
        ) : meetings.length === 0 ? (
          <Text style={{ color: '#777' }}>No meetings found.</Text>
        ) : (
          meetings.map((meeting: any) => (
            <View key={meeting.id} style={styles.card}>
              <Text style={styles.cardTitle}>{meeting.title}</Text>
              <Text style={styles.cardDetail}>📅 {meeting.meetingDate}</Text>
              <Text style={styles.cardDetail}>🕒 {meeting.meetingTime}</Text>
              <Text style={styles.cardDetail}>📍 {meeting.meetingLink || 'N/A'}</Text>
              <Text style={styles.cardDetail}>🎯 Target: {meeting.targetAudience}</Text>
              <Text style={styles.cardDetail}>👤 Called By: {meeting.calledByRole}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#2E7D32',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  cardDetail: {
    fontSize: 14,
    color: '#666',
  },
  scheduleButton: {
    backgroundColor: '#388E3C',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  scheduleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default MeetingManagementScreen;

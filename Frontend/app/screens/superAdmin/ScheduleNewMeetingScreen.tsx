import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Button,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';
import { useRouter } from 'expo-router';

const BASE_URL = 'http://192.168.0.101:8080/api';

// Simulated session (can be dynamic later)
const userRole: 'SuperAdmin' | 'GroupAdmin' = 'GroupAdmin';
const loggedInGroupId = '42cb4c63-476b-42be-8e53-b3c1d6f4516f';
const loggedInUserId = '4472ce6c-2002-4818-af1c-a560fcab64aa';

export default function MeetingManagerScreen(): React.JSX.Element {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any>(null);

  const fetchGroupData = async () => {
    try {
      const res = await fetch(`${BASE_URL}/groups/${loggedInGroupId}`);
      const data = await res.json();
      setGroupData(data);
    } catch (err) {
      console.error('❌ Group fetch error:', err);
      Alert.alert('Error', 'Failed to fetch group info.');
    }
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`${BASE_URL}/meetings`);
      const data = await res.json();

      const filtered = data.filter((m: any) =>
        userRole === 'SuperAdmin'
          ? m.calledByRole === 'SuperAdmin'
          : m.calledByRole === 'GroupAdmin'
      );

      setMeetings(filtered);
    } catch (err) {
      console.error('❌ Meeting fetch error:', err);
      Alert.alert('Error', 'Unable to load meetings.');
    }
  };

  useEffect(() => {
    fetchMeetings();
    if (userRole === 'GroupAdmin') {
      fetchGroupData();
    }
  }, []);

  const handleSchedule = async () => {
    if (!title || !agenda || !meetingDate || !meetingTime || !meetingLink) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return;
    }

    if (userRole === 'GroupAdmin' && !groupData) {
      Alert.alert('Error', 'Group information not available.');
      return;
    }

    const now = new Date().toISOString();

    const meetingPayload: any = {
      title,
      agenda,
      meetingDate,
      meetingTime, // ✅ send as string like "17:30"
      meetingLink,
      calledByRole: userRole,
      targetAudience: userRole === 'SuperAdmin' ? 'GroupAdmins' : 'GroupMembers',
      createdBy: loggedInUserId,
      modifiedBy: loggedInUserId,
      createdOn: now,
      modifiedOn: now,
      mansoftTenantId: groupData?.mansoftTenantId || 'tenant-001',
      group: userRole === 'GroupAdmin' ? groupData : null,
    };

    try {
      const res = await fetch(`${BASE_URL}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingPayload),
      });

      if (!res.ok) throw new Error('Failed to schedule meeting');

      Alert.alert('✅ Success', 'Meeting scheduled!');
      setTitle('');
      setAgenda('');
      setMeetingDate('');
      setMeetingTime('');
      setMeetingLink('');
      fetchMeetings();
    } catch (err) {
      console.error('❌ Schedule error:', err);
      Alert.alert('Error', 'Could not schedule meeting.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(superadmin)/dashboard')}>
          <Text style={styles.returnHomeText}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Meeting Center</Text>
        <Text style={styles.subtitle}>
          {userRole === 'SuperAdmin'
            ? 'Schedule and manage system-wide meetings for GroupAdmins.'
            : 'Schedule and view meetings for your group.'}
        </Text>

        <Text style={styles.sectionHeader}>➕ Schedule New Meeting</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Agenda</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          multiline
          value={agenda}
          onChangeText={setAgenda}
        />

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={meetingDate} onChangeText={setMeetingDate} />

        <Text style={styles.label}>Time (HH:MM)</Text>
        <TextInput style={styles.input} value={meetingTime} onChangeText={setMeetingTime} />

        <Text style={styles.label}>Meeting Link</Text>
        <TextInput style={styles.input} value={meetingLink} onChangeText={setMeetingLink} />

        <View style={{ marginVertical: 10 }}>
          <Button title="Schedule Meeting" onPress={handleSchedule} color="#2E7D32" />
        </View>

        <Text style={styles.sectionHeader}>📅 Scheduled Meetings</Text>
        {meetings.length === 0 ? (
          <Text>No meetings available.</Text>
        ) : (
          meetings.map((m) => (
            <View key={m.id} style={styles.card}>
              <Text style={styles.cardTitle}>{m.title}</Text>
              <Text>📅 {m.meetingDate}</Text>
              <Text>🕒 {m.meetingTime}</Text>
              <Text>🎯 {m.targetAudience}</Text>
              <Text>🔗 {m.meetingLink}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <SuperAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E9' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomColor: '#A5D6A7',
    borderBottomWidth: 1,
  },
  logoWrapper: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  logoTextContainer: { flexDirection: 'row' },
  titleBlack: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  titleRed: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', marginLeft: 4 },
  returnHomeText: { fontSize: 14, fontWeight: '600', color: '#1565C0' },
  container: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 20 },
  sectionHeader: { fontSize: 18, fontWeight: '600', color: '#2E7D32', marginVertical: 15 },
  label: { fontSize: 14, fontWeight: '500', marginTop: 10, color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
});

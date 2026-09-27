import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import MemberBottomNav from '../../components/MemberBottomNav';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.0.101:8080/api'; // 👈 Base URL here

type Meeting = {
  id: string;
  group: {
    id: string;
    groupName: string;
  };
  meetingDate: string;
  meetingTime: string;
  meetingLink?: string;
  title: string;
  agenda?: string;
  createdBy?: string;
  createdOn?: string;
  mansoftTenantId: string;
};

export default function MeetingsScreen() {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);

        // 🧠 Get the logged-in member
        const storedMember = await AsyncStorage.getItem('loggedMember');
        if (!storedMember) throw new Error('User not logged in');

        const member = JSON.parse(storedMember);
        const groupId = member.group.id;

        // 🌐 Fetch meetings using BASE_URL
        const res = await fetch(`${BASE_URL}/meetings`);
        if (!res.ok) throw new Error('Failed to fetch meetings');
        const data = await res.json();

        // 🎯 Filter by group ID
        const filtered = data.filter((m: Meeting) => m.group?.id === groupId);
        setMeetings(filtered);
      } catch (error) {
        console.error('Failed to fetch meetings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  const renderMeeting = ({ item }: { item: Meeting }) => (
    <View style={styles.meetingCard}>
      <Text style={styles.meetingTitle}>{item.title}</Text>
      <Text style={styles.meetingInfo}>📅 {item.meetingDate}    ⏰ {item.meetingTime}</Text>
      {item.agenda && <Text style={styles.meetingAgenda}>📝 {item.agenda}</Text>}
      {item.createdBy && <Text style={styles.createdBy}>👤 Created by: {item.createdBy}</Text>}
      {item.meetingLink && activeTab === 'Upcoming' && (
        <TouchableOpacity style={styles.joinBtn} onPress={() => Linking.openURL(item.meetingLink!)}>
          <Text style={styles.joinText}>Join Meeting</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const isUpcoming = (meetingDate: string) => {
    return new Date(meetingDate) >= new Date();
  };

  const filteredMeetings = meetings.filter((m) =>
    activeTab === 'Upcoming' ? isUpcoming(m.meetingDate) : !isUpcoming(m.meetingDate)
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.header}>Meetings</Text>

      <View style={styles.tabContainer}>
        {['Upcoming', 'Past'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab as 'Upcoming' | 'Past')}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1976D2" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredMeetings}
          keyExtractor={(item) => item.id}
          renderItem={renderMeeting}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No {activeTab.toLowerCase()} meetings found.</Text>
          }
        />
      )}

      <MemberBottomNav current="meetings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E3F2FD' },
  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#C8E6C9',
    borderBottomWidth: 1, borderBottomColor: '#A5D6A7', elevation: 3,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 18, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#D32F2F' },
  returnButton: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },
  header: {
    fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 15, color: '#0D47A1',
  },
  tabContainer: {
    flexDirection: 'row', justifyContent: 'center', backgroundColor: '#BBDEFB',
    borderRadius: 8, marginHorizontal: 20,
  },
  tab: { paddingVertical: 10, paddingHorizontal: 20 },
  activeTab: { backgroundColor: '#1976D2', borderRadius: 8 },
  tabText: { fontSize: 16, color: '#1565C0', fontWeight: '600' },
  activeTabText: { color: '#FFF' },
  listContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
  meetingCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 15, marginBottom: 15, elevation: 3,
  },
  meetingTitle: {
    fontSize: 16, fontWeight: 'bold', color: '#0D47A1', marginBottom: 6,
  },
  meetingInfo: { fontSize: 14, color: '#444', marginBottom: 4 },
  meetingAgenda: {
    fontSize: 14, color: '#555', marginTop: 5, fontStyle: 'italic',
  },
  createdBy: { fontSize: 12, color: '#888', marginTop: 4 },
  joinBtn: {
    marginTop: 10, backgroundColor: '#1E88E5', paddingVertical: 8,
    borderRadius: 6, alignItems: 'center',
  },
  joinText: { color: '#FFFFFF', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 20 },
});

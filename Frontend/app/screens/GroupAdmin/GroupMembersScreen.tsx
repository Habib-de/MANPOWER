// GroupMembersScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://172.20.10.2:8080/api';

function GroupMembersScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Terminated'>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembersWithContributions = async () => {
      try {
        const groupAdminId = await AsyncStorage.getItem('userId');
        if (!groupAdminId) throw new Error('Group Admin ID not found');

        const response = await fetch(`${API_BASE_URL}/groups/groupadmin/${groupAdminId}`);
        const groups = await response.json();

        const allMembers: any[] = [];

        for (const group of groups) {
          const groupMembers = group.members || [];

          for (const member of groupMembers) {
            try {
              const contribRes = await fetch(`${API_BASE_URL}/contributions/member/${member.id}`);
              const contributions = contribRes.ok ? await contribRes.json() : [];

              allMembers.push({
                ...member,
                group,
                contributions,
              });
            } catch {
              allMembers.push({
                ...member,
                group,
                contributions: [],
              });
            }
          }
        }

        setMembers(allMembers);
      } catch (err) {
        Alert.alert('Error', 'Failed to fetch members or contributions.');
      } finally {
        setLoading(false);
      }
    };

    fetchMembersWithContributions();
  }, []);

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCall = (phone: string) => Linking.openURL(`tel:${phone}`);
  const handleEmail = (email: string) => Linking.openURL(`mailto:${email}`);

  const handleToggleStatus = async (member: any) => {
    const newStatus = member.status === 'Active' ? 'Inactive' : 'Active';

    const payload = {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      password: member.password?.length >= 8 ? member.password : 'changeme123', // ensure valid default
      status: newStatus,
      role: member.role,
      joinDate: member.joinDate || new Date().toISOString().split('T')[0],
      createdBy: member.createdBy || member.email || 'system',
      modifiedBy: member.modifiedBy || member.email || 'system',
      createdOn: member.createdOn || new Date().toISOString(),
      modifiedOn: new Date().toISOString(),
      mansoftTenantId: member.mansoftTenantId || 'tenant-001',
      groupId: member.group?.id || '',
      groupName: member.group?.groupName || '',
    };

    try {
      const response = await fetch(`${API_BASE_URL}/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to update member');

      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, status: newStatus } : m))
      );

      Alert.alert('Success', `Member is now ${newStatus}`);
    } catch (err) {
      Alert.alert('Error', `Status update failed: ${err}`);
    }
  };

  const renderMember = ({ item }: { item: any }) => (
    <View style={styles.memberCard}>
      <Text style={styles.memberName}>{item.firstName} {item.lastName}</Text>
      <Text style={styles.memberDetail}>📧 {item.email}</Text>
      <Text style={styles.memberDetail}>📞 {item.phoneNumber}</Text>
      <Text style={styles.memberDetail}>🟢 Status: {item.status}</Text>
      <Text style={styles.memberDetail}>🧑 Role: {item.role}</Text>

      {/* {item.contributions?.length ? (
        item.contributions.map((c: any, idx: number) => {
          const dateText = c.transactionDate
            ? new Date(c.transactionDate).toDateString()
            : 'Invalid date';
          return (
            <Text key={idx} style={styles.memberDetail}>
              💰 Contribution: KES {c.amount.toLocaleString()} on {dateText}
            </Text>
          );
        })
      ) : (
        <Text style={styles.memberDetail}>💰 No contributions yet</Text>
      )} */}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.button} onPress={() => handleCall(item.phoneNumber)}>
          <Text style={styles.buttonText}>📲 Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleEmail(item.email)}>
          <Text style={styles.buttonText}>✉️ Email</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: item.status === 'Active' ? '#a90707ff' : '#1976D2' },
          ]}
          onPress={() => handleToggleStatus(item)}
        >
          <Text style={styles.buttonText}>
            {item.status === 'Active' ? '⚙️ Deactivate' : '✅ Activate'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>Group Members</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <View style={styles.filterRow}>
          {(['All', 'Active', 'Inactive', 'Terminated'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, statusFilter === status && styles.activeFilterButton]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={[styles.filterText, statusFilter === status && styles.activeFilterText]}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1565C0" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.id}
            renderItem={renderMember}
            ListEmptyComponent={<Text style={styles.noResults}>No matching members found.</Text>}
          />
        )}
      </View>

      <GroupAdminBottomNav current="group-members" />
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
    paddingVertical: 10,
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1565C0', marginBottom: 10 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 10,
  },
  filterRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#CFD8DC',
  },
  activeFilterButton: { backgroundColor: '#1976D2' },
  filterText: { fontSize: 13, color: '#555' },
  activeFilterText: { color: '#fff', fontWeight: '600' },
  memberCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    elevation: 3,
  },
  memberName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  memberDetail: { fontSize: 14, color: '#555', marginTop: 4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  noResults: { textAlign: 'center', fontSize: 16, color: '#999', marginTop: 20 },
});

export default GroupMembersScreen;

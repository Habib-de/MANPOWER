// app/(superadmin)/manage-group-admins.tsx
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
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const API_BASE_URL = 'http://192.168.0.101:8080/api';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  joinDate?: string;
  status: 'Active' | 'Inactive' | 'Terminated';
  role: string;
  createdBy?: string;
  modifiedBy?: string;
  createdOn?: string;
  modifiedOn?: string;
  mansoftTenantId?: string;
}

function SuperAdminManageGroupAdminsScreen() {
  const router = useRouter();
  const [groupAdmins, setGroupAdmins] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Terminated'>('All');
  const [loading, setLoading] = useState(true);

  const fetchGroupAdmins = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/members`);
      if (!response.ok) {
        throw new Error(`Failed to fetch members: ${response.status}`);
      }
      const allMembers: Member[] = await response.json();
      const filteredAdmins = allMembers.filter(member => member.role === 'GroupAdmin');
      setGroupAdmins(filteredAdmins);
    } catch (err: any) {
      console.error('Error fetching Group Admins:', err);
      Alert.alert('Error', `Failed to load Group Admins: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupAdmins();
  }, []);

  const filteredGroupAdmins = groupAdmins.filter((admin) => {
    const matchesSearch =
      admin.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      admin.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' || admin.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(err => console.error("Failed to open dialer:", err));
    } else {
      Alert.alert("No Phone Number", "This group admin does not have a phone number listed.");
    }
  };

  const handleEmail = (email: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`).catch(err => console.error("Failed to open email client:", err));
    } else {
      Alert.alert("No Email", "This group admin does not have an email listed.");
    }
  };

  // MODIFIED: Removed Alert.alert wrapper temporarily
  const handleToggleStatus = async (admin: Member) => {
    const newStatus = admin.status === 'Active' ? 'Inactive' : 'Active';

    console.log('Attempting to update admin with ID:', admin.id); // Debug log
    const payload = {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phoneNumber: admin.phoneNumber || '',
      password: admin.password || 'defaultPassword123!',
      joinDate: admin.joinDate || new Date().toISOString().split('T')[0],
      status: newStatus,
      role: admin.role,
      createdBy: admin.createdBy || admin.email || 'system',
      modifiedBy: (await AsyncStorage.getItem('userEmail')) || 'SuperAdmin',
      createdOn: admin.createdOn || new Date().toISOString(),
      modifiedOn: new Date().toISOString(),
      mansoftTenantId: admin.mansoftTenantId || 'tenant-001'
    };

    console.log('Payload:', payload); // Debug log
    console.log('Target URL:', `${API_BASE_URL}/members/${admin.id}`); // Debug log

    try {
      const response = await fetch(`${API_BASE_URL}/members/${admin.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('Fetch response status:', response.status); // Debug log

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      // Update local state
      setGroupAdmins(prev =>
        prev.map(m => m.id === admin.id ? {...m, status: newStatus} : m)
      );

      Alert.alert('Success', `Status updated to ${newStatus}`);

    } catch (err: any) {
      console.error('Update error:', err); // CRITICAL: Check this output in console
      Alert.alert('Error', err.message || 'Failed to update status');
    }
  };

  const renderGroupAdmin = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      <Text style={styles.memberName}>{item.firstName} {item.lastName}</Text>
      <Text style={styles.memberDetail}>📧 {item.email}</Text>
      {item.phoneNumber && <Text style={styles.memberDetail}>📞 {item.phoneNumber}</Text>}
      <Text style={styles.memberDetail}>🟢 Status: {item.status}</Text>
      <Text style={styles.memberDetail}>🧑 Role: {item.role}</Text>
      {item.joinDate && <Text style={styles.memberDetail}>🗓️ Joined: {new Date(item.joinDate).toDateString()}</Text>}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.button} onPress={() => handleCall(item.phoneNumber)}>
          <Text style={styles.buttonText}>📲 Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => handleEmail(item.email)}>
          <Text style={styles.buttonText}>✉️ Email</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        {(item.status === 'Inactive' || item.status === 'Active') && (
          <TouchableOpacity
            style={[
              styles.button,
              item.status === 'Active' ? styles.deactivateButton : styles.activateButton,
            ]}
            onPress={() => handleToggleStatus(item)} // This will now directly call handleToggleStatus
          >
            <Text style={styles.buttonText}>
              {item.status === 'Active' ? '⚙️ Deactivate' : '✅ Activate'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#D32F2F' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(superadmin)/dashboard')}>
          <Text style={styles.backToHome}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>Manage Group Admins</Text>

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
          <ActivityIndicator size="large" color="#D32F2F" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredGroupAdmins}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupAdmin}
            ListEmptyComponent={<Text style={styles.noResults}>No matching Group Admins found.</Text>}
          />
        )}
      </View>

      <SuperAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF3E0' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFCC80',
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
  },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#D32F2F', fontWeight: 'bold', fontSize: 14 },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#D32F2F', marginBottom: 10 },
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFECB3',
  },
  activeFilterButton: { backgroundColor: '#D32F2F' },
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
    backgroundColor: '#FF9800',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  activateButton: { backgroundColor: '#4CAF50' },
  deactivateButton: { backgroundColor: '#F44336' },
  noResults: { textAlign: 'center', fontSize: 16, color: '#999', marginTop: 20 },
});

export default SuperAdminManageGroupAdminsScreen;
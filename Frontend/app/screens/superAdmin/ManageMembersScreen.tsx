import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: 'Member' | 'GroupAdmin';
  status: 'Active' | 'Inactive' | 'Terminated';
  groupId?: string;
};

type Group = {
  id: string;
  name: string;
};

const filters = ['All', 'Active', 'Inactive', 'Terminated', 'GroupAdmin', 'Member'];

export default function ManageMembersScreen(): React.JSX.Element {
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      const response = await fetch(`${BASE_URL}/members`);
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error('Fetch members failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${BASE_URL}/groups`);
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Fetch groups failed:', error);
    }
  };

  const handleDelete = async (id: string, fullName: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/members/${id}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                setMembers((prev) => prev.filter((m) => m.id !== id));
                Alert.alert('Deleted', `${fullName} has been removed.`);
              } else {
                Alert.alert('Error', 'Failed to delete the member.');
              }
            } catch (error) {
              console.error('Delete failed:', error);
              Alert.alert('Error', 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  const filteredMembers = members.filter((m) => {
    const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase());
    const matchesFilter =
      filter === 'All' || m.status === filter || m.role === filter;
    const matchesGroup =
      filter !== 'Member' || selectedGroupId === null || m.groupId === selectedGroupId;

    return matchesSearch && matchesFilter && matchesGroup;
  });

  useEffect(() => {
    fetchMembers();
    fetchGroups();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Manage Members</Text>

        <TextInput
          placeholder="Search by name..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, filter === f && styles.filterButtonActive]}
              onPress={() => {
                setFilter(f);
                setSelectedGroupId(null);
              }}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filter === 'Member' && (
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>Filter by Group:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.groupBtn, selectedGroupId === null && styles.groupBtnActive]}
                onPress={() => setSelectedGroupId(null)}
              >
                <Text style={styles.groupText}>All Groups</Text>
              </TouchableOpacity>

              {groups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupBtn,
                    selectedGroupId === group.id && styles.groupBtnActive,
                  ]}
                  onPress={() => setSelectedGroupId(group.id)}
                >
                  <Text style={styles.groupText}>{group.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" />
        ) : filteredMembers.length === 0 ? (
          <Text style={styles.noResults}>No matching members found.</Text>
        ) : (
          filteredMembers.map((m) => (
            <View key={m.id} style={styles.card}>
              <Text style={styles.name}>{m.firstName} {m.lastName}</Text>
              <Text>✉️: {m.email}</Text>
              <Text>📞: {m.phoneNumber}</Text>
              <Text>🧑Role: {m.role}</Text>
              <Text>🟢Status: {m.status}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push({ pathname: '/(superadmin)/edit-member', params: { id: m.id } })}
                >
                  <Text style={styles.btnText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(m.id, `${m.firstName} ${m.lastName}`)}
                >
                  <Text style={styles.btnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <SuperAdminBottomNav current="members" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E9' },
  container: {
    padding: 16,
    paddingBottom: 100,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#66BB6A',
  },
  filterText: {
    color: '#555',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  dropdownContainer: {
    marginBottom: 15,
  },
  dropdownLabel: {
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },
  groupBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#BDBDBD',
  },
  groupBtnActive: {
    backgroundColor: '#43A047',
  },
  groupText: {
    color: '#fff',
    fontWeight: '600',
  },
  noResults: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  editBtn: {
    backgroundColor: '#1976D2',
    padding: 8,
    borderRadius: 6,
  },
  deleteBtn: {
    backgroundColor: '#D32F2F',
    padding: 8,
    borderRadius: 6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

const BASE_URL = 'http://192.168.0.101:8080/api';

export default function EditMemberScreen() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchMember(id);
  }, [id]);

  const fetchMember = async (memberId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/members/${memberId}`);
      const data = await res.json();
      setMember(data);
    } catch (err) {
      console.error('Failed to load member:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!member) return;

    const payload = {
      ...member,
      groupId: member.group?.id || '',
      groupName: member.group?.groupName || '',
    };

    try {
      const res = await fetch(`${BASE_URL}/members/${member.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to update member');

      Alert.alert('Success', 'Member updated successfully');
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update member');
    }
  };

  if (loading || !member) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading member data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Edit Member</Text>

      <TextInput
        style={styles.input}
        value={member.firstName}
        placeholder="First Name"
        onChangeText={(text) => setMember({ ...member, firstName: text })}
      />

      <TextInput
        style={styles.input}
        value={member.lastName}
        placeholder="Last Name"
        onChangeText={(text) => setMember({ ...member, lastName: text })}
      />

      <TextInput
        style={styles.input}
        value={member.email}
        placeholder="Email"
        onChangeText={(text) => setMember({ ...member, email: text })}
      />

      <TextInput
        style={styles.input}
        value={member.phoneNumber}
        placeholder="Phone Number"
        onChangeText={(text) => setMember({ ...member, phoneNumber: text })}
      />

      <TextInput
        style={styles.input}
        value={member.password}
        placeholder="Password"
        secureTextEntry
        onChangeText={(text) => setMember({ ...member, password: text })}
      />

      <Button title="Update Member" onPress={handleUpdate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

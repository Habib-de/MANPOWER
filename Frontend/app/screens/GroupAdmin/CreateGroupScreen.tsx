import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// IMPORTANT: Replace with your actual backend IP or hostname if different
const API_BASE_URL = 'http://192.168.0.101:8080/api';

function CreateGroupScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const [adminId, setAdminId] = useState('');
  // We still fetch adminMemberData for display purposes (e.g., in description)
  // but we won't send the full object back to the server for 'members'
  const [adminMemberData, setAdminMemberData] = useState<any>(null);

  useEffect(() => {
    const loadUserAndFetchDetails = async () => {
      const id = await AsyncStorage.getItem('userId');

      if (!id) {
        Alert.alert('Error', 'Could not load user ID. Please log in again.');
        navigation.goBack();
        return;
      }

      setAdminId(id);

      try {
        const response = await fetch(`${API_BASE_URL}/members/${id}`);
        if (!response.ok) throw new Error('Failed to fetch member details');
        const data = await response.json();
        setAdminMemberData(data);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        Alert.alert('Error', 'Could not fetch admin data');
      }
    };

    loadUserAndFetchDetails();
  }, []);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Validation', 'Group name is required.');
      return;
    }

    if (!adminMemberData) {
      Alert.alert('Error', 'Admin data not loaded.');
      return;
    }

    setLoading(true);

    try {
      const now = new Date().toISOString(); // e.g., "2025-07-21T16:02:01.000Z"

      const payload = {
        groupName,
        description: description || `Group created by ${adminMemberData.firstName}`,
        // Use adminId for createdBy/modifiedBy as before
        createdBy: adminId,
        modifiedBy: adminId,
        // The backend might parse these to just date or keep full timestamp,
        // but ISO string is generally a safe format.
        creationDate: now,
        createdOn: now,
        modifiedOn: now,
        status: 'Active',
        mansoftTenantId: adminMemberData.mansoftTenantId,
        // --- START OF CRITICAL CHANGE ---
        // Instead of sending the full 'members' object, send 'memberIds' array
        // containing only the ID(s) of the existing member(s).
        memberIds: [adminId],
        // --- END OF CRITICAL CHANGE ---
      };

      console.log('Sending payload:', JSON.stringify(payload, null, 2)); // Log payload for debugging

      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': '*/*' // It's good practice to include this header as well
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try to parse error message from backend if available
        const errorResponse = await response.json();
        const errorMessage = errorResponse.message || errorResponse.error || 'Failed to create group';
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('Group created successfully:', responseData);
      Alert.alert('Success', 'Group created successfully.');
      setGroupName('');
      setDescription('');
      navigation.goBack(); // Or navigate to a different screen, e.g., group list
    } catch (err: any) {
      console.error('Group creation failed:', err);
      Alert.alert('Error', err.message || 'Something went wrong while creating the group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Create New Group</Text>

        <TextInput
          style={styles.input}
          placeholder="Group Name"
          value={groupName}
          onChangeText={setGroupName}
        />

        <TextInput
          style={[styles.input, { height: 100 }]}
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {/* Display admin's name for confirmation/context (optional) */}
        {adminMemberData && (
          <Text style={styles.adminInfo}>
            Group Admin: {adminMemberData.firstName} {adminMemberData.lastName}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (!groupName.trim() || loading || !adminMemberData) && { backgroundColor: '#ccc' },
          ]}
          onPress={handleCreateGroup}
          disabled={!groupName.trim() || loading || !adminMemberData}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 16,
  },
  adminInfo: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CreateGroupScreen;
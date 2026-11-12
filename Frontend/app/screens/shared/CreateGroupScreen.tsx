import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Button,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav'; // ✅ Your persistent bottom nav

function CreateGroupScreen(): React.JSX.Element {
  const router = useRouter();

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const fetchRoleAndUser = async () => {
      const storedRole = await AsyncStorage.getItem('userRole');
      const storedId = await AsyncStorage.getItem('userId');
      if (storedRole) setRole(storedRole);
      if (storedId) setUserId(storedId);
    };
    fetchRoleAndUser();
  }, []);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return;
    }

    if (role === 'GroupAdmin') {
      const hasCreatedGroup = false; // TODO: Replace with actual check
      if (hasCreatedGroup) {
        Alert.alert('Permission Denied', 'GroupAdmins can only create one group.');
        return;
      }
    }

    const newGroup = {
      id: `GRP${Date.now()}`,
      groupName,
      description,
      creationDate: new Date().toISOString().split('T')[0],
      created_by: userId,
      modified_by: userId,
      created_on: new Date().toISOString(),
      modified_on: new Date().toISOString(),
      mansoft_tenant_id: 'tenant-123456',
    };

    // TODO: Send newGroup to backend
    console.log('Group Created:', newGroup);

    Alert.alert('Success', 'Group created successfully!');
    setGroupName('');
    setDescription('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 🔝 Top Header with Logo, MANPOWER, Return */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.titleContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.returnText}>← Home</Text>
        </TouchableOpacity>
      </View>

      {/* 📝 Main Form Content */}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.formTitle}>Create New Group</Text>

        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter group name"
          value={groupName}
          onChangeText={setGroupName}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Enter description"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <View style={styles.buttonContainer}>
          <Button title="Create Group" onPress={handleCreateGroup} color="#1565C0" />
        </View>
      </ScrollView>

      {/* 🔻 Persistent Bottom Navigation */}
      <GroupAdminBottomNav current={'create-group'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#BBDEFB',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 35,
    height: 35,
    marginRight: 8,
    resizeMode: 'contain',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlack: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  titleGreen: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 2,
  },
  returnText: {
    color: '#1565C0',
    fontWeight: '600',
    fontSize: 14,
  },
  container: {
    padding: 20,
    paddingBottom: 80, // for bottom nav space
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  buttonContainer: {
    marginTop: 20,
  },
});

export default CreateGroupScreen;

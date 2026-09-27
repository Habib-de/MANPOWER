import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api'; // Ensure this is your correct backend URL

interface Group {
  id: string;
  groupName: string;
  mansoftTenantId?: string;
}

// Updated MemberPayload interface to include status, createdBy, and modifiedBy
interface MemberPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'Member' | 'GroupAdmin';
  groupId: string;
  mansoftTenantId?: string;
  status: string; // Added: 'Active' as per your format
  createdBy: string; // Added: Will be the current user's ID
  modifiedBy: string; // Added: Will be the current user's ID
}

export default function AddMemberScreen(): React.JSX.Element {
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState<MemberPayload>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    role: 'Member',
    groupId: '',
    status: 'Active', // Default status for new members
    createdBy: '', // Will be set from currentUserId
    modifiedBy: '', // Will be set from currentUserId
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserAndGroups = async () => {
      // Load user from AsyncStorage
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setCurrentUserId(user.id);
          // Set createdBy and modifiedBy in formData as soon as currentUserId is available
          setFormData(prev => ({
            ...prev,
            createdBy: user.id,
            modifiedBy: user.id,
          }));
        } catch (e) {
          console.error('Failed to parse user from AsyncStorage:', e);
          Alert.alert('Error', 'Could not load user data. Please log in again.');
        }
      } else {
        Alert.alert('Authentication Error', 'User not logged in. Please log in to add members.');
        // Optionally redirect to login
        // router.push('/login');
      }

      // Fetch groups
      fetch(`${BASE_URL}/groups`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data: Group[]) => {
          setGroups(data);
          if (data.length > 0) {
            setFormData(prev => ({
              ...prev,
              groupId: data[0].id // Set initial groupId to the first available group
            }));
          } else {
            Alert.alert('Info', 'No groups available. Please create a group first.');
          }
        })
        .catch((err) => {
          console.error('Group fetch error:', err);
          Alert.alert('Error', `Could not load groups from server: ${err.message}`);
        });
    };

    loadUserAndGroups();
  }, []); // Empty dependency array means this runs once on mount

  const handleInputChange = (field: keyof MemberPayload, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddMember = async () => {
    if (isSubmitting) return;

    // Validate required fields
    const { firstName, lastName, email, phoneNumber, password, groupId } = formData;
    if (!firstName.trim() || !lastName.trim() || !email.trim() ||
        !phoneNumber.trim() || !password.trim() || !groupId) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Current user not authenticated. Cannot add member.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedGroup = groups.find(g => g.id === formData.groupId);

      // Construct the payload with the added fields
      const payload: MemberPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password,
        role: formData.role,
        groupId: formData.groupId,
        mansoftTenantId: selectedGroup?.mansoftTenantId || 'default-tenant', // Ensure a default if not found
        status: formData.status, // Now included from formData state (default 'Active')
        createdBy: currentUserId, // Set to the logged-in user's ID
        modifiedBy: currentUserId, // Set to the logged-in user's ID
      };

      console.log('Submitting payload:', payload);

      const response = await fetch(`${BASE_URL}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Potentially add Authorization header if your API requires it
          // 'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'No error details from server' }));
        console.error('Server error response:', errorData);
        throw new Error(
          errorData.message ||
          errorData.errors?.join(', ') ||
          `Failed to add member with status: ${response.status}`
        );
      }

      const responseData = await response.json();
      console.log('Success response:', responseData);

      Alert.alert('Success', 'Member added successfully!');

      // Reset form fields
      setFormData(prev => ({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        password: '',
        role: 'Member',
        groupId: groups[0]?.id || '', // Reset to first group or empty if no groups
        status: 'Active',
        createdBy: currentUserId || '', // Keep current user ID or reset if user isn't logged in anymore
        modifiedBy: currentUserId || '', // Keep current user ID or reset if user isn't logged in anymore
      }));

    } catch (error: unknown) {
      let errorMessage = 'An unexpected error occurred while adding member.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      console.error('Add member error:', error);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
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
        <Text style={styles.title}>Add New Member</Text>
        <Text style={styles.subtitle}>Fill the form below to register a new member.</Text>

        <Text style={styles.label}>First Name*</Text>
        <TextInput
          style={styles.input}
          value={formData.firstName}
          onChangeText={(text) => handleInputChange('firstName', text)}
          placeholder="e.g., Asha"
        />

        <Text style={styles.label}>Last Name*</Text>
        <TextInput
          style={styles.input}
          value={formData.lastName}
          onChangeText={(text) => handleInputChange('lastName', text)}
          placeholder="e.g., Omar"
        />

        <Text style={styles.label}>Email*</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => handleInputChange('email', text)}
          placeholder="e.g., asha@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Phone Number*</Text>
        <TextInput
          style={styles.input}
          value={formData.phoneNumber}
          onChangeText={(text) => handleInputChange('phoneNumber', text)}
          placeholder="e.g., +254712345678"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Password*</Text>
        <TextInput
          style={styles.input}
          value={formData.password}
          onChangeText={(text) => handleInputChange('password', text)}
          placeholder="Enter password"
          secureTextEntry
        />

        <Text style={styles.label}>Role*</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={formData.role}
            onValueChange={(value) => handleInputChange('role', value)}
          >
            <Picker.Item label="Member" value="Member" />
            <Picker.Item label="Group Admin" value="GroupAdmin" />
          </Picker>
        </View>

        <Text style={styles.label}>Assign to Group*</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={formData.groupId}
            onValueChange={(value) => handleInputChange('groupId', value)}
            enabled={groups.length > 0} // Disable picker if no groups are loaded
          >
            {groups.length === 0 ? (
              <Picker.Item label="Loading groups..." value="" />
            ) : (
              groups.map((group) => (
                <Picker.Item key={group.id} label={group.groupName} value={group.id} />
              ))
            )}
          </Picker>
        </View>

        {/* You could add a Picker for Status if you want it selectable, otherwise it's hardcoded to 'Active' */}
        {/* <Text style={styles.label}>Status*</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={formData.status}
            onValueChange={(value) => handleInputChange('status', value)}
          >
            <Picker.Item label="Active" value="Active" />
            <Picker.Item label="Inactive" value="Inactive" />
            <Picker.Item label="Suspended" value="Suspended" />
          </Picker>
        </View> */}

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleAddMember}
          disabled={isSubmitting || !currentUserId || groups.length === 0} // Disable if not logged in or no groups
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Adding...' : 'Add Member'}
          </Text>
        </TouchableOpacity>
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
  logo: { width: 40, height: 40, marginRight: 8 },
  logoTextContainer: { flexDirection: 'row' },
  titleBlack: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  titleRed: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', marginLeft: 4 },
  returnHomeText: { fontSize: 14, fontWeight: '600', color: '#1565C0' },
  container: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 5, color: '#333' },
  input: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  button: {
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  buttonDisabled: {
    backgroundColor: '#81C784',
    opacity: 0.7,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
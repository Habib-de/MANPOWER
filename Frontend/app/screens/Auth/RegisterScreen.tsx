import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  // Alert, // COMMENT OUT THIS LINE
  View,
  Image,
  ScrollView,
  Platform, // ADD THIS
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import axios from 'axios';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

const API_BASE_URL = 'http://192.168.0.101:8080/api';

// ADD THIS HELPER FUNCTION at the top of the file (outside component)
const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    // For web, use browser's alert/confirm
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    // For native, use React Native's Alert
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
  }
};

function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const [role, setRole] = useState<'GroupAdmin' | 'Member'>('Member');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);

  useEffect(() => {
    if (role === 'Member') {
      axios
        .get(`${API_BASE_URL}/groups`)
        .then((res) => setAvailableGroups(res.data))
        .catch((err) => {
          console.error(err);
          showAlert('Error', 'Failed to fetch groups.');
        });
    }
  }, [role]);

  const getGroupAdminId = (groupId: string) => {
    const group = availableGroups.find((g) => g.id === groupId);
    return group?.createdBy || 'unknown';
  };

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !phoneNumber || !password) {
      showAlert('Error', 'Please fill all personal fields.');
      return;
    }

    try {
      let groupId = '';
      let groupAdminId = '';

      if (role === 'GroupAdmin') {
        if (!groupName) {
          showAlert('Error', 'Group name is required for Group Admin.');
          return;
        }

        // Step 1: Register Group Admin as a member
        const adminPayload = {
          firstName,
          lastName,
          email,
          phoneNumber,
          password,
          joinDate: new Date().toISOString().slice(0, 10),
          status: 'Inactive',
          role: 'GroupAdmin',
          createdBy: email,
          modifiedBy: email,
          createdOn: new Date().toISOString(),
          modifiedOn: new Date().toISOString(),
          mansoftTenantId: 'tenant-001',
          group: null,
        };

        const memberRes = await axios.post(`${API_BASE_URL}/members`, adminPayload);
        groupAdminId = memberRes.data.id;

        // Step 2: Create the group
        const groupPayload = {
          groupName: groupName,
          description: `Group created by: Name: ${firstName} ${lastName} Email: ${email}`,
          createdBy: groupAdminId,
          modifiedBy: groupAdminId,
          creationDate: new Date().toISOString(),
          createdOn: new Date().toISOString(),
          modifiedOn: new Date().toISOString(),
          status: 'Active',
          mansoftTenantId: 'tenant-001',
          members: [],
        };

        const groupRes = await axios.post(`${API_BASE_URL}/groups`, groupPayload);
        groupId = groupRes.data.id;

        showAlert('Success', 'Group and account created successfully.', () => {
          navigation.navigate('Login', { username: email, password });
        });
        return;
      }

      if (role === 'Member') {
        if (!selectedGroupId) {
          showAlert('Error', 'Please select a group.');
          return;
        }
        groupId = selectedGroupId;
        groupAdminId = getGroupAdminId(selectedGroupId);

        const memberPayload = {
          firstName,
          lastName,
          email,
          phoneNumber,
          password,
          joinDate: new Date().toISOString().slice(0, 10),
          status: 'Inactive',
          role: 'Member',
          createdBy: groupAdminId,
          modifiedBy: groupAdminId,
          createdOn: new Date().toISOString(),
          modifiedOn: new Date().toISOString(),
          mansoftTenantId: 'tenant-001',
          group: {
            id: groupId,
          },
        };

        await axios.post(`${API_BASE_URL}/members`, memberPayload);
        showAlert('Success', 'Registration successful.', () => {
          navigation.navigate('Login', { username: email, password });
        });
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // FIXED: Extract the actual error message from the backend
      let errorMessage = 'Registration failed.';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        console.log('Error response data:', error.response.data);
        console.log('Error response status:', error.response.status);
        
        // Check for duplicate email error (SQL error 1062)
        if (error.response.status === 500) {
          // Check if it's a duplicate email error
          if (error.response.data?.message?.includes('Duplicate entry') || 
              error.response.data?.message?.includes('UK_9d30a9u1qpg8eou0otgkwrp5d')) {
            errorMessage = 'This email is already registered. Please use a different email.';
          } else {
            errorMessage = error.response.data?.message || 'Server error. Please try again.';
          }
        } else if (error.response.status === 400) {
          errorMessage = error.response.data?.message || 'Invalid data. Please check your inputs.';
        } else if (error.response.status === 409) {
          errorMessage = 'Email already exists. Please use a different email.';
        } else {
          errorMessage = error.response.data?.message || `Error: ${error.response.status}`;
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Check your network connection.';
      } else {
        // Something happened in setting up the request
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      showAlert('Registration Error', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.card}>
        <Image
          source={require('../../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.titleRow}>
          <Text style={styles.titleBlack}>MAN</Text>
          <Text style={styles.titleGreen}>POWER</Text>
        </View>
        <Text style={styles.subText}>Create your account below</Text>

        <TextInput 
          style={styles.input} 
          placeholder="First Name" 
          value={firstName} 
          onChangeText={setFirstName} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Last Name" 
          value={lastName} 
          onChangeText={setLastName} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          value={email} 
          onChangeText={setEmail} 
          keyboardType="email-address" 
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder="Phone Number" 
          value={phoneNumber} 
          onChangeText={setPhoneNumber} 
          keyboardType="phone-pad" 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />

        <Picker 
          selectedValue={role} 
          onValueChange={(value) => setRole(value)} 
          style={styles.picker}
        >
          <Picker.Item label="Member" value="Member" />
          <Picker.Item label="Group Admin" value="GroupAdmin" />
        </Picker>

        {role === 'GroupAdmin' && (
          <TextInput 
            style={styles.input} 
            placeholder="New Group Name" 
            value={groupName} 
            onChangeText={setGroupName} 
          />
        )}

        {role === 'Member' && (
          <Picker 
            selectedValue={selectedGroupId} 
            onValueChange={(value) => setSelectedGroupId(value)} 
            style={styles.picker}
          >
            <Picker.Item label="Select a Group" value="" />
            {availableGroups.map((group) => (
              <Picker.Item key={group.id} label={group.groupName} value={group.id} />
            ))}
          </Picker>
        )}

        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by: <Text style={styles.mansoft}>MANSOFT</Text></Text>
          <Text style={styles.footerSub}>Infinite Possibilities</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles remain exactly the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  card: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  titleBlack: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  titleGreen: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 15,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  picker: {
    width: '100%',
    height: 50,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    marginTop: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#333',
  },
  mansoft: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  footerSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default RegisterScreen;
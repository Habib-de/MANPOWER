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
  ImageBackground,        // 👈 ADD THIS
  useWindowDimensions,
  Platform, // ADD THIS
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import axios from 'axios';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

const API_BASE_URL = 'http://192.168.0.102:8080/api';

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
  const [step, setStep] = useState(1);                          // 👈 ADD
  const [confirmPassword, setConfirmPassword] = useState('');   // 👈 ADD
  const [showPassword, setShowPassword] = useState(false);      // 👈 ADD
  const [groupName, setGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
    const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

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

    const handleNext = () => {                                    // 👈 ADD
    if (step === 1) {
      if (!firstName || !lastName || !email || !phoneNumber) {
        showAlert('Error', 'Please fill all personal fields.');
        return;
      }
      if (!/\S+@\S+\.\S+/.test(email)) {
        showAlert('Error', 'Please enter a valid email address.');
        return;
      }
      if (!/^(\+254|0)\d{9}$/.test(phoneNumber.replace(/\s|-/g, ''))) {
        showAlert('Error', 'Phone number must be a valid Kenyan format (+254XXXXXXXXX or 07XXXXXXXX).');
        return;
      }
    } else if (step === 2) {
      if (!password || !confirmPassword) {
        showAlert('Error', 'Please fill in your passwords.');
        return;
      }
      if (password.length < 8) {
        showAlert('Error', 'Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        showAlert('Error', 'Passwords do not match.');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);                   // 👈 ADD

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !phoneNumber || !password) {
      showAlert('Error', 'Please fill all personal fields.');
      return;
    }

    // ✅ NEW: password must be at least 8 characters
  if (password.length < 8) {
    showAlert('Error', 'Password must be at least 8 characters long.');
    return;
  }

  // ✅ NEW: phone must be a valid Kenyan number
  if (!/^(\+254|0)\d{9}$/.test(phoneNumber.replace(/\s|-/g, ''))) {
    showAlert('Error', 'Phone number must be a valid Kenyan format (+254XXXXXXXXX or 07XXXXXXXX).');
    return;
  }

  // ✅ NEW: basic email check
  if (!/\S+@\S+\.\S+/.test(email)) {
    showAlert('Error', 'Please enter a valid email address.');
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
    <ImageBackground 
      source={isDesktop ? require('../../../assets/images/m.jpg') : undefined}
      style={{ flex: 1, backgroundColor: '#F1F8E9' }} 
      resizeMode="stretch"
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollWrapper}>
          <View style={styles.card}>
            
                        {/* HEADER WITH BACK BUTTON */}
            <View style={styles.headerRow}>
                            <TouchableOpacity 
                style={styles.backArrow} 
                onPress={() => router.replace('/(auth)')}
              >
                <Ionicons name="chevron-back" size={24} color="#4CAF50" />
              </TouchableOpacity>
              
              <View style={{ flex: 1, alignItems: 'center' }}>
                 <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
                 <View style={styles.titleRow}>
                   <Text style={styles.titleBlack}>MAN</Text>
                   <Text style={styles.titleGreen}>POWER</Text>
                 </View>
              </View>

              {/* Empty view to balance the flex layout so the logo stays centered */}
              <View style={{ width: 24 }} /> 
            </View>
            <Text style={styles.subText}>Create your account below</Text>

            {/* STEP INDICATOR */}
            <View style={styles.stepIndicator}>
              {[1, 2, 3].map((s) => (
                <View key={s} style={styles.stepCircleRow}>
                  <View style={[styles.stepCircle, step >= s && styles.stepCircleActive]}>
                    <Text style={[styles.stepText, step >= s && styles.stepTextActive]}>{s}</Text>
                  </View>
                  {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
                </View>
              ))}
            </View>

            {/* STEP 1: PERSONAL INFO */}
            {step === 1 && (
              <>
                <TextInput style={styles.input} placeholder="First Name" value={firstName} onChangeText={setFirstName} />
                <TextInput style={styles.input} placeholder="Last Name" value={lastName} onChangeText={setLastName} />
                <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <TextInput style={styles.input} placeholder="Phone Number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
                <TouchableOpacity style={styles.button} onPress={handleNext}>
                  <Text style={styles.buttonText}>Next Step</Text>
                </TouchableOpacity>
              </>
            )}

            {/* STEP 2: SECURITY */}
            {step === 2 && (
              <>
                <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                <TextInput style={styles.input} placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
                <View style={styles.rowButtons}>
                  <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.buttonText}>Next Step</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* STEP 3: ROLE & GROUP */}
            {step === 3 && (
              <>
                <Picker selectedValue={role} onValueChange={(value) => setRole(value)} style={styles.picker}>
                  <Picker.Item label="Member" value="Member" />
                  <Picker.Item label="Group Admin" value="GroupAdmin" />
                </Picker>

                {role === 'GroupAdmin' && (
                  <TextInput style={styles.input} placeholder="New Group Name" value={groupName} onChangeText={setGroupName} />
                )}

                {role === 'Member' && (
                  <Picker selectedValue={selectedGroupId} onValueChange={(value) => setSelectedGroupId(value)} style={styles.picker}>
                    <Picker.Item label="Select a Group" value="" />
                    {availableGroups.map((group) => (
                      <Picker.Item key={group.id} label={group.groupName} value={group.id} />
                    ))}
                  </Picker>
                )}

                <View style={styles.rowButtons}>
                  <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextButton} onPress={handleRegister}>
                    <Text style={styles.buttonText}>Register</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Powered by: <Text style={styles.mansoft}>MANSOFT</Text></Text>
              <Text style={styles.footerSub}>Infinite Possibilities</Text>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

// Styles remain exactly the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollWrapper: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  card: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  logo: { width: 80, height: 80, marginBottom: 10 },
  titleRow: { flexDirection: 'row', marginBottom: 4 },
  titleBlack: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  titleGreen: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50' },
  subText: { fontSize: 13, color: '#666', marginBottom: 20, textAlign: 'center' },
  
  // Step Indicator Styles
  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepCircleRow: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  stepCircleActive: { backgroundColor: '#4CAF50' },
  stepText: { fontSize: 12, fontWeight: 'bold', color: '#888' },
  stepTextActive: { color: '#fff' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E0E0E0', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: '#4CAF50' },

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
  
  // Button Styles
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    marginTop: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  footer: { marginTop: 20, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#333' },
  mansoft: { fontWeight: 'bold', color: '#4CAF50' },
  footerSub: { fontSize: 12, color: '#666', marginTop: 2 },

    headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  backArrow: {
    padding: 8,
    backgroundColor: '#E8F5E9', // Light green background for the button
    borderRadius: 8,
  },
});

export default RegisterScreen;
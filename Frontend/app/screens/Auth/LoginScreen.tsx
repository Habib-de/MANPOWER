import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Modal,
  ActivityIndicator,
  // Alert, // COMMENT OUT this import
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const BASE_URL = 'http://192.168.0.101:8080/api';

interface LoginResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  mansoftTenantId: string;
  groupId?: string;
  phoneNumber?: string;
  joinDate?: string;
  createdBy?: string;
  modifiedBy?: string;
  createdOn?: string;
  modifiedOn?: string;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const showModal = (msg: string) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data: LoginResponse = await response.json();
        console.log('Login successful!', data);

        // --- FIXED: Check user status BEFORE storing data or navigating ---
        if (data.status === 'Inactive' || data.status === 'Terminated') {
          console.log('Inactive user detected, showing alert...');
          
          // Use the existing modal instead of Alert.alert
          showModal(
            'Your account is awaiting approval by the group administrator. Please contact your group admin for assistance.'
          );
          
          // Do NOT store any user data
          // Do NOT navigate
          setLoading(false);
          return; // Stop here
        }
        // --- End of fix ---

        // If status is NOT 'Inactive', proceed to store data and navigate
        await AsyncStorage.setItem('userToken', data.id);
        await AsyncStorage.setItem('userId', data.id);
        await AsyncStorage.setItem('userEmail', data.email);
        await AsyncStorage.setItem('userFirstName', data.firstName);
        await AsyncStorage.setItem('userLastName', data.lastName);
        await AsyncStorage.setItem('userRole', data.role);
        await AsyncStorage.setItem('userStatus', data.status);
        await AsyncStorage.setItem('userTenantId', data.mansoftTenantId);

        if (data.groupId) {
          await AsyncStorage.setItem('userGroupId', data.groupId);
        } else {
          await AsyncStorage.removeItem('userGroupId');
        }
        if (data.phoneNumber) {
          await AsyncStorage.setItem('userPhoneNumber', data.phoneNumber);
        } else {
          await AsyncStorage.removeItem('userPhoneNumber');
        }
        if (data.joinDate) {
          await AsyncStorage.setItem('userJoinDate', data.joinDate);
        } else {
          await AsyncStorage.removeItem('userJoinDate');
        }
        if (data.createdBy) {
          await AsyncStorage.setItem('userCreatedBy', data.createdBy);
        } else {
          await AsyncStorage.removeItem('userCreatedBy');
        }
        if (data.modifiedBy) {
          await AsyncStorage.setItem('userModifiedBy', data.modifiedBy);
        } else {
          await AsyncStorage.removeItem('userModifiedBy');
        }
        if (data.createdOn) {
          await AsyncStorage.setItem('userCreatedOn', data.createdOn);
        } else {
          await AsyncStorage.removeItem('userCreatedOn');
        }
        if (data.modifiedOn) {
          await AsyncStorage.setItem('userModifiedOn', data.modifiedOn);
        } else {
          await AsyncStorage.removeItem('userModifiedOn');
        }

        // Navigate based on role
        switch (data.role) {
          case 'SuperAdmin':
            router.replace('/(superadmin)/dashboard');
            break;
          case 'GroupAdmin':
            router.replace('/(groupadmin)/dashboard');
            break;
          case 'Member':
          default:
            router.replace('/(member)/dashboard');
        }
      } else {
        const errorText = await response.text();
        console.error('Login failed:', response.status, errorText);
        let errorMessage = 'Login failed. Please check your credentials and try again.';

        if (response.status === 404) {
          errorMessage = 'User not found. Please check your email.';
        } else if (response.status === 401) {
          errorMessage = 'Invalid email or password.';
        } else {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorMessage;
          } catch (e) {
            errorMessage = `Server error: ${response.status} - ${errorText || 'Unknown error'}`;
          }
        }
        showModal(errorMessage);
      }
    } catch (error) {
      console.error('Network error during login:', error);
      showModal('Could not connect to the server. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Image
          source={require('../../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>MANPOWER</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          onChangeText={setEmail}
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          onChangeText={setPassword}
          value={password}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={() => router.push('/forgotpassword')}>
            <Text style={styles.link}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.link}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Single modal for ALL messages */}
        <Modal 
          transparent 
          visible={modalVisible} 
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalText}>{modalMessage}</Text>
              <TouchableOpacity 
                onPress={() => {
                  console.log('Modal OK pressed');
                  setModalVisible(false);
                }} 
                style={styles.modalButton}
              >
                <Text style={{ color: 'white' }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by: <Text style={styles.footerBrand}>MANSOFT</Text>
        </Text>
        <Text style={styles.footerSub}>Infinite Possibilities</Text>
      </View>
    </SafeAreaView>
  );
}

// Styles remain exactly the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    elevation: 5,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#4CAF50',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  linksContainer: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 20,
  },
  link: {
    color: '#2196F3',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    width: '80%',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 6,
    width: '60%',
    alignItems: 'center',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#555',
  },
  footerBrand: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  footerSub: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
});
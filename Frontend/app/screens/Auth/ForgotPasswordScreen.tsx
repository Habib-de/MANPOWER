import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal, // Import Modal
  ActivityIndicator, // Import ActivityIndicator for loading state
} from 'react-native';
import { router } from 'expo-router'; // Import router for navigation

// Define your backend API base URL
const BASE_URL =  'http://192.168.0.101:8080/api'; // Ensure this matches your backend's IP

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); // Changed to 'email' as per backend expectation
  const [loading, setLoading] = useState(false); // New state for loading indicator
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  // Function to show the custom modal
  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const handleResetPassword = async () => {
    if (!email) {
      showModal('Input Required', 'Please enter your registered email address.');
      return;
    }

    setLoading(true); // Start loading
    try {
      const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }), // Send email as JSON
      });

      if (response.ok) {
        showModal('Password Reset', 'A new password has been sent to your email. Please check your inbox (and spam folder).');
        setEmail(''); // Clear the input field
      } else {
        const errorText = await response.text();
        console.error('Password reset failed:', response.status, errorText);
        let errorMessage = 'Failed to reset password. Please try again.';

        if (response.status === 404) {
          errorMessage = 'Email not found. Please check your email address.';
        } else if (response.status === 400) {
          errorMessage = `Invalid request: ${errorText}`;
        } else {
          errorMessage = `Server error: ${errorText || 'Unknown error'}`;
        }
        showModal('Reset Failed', errorMessage);
      }
    } catch (error) {
      console.error('Network error during password reset:', error);
      showModal('Network Error', 'Could not connect to the server. Please check your network connection.');
    } finally {
      setLoading(false); // Stop loading regardless of success or failure
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        Enter your registered email address. We’ll send you a new password.
      </Text>
      <TextInput
        placeholder="Email Address" // Changed placeholder to email
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address" // Hint for email keyboard
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" /> // Show loading indicator
        ) : (
          <Text style={styles.buttonText}>Send New Password</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(auth)')}>
        <Text style={styles.backButtonText}>Back to Login</Text>
      </TouchableOpacity>

      {/* Custom Modal for messages */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#E1F5FE',
    justifyContent: 'center',
    alignItems: 'center', // Center content horizontally
  },
  title: {
    fontSize: 28, // Increased font size
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#0277BD',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16, // Increased font size
    marginBottom: 30, // More space
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 10, // Add some horizontal padding
  },
  input: {
    borderWidth: 1,
    borderColor: '#90CAF9',
    padding: 15, // Increased padding
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: '#fff',
    width: '90%', // Make input wider
    maxWidth: 400, // Max width for larger screens
  },
  button: {
    backgroundColor: '#0288D1',
    padding: 16, // Increased padding
    borderRadius: 8,
    alignItems: 'center',
    width: '90%', // Make button wider
    maxWidth: 400, // Max width for larger screens
    marginBottom: 15, // Space below button
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700', // Bolder text
    fontSize: 18, // Larger text
  },
  backButton: {
    marginTop: 10,
    padding: 10,
  },
  backButtonText: {
    color: '#0277BD',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
    maxWidth: 350,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#0277BD',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalButton: {
    backgroundColor: '#0288D1',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

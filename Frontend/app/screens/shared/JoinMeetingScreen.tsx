import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Linking, // Add this import
} from 'react-native';
import { WebView } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';

export default function JoinMeetingScreen() {
  const params = useLocalSearchParams();
  
  const meetingLink = params.meetingLink as string;
  const meetingTitle = params.meetingTitle as string;
  const meetingType = params.meetingType as string;

  // Handle external meeting types (Zoom, Teams, Google Meet)
  const handleExternalMeeting = () => {
    if (meetingLink) {
      Linking.openURL(meetingLink).catch(() => {
        Alert.alert('Error', 'Could not open meeting link');
      });
    }
  };

  // For WebView meetings, show the embedded meeting
  if (meetingType === 'webview' && meetingLink) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Meeting: {meetingTitle}</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: meetingLink }}
          style={styles.webview}
          allowsFullscreenVideo={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
        />
      </SafeAreaView>
    );
  }

  // For external meetings, show a prompt
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Join Meeting</Text>
        <Text style={styles.subtitle}>{meetingTitle}</Text>
        <Text style={styles.meetingType}>
          {meetingType === 'zoom' && 'Zoom Meeting'}
          {meetingType === 'teams' && 'Microsoft Teams Meeting'}
          {meetingType === 'google_meet' && 'Google Meet'}
          {meetingType === 'in_person' && 'In-Person Meeting'}
        </Text>
        
        <TouchableOpacity 
          style={styles.joinButton}
          onPress={handleExternalMeeting}
        >
          <Text style={styles.joinButtonText}>
            {meetingType === 'in_person' ? 'View Details' : 'Join Meeting'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E8F5E9',
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  meetingType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  joinButton: {
    backgroundColor: '#1976D2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backButton: {
    padding: 15,
    alignItems: 'center',
    width: '100%',
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
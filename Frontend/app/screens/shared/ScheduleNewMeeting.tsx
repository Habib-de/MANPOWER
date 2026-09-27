import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Only import WebView on native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const BASE_URL = 'http://192.168.0.101:8080/api';

// ✅ Cross-platform alert function
const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
  }
};

interface Group {
  id: string;
  groupName: string;
}

interface User {
  email: string;
  role: string;
  groupId?: string;
  firstName: string;
  lastName: string;
}

interface MeetingFormData {
  title: string;
  agenda: string;
  meetingDate: string;
  meetingTime: string;
  targetAudience: string;
  meetingType: 'video' | 'in_person';
  groupId: string;
  duration: number;
}

interface Meeting {
  id: string;
  title: string;
  meetingLink?: string;
  meetingType: string;
  meetingDate: string;
  meetingTime: string;
}

export default function ScheduleNewMeetingScreen() {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState<MeetingFormData>({
    title: '',
    agenda: '',
    meetingDate: '',
    meetingTime: '',
    targetAudience: 'GroupMembers',
    meetingType: 'video',
    groupId: '',
    duration: 60,
  });

  const [showWebView, setShowWebView] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempTime, setTempTime] = useState('');

  useEffect(() => {
    loadUserDataAndGroups();
  }, []);

  const loadUserDataAndGroups = async () => {
    try {
      console.log('🔄 Loading user data...');
      
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userRole = await AsyncStorage.getItem('userRole');
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      const userFirstName = await AsyncStorage.getItem('userFirstName');
      const userLastName = await AsyncStorage.getItem('userLastName');

      console.log('📋 User data loaded:', { userEmail, userRole, userGroupId, userFirstName, userLastName });

      if (userEmail && userRole && userFirstName && userLastName) {
        const user: User = {
          email: userEmail,
          role: userRole,
          groupId: userGroupId || undefined,
          firstName: userFirstName,
          lastName: userLastName,
        };
        setCurrentUser(user);
        await loadGroups(user);
        
        if (user.role === 'GroupAdmin' && user.groupId) {
          console.log('✅ Auto-selecting group for GroupAdmin:', user.groupId);
          setFormData(prev => ({ ...prev, groupId: user.groupId! }));
        }
      } else {
        console.error('❌ User data missing in AsyncStorage');
        showAlert('Error', 'User data not found. Please login again.');
        router.replace('/login');
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      showAlert('Error', 'Failed to load user data');
    }
  };

  const loadGroups = async (user: User) => {
    try {
      console.log('🔄 Loading groups for user:', user.role);
      
      if (user.role === 'GroupAdmin' && user.groupId) {
        console.log('📡 Fetching GroupAdmin\'s group:', user.groupId);
        const response = await fetch(`${BASE_URL}/groups/${user.groupId}`);
        
        if (response.ok) {
          const groupData = await response.json();
          console.log('✅ Group data loaded:', groupData);
          setGroups([groupData]);
        } else {
          console.error('❌ Failed to fetch group:', response.status);
          showAlert('Error', 'Failed to fetch your group details.');
        }
      } else if (user.role === 'SuperAdmin') {
        console.log('📡 Fetching all groups for SuperAdmin');
        const response = await fetch(`${BASE_URL}/groups`);
        
        if (response.ok) {
          const groupsData = await response.json();
          console.log('✅ All groups loaded:', groupsData.length);
          setGroups(groupsData);
        } else {
          console.error('❌ Failed to fetch groups:', response.status);
          showAlert('Error', 'Failed to fetch groups.');
        }
      } else {
        console.warn('⚠️ Unknown role or missing groupId:', user.role);
      }
    } catch (error) {
      console.error('❌ Error loading groups:', error);
      showAlert('Error', 'Failed to load groups. Please check your connection.');
    }
  };

  const handleOpenDatePicker = () => {
    setTempDate(formData.meetingDate);
    setShowDateModal(true);
  };

  const handleOpenTimePicker = () => {
    setTempTime(formData.meetingTime);
    setShowTimeModal(true);
  };

  const handleDateConfirm = () => {
    setFormData(prev => ({ ...prev, meetingDate: tempDate }));
    setShowDateModal(false);
  };

  const handleTimeConfirm = () => {
    setFormData(prev => ({ ...prev, meetingTime: tempTime }));
    setShowTimeModal(false);
  };

  const handleDateCancel = () => {
    setShowDateModal(false);
  };

  const handleTimeCancel = () => {
    setShowTimeModal(false);
  };

  const formatTimeForBackend = (timeString: string): string => {
    if (timeString && timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':');
      return `${hours}:${minutes}:00`;
    }
    return '00:00:00';
  };

  // ✅ Generate Jitsi Meet link
  const generateMeetingLink = (title: string): string => {
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    const randomId = Math.random().toString(36).substring(2, 8);
    const meetingId = `${cleanTitle}-${randomId}`;
    
    return `https://meet.jit.si/${meetingId}`;
  };

  const validateForm = (): boolean => {
    console.log('🔍 Validating form...', formData);
    
    if (!formData.title.trim()) {
      showAlert('Error', 'Please enter a meeting title');
      return false;
    }
    if (!formData.meetingDate) {
      showAlert('Error', 'Please select a meeting date');
      return false;
    }
    if (!formData.meetingTime) {
      showAlert('Error', 'Please select a meeting time');
      return false;
    }
    if (!formData.groupId) {
      showAlert('Error', 'Please select a group');
      return false;
    }
    if (formData.duration < 15 || formData.duration > 480) {
      showAlert('Error', 'Duration must be between 15 minutes and 8 hours');
      return false;
    }

    const meetingDateTime = new Date(`${formData.meetingDate}T${formData.meetingTime}`);
    if (meetingDateTime <= new Date()) {
      showAlert('Error', 'Meeting must be scheduled for a future date and time');
      return false;
    }

    return true;
  };

  // ✅ Open meeting based on platform
  const openMeeting = (meetingLink: string, meetingTitle: string) => {
    if (Platform.OS === 'web') {
      window.open(meetingLink, '_blank');
    } else {
      setCurrentMeeting({
        id: currentMeeting?.id || '',
        title: meetingTitle,
        meetingLink: meetingLink,
        meetingType: formData.meetingType,
        meetingDate: formData.meetingDate,
        meetingTime: formData.meetingTime
      });
      setShowWebView(true);
    }
  };

  const handleCreateMeeting = async () => {
  console.log('🚀 Starting meeting creation...');
  
  if (!validateForm()) {
    return;
  }
  
  if (!currentUser) {
    showAlert('Error', 'User not found');
    return;
  }

  try {
    setLoading(true);

    // ✅ Generate meeting link only for video meetings
    const meetingLink = formData.meetingType === 'video' 
      ? generateMeetingLink(formData.title)
      : undefined;

    console.log('📝 Creating meeting with data:', {
      title: formData.title,
      groupId: formData.groupId,
      date: formData.meetingDate,
      time: formData.meetingTime,
      type: formData.meetingType,
      link: meetingLink
    });

    const meetingData = {
      group: {
        id: formData.groupId,
      },
      meetingDate: formData.meetingDate,
      meetingTime: formatTimeForBackend(formData.meetingTime),
      meetingLink: meetingLink,
      meetingType: formData.meetingType,
      title: formData.title,
      agenda: formData.agenda,
      calledByRole: currentUser.role,
      targetAudience: formData.targetAudience,
      duration: formData.duration,
      createdBy: currentUser.email,
      modifiedBy: currentUser.email,
      createdOn: new Date().toISOString(),
      modifiedOn: new Date().toISOString(),
      mansoftTenantId: "default-tenant"
    };

    console.log('📤 Sending to API:', JSON.stringify(meetingData, null, 2));

    const response = await fetch(`${BASE_URL}/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(meetingData),
    });

    console.log('📥 API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`Failed to create meeting: ${errorText}`);
    }

    const createdMeeting = await response.json();
    console.log('✅ Meeting created successfully:', createdMeeting);
    
    // ✅ Show success message and navigate to meetings screen
    const meetingTypeLabel = formData.meetingType === 'video' ? 'Video Meeting (Jitsi)' : 'In-Person Meeting';
    const linkMessage = meetingLink ? `\n🔗 Link: ${meetingLink}` : '';
    
    showAlert(
      '✅ Meeting Scheduled!', 
      `"${formData.title}" has been scheduled successfully.\n\n` +
      `📱 Type: ${meetingTypeLabel}${linkMessage}\n\n` +
      `You can view and join this meeting from the Meetings screen.`,
      () => {
        // ✅ Navigate back to the meetings screen
        router.back();
      }
    );

  } catch (error) {
    console.error('❌ Error creating meeting:', error);
    showAlert(
      'Error', 
      `Failed to create meeting: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    setLoading(false);
  }
};

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getAudienceOptions = () => {
    if (currentUser?.role === 'SuperAdmin') {
      return [
        { label: 'Group Admins', value: 'GroupAdmins' },
        { label: 'Group Members', value: 'GroupMembers' },
      ];
    } else if (currentUser?.role === 'GroupAdmin') {
      return [
        { label: 'Group Members', value: 'GroupMembers' },
      ];
    }
    return [
      { label: 'Group Members', value: 'GroupMembers' },
    ];
  };

  // ✅ Render WebView only on native platforms
  const renderWebViewMeeting = () => {
    if (Platform.OS === 'web') return null;
    
    const meetingLink = currentMeeting?.meetingLink;
    if (!meetingLink || !WebView) return null;

    return (
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>🎥 {currentMeeting.title}</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowWebView(false)}
            >
              <Text style={styles.closeButtonText}>✕ Leave</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: meetingLink }}
            style={styles.webview}
            allowsFullscreenVideo={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2E7D32" />
                <Text style={styles.loadingText}>Loading meeting...</Text>
                <Text style={styles.loadingSubtext}>Please wait while the meeting loads</Text>
              </View>
            )}
            renderError={() => (
              <View style={styles.errorContainer}>
                <Text style={styles.errorEmoji}>😕</Text>
                <Text style={styles.errorTitle}>Failed to load meeting</Text>
                <Text style={styles.errorMessage}>
                  Please check your internet connection and try again.
                </Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    setShowWebView(false);
                    Linking.openURL(meetingLink);
                  }}
                >
                  <Text style={styles.retryButtonText}>Open in Browser</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  const getSubtitle = () => {
    if (currentUser?.role === 'SuperAdmin') {
      return 'Create meetings for Group Admins or Group Members across all groups';
    } else if (currentUser?.role === 'GroupAdmin') {
      return 'Create meetings for your group members only';
    }
    return 'Create a new meeting';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        <Text style={styles.title}>Schedule New Meeting</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>

        {currentUser && (
          <View style={styles.roleBadgeContainer}>
            <Text style={styles.roleBadgeText}>👤 {currentUser.role}</Text>
            {currentUser.role === 'GroupAdmin' && (
              <Text style={styles.groupBadgeText}>
                📁 Group: {groups[0]?.groupName || 'Loading...'}
              </Text>
            )}
          </View>
        )}

        {/* Meeting Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Meeting Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter meeting title"
            value={formData.title}
            onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
          />
        </View>

        {/* Agenda */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Agenda</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Describe what this meeting is about..."
            value={formData.agenda}
            onChangeText={(text) => setFormData(prev => ({ ...prev, agenda: text }))}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Date and Time */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={handleOpenDatePicker}
            >
              <Text style={styles.dateTimeText}>
                {formData.meetingDate || 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Time *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={handleOpenTimePicker}
            >
              <Text style={styles.dateTimeText}>
                {formData.meetingTime || 'Select time'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration (minutes) *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="60"
            value={formData.duration.toString()}
            onChangeText={(text) => {
              const duration = parseInt(text) || 60;
              setFormData(prev => ({ ...prev, duration }));
            }}
            keyboardType="numeric"
          />
        </View>

        {/* Meeting Type - Simplified */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Meeting Type *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.meetingType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, meetingType: value }))}
              style={styles.picker}
            >
              <Picker.Item label="📱 Video Meeting (Jitsi Meet)" value="video" />
              <Picker.Item label="📍 In-Person Meeting" value="in_person" />
            </Picker>
          </View>
          {formData.meetingType === 'video' && (
            <Text style={styles.helperText}>
              {/* 💡 Video meetings use Jitsi Meet - secure */}
            </Text>
          )}
          {formData.meetingType === 'in_person' && (
            <Text style={styles.helperText}>
              📍 In-person meetings don't have a video link - members will attend physically.
            </Text>
          )}
          {Platform.OS === 'web' && formData.meetingType === 'video' && (
            <Text style={styles.helperText}>
              {/* 🌐 On web, meetings will open in a new browser tab. */}
            </Text>
          )}
        </View>

        {/* Target Audience */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Target Audience *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.targetAudience}
              onValueChange={(value) => setFormData(prev => ({ ...prev, targetAudience: value }))}
              style={styles.picker}
            >
              {getAudienceOptions().map((option) => (
                <Picker.Item 
                  key={option.value} 
                  label={option.label} 
                  value={option.value} 
                />
              ))}
            </Picker>
          </View>
          {currentUser?.role === 'GroupAdmin' && (
            <Text style={styles.helperText}>
              ✅ GroupAdmins can only create meetings for Group Members
            </Text>
          )}
        </View>

        {/* Group Selection - Only for SuperAdmin */}
        {(currentUser?.role === 'SuperAdmin' && groups.length > 0) && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Group *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.groupId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, groupId: value }))}
                style={styles.picker}
              >
                <Picker.Item label="Select a group" value="" />
                {groups.map((group) => (
                  <Picker.Item 
                    key={group.id} 
                    label={group.groupName} 
                    value={group.id} 
                  />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Show group info for GroupAdmin */}
        {currentUser?.role === 'GroupAdmin' && groups.length > 0 && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              📁 Group: {groups[0]?.groupName}
            </Text>
            <Text style={styles.infoSubtext}>
              Meetings will be created for this group
            </Text>
          </View>
        )}

        {/* Warning if no groups available for SuperAdmin */}
        {currentUser?.role === 'SuperAdmin' && groups.length === 0 && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>⚠️ No groups available. Please create groups first.</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.cancelButton, loading && styles.buttonDisabled]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreateMeeting}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>
                {formData.meetingType === 'video' ? 'Create the Meeting' : 'Schedule Meeting'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Custom Date Picker Modal */}
        <Modal
          visible={showDateModal}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <input
                type="date"
                value={tempDate}
                onChange={(e) => setTempDate(e.target.value)}
                min={getMinDate()}
                style={styles.modalInput}
              />
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancelButton} onPress={handleDateCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalConfirmButton} onPress={handleDateConfirm}>
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Custom Time Picker Modal */}
        <Modal
          visible={showTimeModal}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <input
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                style={styles.modalInput}
              />
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancelButton} onPress={handleTimeCancel}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalConfirmButton} onPress={handleTimeConfirm}>
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {/* WebView Meeting Modal - Only rendered on native */}
      {renderWebViewMeeting()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
  },
  logoNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  textLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlack: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  titleRed: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginLeft: 4,
  },
  backButton: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 30,
  },
  roleBadgeContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  groupBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2E7D32',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  dateTimeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#333',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 50,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoContainer: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  warningContainer: {
    backgroundColor: '#FFEAA7',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    color: '#E17055',
    textAlign: 'center',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    padding: 10,
    backgroundColor: '#2E7D32',
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: 'bold',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1,
  },
  webviewTitle: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  loadingSubtext: {
    marginTop: 4,
    color: '#999',
    fontSize: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
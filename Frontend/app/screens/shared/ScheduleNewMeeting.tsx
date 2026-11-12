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
  useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Only import WebView on native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const BASE_URL = 'http://192.168.0.102:8080/api';

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
    const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.formContainer, isDesktop && styles.formContainerDesktop]}>
          {/* Title Section */}
          <Text style={styles.title}>Schedule New Meeting</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          {/* Role + Group Badge */}
          {currentUser && (
            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>👤 {currentUser.role}</Text>
              </View>
              {currentUser.role === 'GroupAdmin' && groups[0] && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>📁 {groups[0].groupName}</Text>
                </View>
              )}
            </View>
          )}

          {/* Meeting Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Monthly SACCO Meeting"
              placeholderTextColor="#999"
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
            />
          </View>

          {/* Agenda */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Agenda <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="What is this meeting about?"
              placeholderTextColor="#999"
              value={formData.agenda}
              onChangeText={(text) => setFormData(prev => ({ ...prev, agenda: text }))}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Date + Time side-by-side (or stacked on small phone) */}
          <View style={isDesktop ? styles.row : undefined}>
            <View style={[styles.inputGroup, isDesktop && styles.halfWidth]}>
              <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={handleOpenDatePicker}
                activeOpacity={0.7}
              >
                <Text style={formData.meetingDate ? styles.dateTimeText : styles.dateTimePlaceholder}>
                  {formData.meetingDate || 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputGroup, isDesktop && styles.halfWidth]}>
              <Text style={styles.label}>Time <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={handleOpenTimePicker}
                activeOpacity={0.7}
              >
                <Text style={formData.meetingTime ? styles.dateTimeText : styles.dateTimePlaceholder}>
                  {formData.meetingTime || 'Select time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Duration - Quick chips */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration <Text style={styles.required}>*</Text></Text>
            <View style={styles.chipRow}>
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.chip,
                    formData.duration === mins && styles.chipActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, duration: mins }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      formData.duration === mins && styles.chipTextActive,
                    ]}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Meeting Type - Segmented */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meeting Type <Text style={styles.required}>*</Text></Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[styles.segment, formData.meetingType === 'video' && styles.segmentActive]}
                onPress={() => setFormData(prev => ({ ...prev, meetingType: 'video' }))}
              >
                <Text style={[styles.segmentText, formData.meetingType === 'video' && styles.segmentTextActive]}>
                  📱 Video
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, formData.meetingType === 'in_person' && styles.segmentActive]}
                onPress={() => setFormData(prev => ({ ...prev, meetingType: 'in_person' }))}
              >
                <Text style={[styles.segmentText, formData.meetingType === 'in_person' && styles.segmentTextActive]}>
                  📍 In-Person
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {formData.meetingType === 'video'
                ? '💡 A Jitsi video link will be generated automatically.'
                : '📍 Members will attend physically.'}
            </Text>
          </View>

          {/* Target Audience - Segmented */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Target Audience <Text style={styles.required}>*</Text></Text>
            <View style={styles.segmentedRow}>
              {getAudienceOptions().map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.segment, formData.targetAudience === option.value && styles.segmentActive]}
                  onPress={() => setFormData(prev => ({ ...prev, targetAudience: option.value }))}
                >
                  <Text style={[styles.segmentText, formData.targetAudience === option.value && styles.segmentTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Group Selection - SuperAdmin only */}
          {currentUser?.role === 'SuperAdmin' && groups.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Group <Text style={styles.required}>*</Text></Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.groupId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, groupId: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a group..." value="" />
                  {groups.map((group) => (
                    <Picker.Item key={group.id} label={group.groupName} value={group.id} />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          {/* Warning - no groups for SuperAdmin */}
          {currentUser?.role === 'SuperAdmin' && groups.length === 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>⚠️ No groups available. Please create a group first.</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
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
                  {formData.meetingType === 'video' ? 'Create Meeting' : 'Schedule Meeting'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Modal */}
        <Modal visible={showDateModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
                value={tempDate}
                onChangeText={setTempDate}
                autoFocus
              />
              <Text style={styles.modalHint}>Format: 2026-11-15</Text>
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

        {/* Time Modal */}
        <Modal visible={showTimeModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Time</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="HH:MM (24-hour)"
                placeholderTextColor="#999"
                value={tempTime}
                onChangeText={setTempTime}
                autoFocus
              />
              <Text style={styles.modalHint}>Format: 14:30</Text>
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

      {renderWebViewMeeting()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E9' },

  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
    elevation: 2,
  },
  logoNameWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 38, height: 38, resizeMode: 'contain' },
  textLogoContainer: { flexDirection: 'row', alignItems: 'center' },
  titleBlack: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  titleRed: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', marginLeft: 4 },
  backLink: { padding: 6 },
  backButton: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },

  // Scroll + form container (responsive width)
  scrollContent: { paddingVertical: 24, paddingHorizontal: 16 },
  formContainer: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  formContainerDesktop: { maxWidth: 640 },

  // Title
  title: { fontSize: 26, fontWeight: 'bold', color: '#1B5E20', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
  roleBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  roleBadgeText: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },

  // Inputs
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  required: { color: '#D32F2F' },
  optional: { color: '#999', fontWeight: '400', fontSize: 12 },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  // Date/time buttons
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  dateTimeButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: 'center',
  },
  dateTimeText: { fontSize: 15, color: '#333', fontWeight: '500' },
  dateTimePlaceholder: { fontSize: 15, color: '#999' },

  // Duration chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 54,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#FFFFFF' },

  // Segmented control
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 8 },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#888' },
  segmentTextActive: { color: '#2E7D32' },

  helperText: { fontSize: 11, color: '#888', marginTop: 8, fontStyle: 'italic' },

  // Picker
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: { height: 50, color: '#333' },

  // Warning
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
    marginBottom: 18,
  },
  warningText: { fontSize: 13, color: '#E65100', fontWeight: '500' },

  // Action buttons
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 24 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#666' },
  createButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  createButtonText: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' },
  buttonDisabled: { opacity: 0.6 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20', textAlign: 'center', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  modalHint: { fontSize: 11, color: '#888', marginTop: 6, marginBottom: 16, textAlign: 'center', fontStyle: 'italic' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#666' },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },

  // WebView
  webviewContainer: { flex: 1, backgroundColor: '#000' },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  webviewTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, flex: 1 },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  closeButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  webview: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 15 },
  loadingSubtext: { marginTop: 4, color: '#999', fontSize: 12 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  errorEmoji: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  errorMessage: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#2E7D32', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
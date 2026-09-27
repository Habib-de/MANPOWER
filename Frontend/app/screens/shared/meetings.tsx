import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://172.20.10.2:8080/api';

// ✅ Cross-platform alert function
const showAlert = (title: string, message: string, buttons?: any[]) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 0) {
      const result = window.confirm(`${title}\n${message}`);
      if (result && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      window.alert(`${title}\n${message}`);
    }
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, buttons || [{ text: 'OK' }]);
  }
};

type UserRole = 'SuperAdmin' | 'GroupAdmin' | 'Member';
type Meeting = {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string;
  meetingLink?: string;
  meetingType?: string;
  agenda?: string;
  targetAudience: string;
  calledByRole: string;
  group?: {
    id: string;
    groupName: string;
  };
  createdBy?: string;
  duration?: number;
};

function MeetingManagementScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    role: UserRole;
    groupId?: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  
  // ✅ State for in-app meeting
  const [showInAppMeeting, setShowInAppMeeting] = useState(false);
  const [currentMeetingLink, setCurrentMeetingLink] = useState<string>('');
  const [currentMeetingTitle, setCurrentMeetingTitle] = useState<string>('');

  // ✅ State for Edit Meeting
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    agenda: '',
    meetingDate: '',
    meetingTime: '',
    duration: 60,
    meetingType: 'webview',
    targetAudience: 'GroupMembers',
  });
  const [editingLoading, setEditingLoading] = useState(false);

  // ✅ State for Delete Confirmation Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteData, setDeleteData] = useState<{
    meeting: Meeting;
    meetingTitle: string;
    meetingId: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ✅ State for Join Meeting Modal
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinMeetingData, setJoinMeetingData] = useState<{
    meeting: Meeting;
    meetingLink: string;
    meetingTitle: string;
  } | null>(null);

  // Load user data
  const loadUserData = async () => {
    try {
      console.log('🔄 Loading user data...');
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userRole = await AsyncStorage.getItem('userRole') as UserRole;
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      const userFirstName = await AsyncStorage.getItem('userFirstName');
      const userLastName = await AsyncStorage.getItem('userLastName');

      console.log('📋 User data:', { userEmail, userRole, userGroupId });

      if (userEmail && userRole && userFirstName && userLastName) {
        const user = {
          email: userEmail,
          role: userRole,
          groupId: userGroupId || undefined,
          firstName: userFirstName,
          lastName: userLastName,
        };
        setCurrentUser(user);
        await loadMeetings(user);
      } else {
        await loadUserFromLegacyStorage();
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      showAlert('Error', 'Failed to load user data');
      setLoading(false);
    }
  };

  // Fallback to legacy storage
  const loadUserFromLegacyStorage = async () => {
    try {
      const adminData = await AsyncStorage.getItem('admin');
      if (adminData) {
        const admin = JSON.parse(adminData);
        setCurrentUser({
          email: admin.email || 'admin@example.com',
          role: 'SuperAdmin',
          firstName: admin.firstName || 'Admin',
          lastName: admin.lastName || 'User',
        });
        await loadMeetings({
          email: admin.email || 'admin@example.com',
          role: 'SuperAdmin',
          firstName: admin.firstName || 'Admin',
          lastName: admin.lastName || 'User',
        });
        return;
      }

      const groupAdminData = await AsyncStorage.getItem('groupAdmin');
      if (groupAdminData) {
        const groupAdmin = JSON.parse(groupAdminData);
        setCurrentUser({
          email: groupAdmin.email || 'groupadmin@example.com',
          role: 'GroupAdmin',
          groupId: groupAdmin.group?.id,
          firstName: groupAdmin.firstName || 'Group',
          lastName: groupAdmin.lastName || 'Admin',
        });
        await loadMeetings({
          email: groupAdmin.email || 'groupadmin@example.com',
          role: 'GroupAdmin',
          groupId: groupAdmin.group?.id,
          firstName: groupAdmin.firstName || 'Group',
          lastName: groupAdmin.lastName || 'Admin',
        });
        return;
      }

      const memberData = await AsyncStorage.getItem('loggedMember');
      if (memberData) {
        const member = JSON.parse(memberData);
        setCurrentUser({
          email: member.email || 'member@example.com',
          role: 'Member',
          groupId: member.group?.id,
          firstName: member.firstName || 'Member',
          lastName: member.lastName || 'User',
        });
        await loadMeetings({
          email: member.email || 'member@example.com',
          role: 'Member',
          groupId: member.group?.id,
          firstName: member.firstName || 'Member',
          lastName: member.lastName || 'User',
        });
        return;
      }

      showAlert('Error', 'User data not found. Please login again.');
      router.replace('/login');
    } catch (error) {
      console.error('❌ Error loading legacy user data:', error);
      showAlert('Error', 'Failed to load user data');
      setLoading(false);
    }
  };

  const loadMeetings = async (user: {
    email: string;
    role: UserRole;
    groupId?: string;
    firstName: string;
    lastName: string;
  }) => {
    try {
      setLoading(true);
      console.log('📡 Fetching meetings for:', user.email);
      
      const response = await fetch(`${BASE_URL}/meetings?userEmail=${encodeURIComponent(user.email)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to fetch meetings');
      }
      
      const data = await response.json();
      
      console.log('✅ All meetings from API:', data.length);
      console.log('👤 User context:', { 
        role: user.role, 
        groupId: user.groupId,
        email: user.email 
      });

      let filteredMeetings = data;
      
      if (user.role === 'GroupAdmin' && user.groupId) {
        filteredMeetings = data.filter((meeting: Meeting) => 
          meeting.group?.id === user.groupId
        );
        console.log('📋 Filtered for GroupAdmin:', filteredMeetings.length);
      } else if (user.role === 'Member' && user.groupId) {
        filteredMeetings = data.filter((meeting: Meeting) => 
          meeting.group?.id === user.groupId
        );
        console.log('📋 Filtered for Member:', filteredMeetings.length);
      }
      
      // ✅ Sort meetings by date (newest first)
      const sortedMeetings = filteredMeetings.sort((a: Meeting, b: Meeting) => {
        const dateA = new Date(`${a.meetingDate}T${a.meetingTime}`);
        const dateB = new Date(`${b.meetingDate}T${b.meetingTime}`);
        return dateB.getTime() - dateA.getTime(); // Newest first
      });
      
      setMeetings(sortedMeetings);
    } catch (error) {
      console.error('❌ Fetch error:', error);
      showAlert('Error', 'Could not load meetings.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Initial load when component mounts
  useEffect(() => {
    loadUserData();
  }, []);

  // ✅ REFRESH MEETINGS WHEN SCREEN GETS FOCUS (coming back from Schedule screen)
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Meeting screen focused - refreshing meetings...');
      if (currentUser) {
        loadMeetings(currentUser);
      } else {
        loadUserData();
      }
      return () => {
        console.log('📱 Meeting screen unfocused');
      };
    }, [currentUser])
  );

  const goToScheduleMeeting = () => {
    router.push('/screens/shared/ScheduleNewMeeting');
  };

  const getScreenTitle = () => {
    if (!currentUser) return 'Meetings';
    
    switch (currentUser.role) {
      case 'SuperAdmin': return 'All Meetings (System-Wide)';
      case 'GroupAdmin': return 'My Group Meetings';
      case 'Member': return 'My Meetings';
      default: return 'Meetings';
    }
  };

  const getSubtitle = () => {
    if (!currentUser) return 'View scheduled meetings';
    
    switch (currentUser.role) {
      case 'SuperAdmin': return 'View and manage all meetings across all groups';
      case 'GroupAdmin': return 'View and manage meetings for your group';
      case 'Member': return 'View your upcoming meetings';
      default: return 'View scheduled meetings';
    }
  };

  const canScheduleMeetings = () => {
    return currentUser && (currentUser.role === 'SuperAdmin' || currentUser.role === 'GroupAdmin');
  };

  // ✅ Handle external meetings - Opens in new window
  const openExternalMeeting = (url: string) => {
    console.log('🚀 Opening external meeting:', url);
    
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      validUrl = `https://${url}`;
    }

    if (Platform.OS === 'web') {
      try {
        const newWindow = window.open(validUrl, '_blank', 'noopener,noreferrer');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          console.warn('⚠️ Popup blocked, trying alternative method...');
          const anchor = document.createElement('a');
          anchor.href = validUrl;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
      } catch (error) {
        console.error('❌ Error opening window:', error);
        window.location.href = validUrl;
      }
    } else {
      Linking.canOpenURL(validUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(validUrl);
          } else {
            console.warn('⚠️ Cannot open URL:', validUrl);
            showAlert(
              'Cannot Open Link', 
              'Your device cannot open this meeting link. Please copy the link and open it manually.',
              [
                { 
                  text: 'Copy Link', 
                  onPress: () => copyLinkToClipboard(url) 
                },
                { text: 'OK' }
              ]
            );
          }
        })
        .catch((err) => {
          console.error('❌ Error opening link:', err);
          showAlert('Error', `Could not open meeting link: ${err.message}`);
        });
    }
  };

  // ✅ JOIN MEETING - Opens confirmation modal
  const handleJoinMeeting = (meeting: Meeting) => {
    console.log('🎯 Join meeting clicked:', { 
      title: meeting.title, 
      link: meeting.meetingLink,
      type: meeting.meetingType 
    });
    
    if (!meeting.meetingLink) {
      showAlert('No Meeting Link', 'This meeting does not have a join link yet.');
      return;
    }

    // For in-app meetings, open directly
    if (meeting.meetingType === 'webview') {
      setCurrentMeetingLink(meeting.meetingLink);
      setCurrentMeetingTitle(meeting.title);
      setShowInAppMeeting(true);
      return;
    }

    // For external meetings, show confirmation modal
    setJoinMeetingData({
      meeting: meeting,
      meetingLink: meeting.meetingLink,
      meetingTitle: meeting.title,
    });
    setJoinModalVisible(true);
  };

  // ✅ Perform the actual join
  const performJoin = () => {
    if (!joinMeetingData) return;
    
    const { meetingLink, meetingTitle } = joinMeetingData;
    
    console.log('🚀 Performing join for meeting:', { meetingLink, meetingTitle });
    console.log('⏰ Join requested at:', new Date().toISOString());
    
    setJoinModalVisible(false);
    openExternalMeeting(meetingLink);
    setJoinMeetingData(null);
  };

  // ✅ Copy link to clipboard
  const copyLinkToClipboard = (link: string) => {
    console.log('📋 Copying link to clipboard:', link);
    
    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link)
          .then(() => showAlert('Copied!', 'Meeting link copied to clipboard'))
          .catch(() => showAlert('Error', 'Failed to copy link'));
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showAlert('Copied!', 'Meeting link copied to clipboard');
      }
    } else {
      const Clipboard = require('react-native').Clipboard;
      Clipboard.setString(link);
      showAlert('Copied!', 'Meeting link copied to clipboard');
    }
  };

  const canUserManageMeeting = (meeting: Meeting): boolean => {
    if (!currentUser) return false;
    
    if (currentUser.role === 'SuperAdmin') return true;
    
    if (currentUser.role === 'GroupAdmin' && 
        currentUser.groupId && 
        meeting.group?.id === currentUser.groupId) {
      return true;
    }
    
    return false;
  };

  // ✅ DELETE MEETING - Opens confirmation modal
  const handleDeleteMeeting = (meeting: Meeting) => {
    console.log('🗑️ Delete meeting clicked:', { 
      id: meeting.id, 
      title: meeting.title,
      fullMeeting: meeting 
    });
    
    setDeleteData({
      meeting: meeting,
      meetingTitle: meeting.title,
      meetingId: meeting.id,
    });
    setDeleteModalVisible(true);
  };

  // ✅ Perform the actual delete with extensive debugging
  const performDelete = async () => {
    if (!deleteData) return;
    
    const { meeting, meetingId, meetingTitle } = deleteData;
    
    console.log('🚀 Starting delete process for meeting:', { meetingId, meetingTitle });
    console.log('📦 Full meeting data:', meeting);
    
    try {
      setDeleteLoading(true);
      setLoading(true);
      
      console.log('📡 DELETE URL:', `${BASE_URL}/meetings/${meetingId}`);
      console.log('📤 Request options:', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      console.log('⏰ Request sent at:', new Date().toISOString());
      
      const response = await fetch(`${BASE_URL}/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('📥 Delete response status:', response.status);
      console.log('📥 Delete response ok:', response.ok);
      
      // ✅ Get response body
      let responseBody = null;
      let responseText = '';
      try {
        responseText = await response.text();
        console.log('📥 Response body (raw):', responseText || '(empty)');
        if (responseText) {
          try {
            responseBody = JSON.parse(responseText);
            console.log('📥 Response body (parsed):', JSON.stringify(responseBody, null, 2));
          } catch (parseError) {
            console.log('📥 Response is not valid JSON, using raw text');
            responseBody = responseText;
          }
        }
      } catch (bodyError) {
        console.error('❌ Could not read response body:', bodyError);
      }

      // ✅ Handle success
      if (response.ok || response.status === 200 || response.status === 204) {
        console.log('✅ Delete successful on server');
        
        // ✅ Remove meeting from state
        setMeetings(prev => {
          const updated = prev.filter(m => m.id !== meetingId);
          console.log(`📋 Meetings before deletion: ${prev.length}`);
          console.log(`📋 Meetings after deletion: ${updated.length} remaining`);
          return updated;
        });
        
        setDeleteModalVisible(false);
        setDeleteData(null);
        
        const successMessage = responseBody?.message || `Meeting "${meetingTitle}" deleted successfully.`;
        console.log('✅ Success message:', successMessage);
        showAlert('Success', successMessage);
      } else {
        console.error('❌ Delete failed with status:', response.status);
        let errorMessage = `Failed to delete meeting (Status: ${response.status})`;
        if (responseBody) {
          if (typeof responseBody === 'object' && responseBody.message) {
            errorMessage = responseBody.message;
          } else if (typeof responseBody === 'string') {
            errorMessage = responseBody;
          }
        }
        showAlert('Error', errorMessage);
      }
    } catch (error) {
      console.error('❌ Exception in delete meeting:', error);
      showAlert(
        'Error', 
        `Failed to delete meeting: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setDeleteLoading(false);
      setLoading(false);
      console.log('🏁 Delete process completed at:', new Date().toISOString());
    }
  };

  // ✅ EDIT MEETING - Open Edit Modal
  const handleEditMeeting = (meeting: Meeting) => {
    console.log('✏️ Edit meeting clicked:', meeting.id, meeting.title);
    
    setEditingMeeting(meeting);
    setEditFormData({
      title: meeting.title || '',
      agenda: meeting.agenda || '',
      meetingDate: meeting.meetingDate || '',
      meetingTime: meeting.meetingTime || '',
      duration: meeting.duration || 60,
      meetingType: meeting.meetingType || 'webview',
      targetAudience: meeting.targetAudience || 'GroupMembers',
    });
    setShowEditModal(true);
  };

  // ✅ UPDATE MEETING
  const handleUpdateMeeting = async () => {
    if (!editingMeeting) return;
    
    if (!editFormData.title.trim()) {
      showAlert('Error', 'Please enter a meeting title');
      return;
    }
    if (!editFormData.meetingDate) {
      showAlert('Error', 'Please select a meeting date');
      return;
    }
    if (!editFormData.meetingTime) {
      showAlert('Error', 'Please select a meeting time');
      return;
    }

    try {
      setEditingLoading(true);
      console.log('📡 Updating meeting:', editingMeeting.id);
      
      const updatedMeeting = {
        ...editingMeeting,
        title: editFormData.title,
        agenda: editFormData.agenda,
        meetingDate: editFormData.meetingDate,
        meetingTime: editFormData.meetingTime,
        duration: editFormData.duration,
        meetingType: editFormData.meetingType,
        targetAudience: editFormData.targetAudience,
        modifiedBy: currentUser?.email || 'system',
        modifiedOn: new Date().toISOString(),
      };

      console.log('📤 Update data:', updatedMeeting);

      const response = await fetch(`${BASE_URL}/meetings/${editingMeeting.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedMeeting),
      });

      console.log('📥 Update response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Update error:', errorText);
        throw new Error(`Failed to update meeting: ${errorText}`);
      }

      const updatedData = await response.json();
      console.log('✅ Meeting updated successfully:', updatedData);

      setMeetings(prev => prev.map(m => 
        m.id === editingMeeting.id ? updatedData : m
      ));

      setShowEditModal(false);
      setEditingMeeting(null);
      showAlert('Success', `Meeting "${editFormData.title}" updated successfully.`);

    } catch (error) {
      console.error('❌ Error updating meeting:', error);
      showAlert('Error', `Failed to update meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEditingLoading(false);
    }
  };

  // ✅ Render delete confirmation modal
  const renderDeleteModal = () => {
    if (!deleteModalVisible || !deleteData) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => {
          setDeleteModalVisible(false);
          setDeleteData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning-outline" size={50} color="#F44336" />
              <Text style={styles.modalTitle}>Delete Meeting</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Are you sure you want to delete{' '}
                <Text style={styles.modalHighlight}>
                  "{deleteData.meetingTitle}"
                </Text>
                ?
              </Text>
              <Text style={styles.modalWarning}>
                ⚠️ This action cannot be undone.
              </Text>
              
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>🔍 Meeting Info:</Text>
                <Text style={styles.debugText}>Meeting ID: {deleteData.meetingId}</Text>
                <Text style={styles.debugText}>Title: {deleteData.meetingTitle}</Text>
                <Text style={styles.debugText}>User: {currentUser?.email}</Text>
                <Text style={styles.debugText}>Role: {currentUser?.role}</Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  console.log('❌ Delete cancelled by user');
                  setDeleteModalVisible(false);
                  setDeleteData(null);
                }}
                disabled={deleteLoading}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalDangerButton, deleteLoading && styles.buttonDisabled]}
                onPress={performDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.modalDangerButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ✅ Render join meeting modal
  const renderJoinModal = () => {
    if (!joinModalVisible || !joinMeetingData) return null;

    const { meetingLink, meetingTitle } = joinMeetingData;
    
    // Determine meeting platform
    let platformIcon = '🌐';
    let platformName = 'Meeting';
    if (meetingLink.includes('zoom')) {
      platformIcon = '🔵';
      platformName = 'Zoom';
    } else if (meetingLink.includes('teams') || meetingLink.includes('microsoft')) {
      platformIcon = '💙';
      platformName = 'Microsoft Teams';
    } else if (meetingLink.includes('meet.google')) {
      platformIcon = '💚';
      platformName = 'Google Meet';
    } else if (meetingLink.includes('jit.si')) {
      platformIcon = '📱';
      platformName = 'In-App Meeting';
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={joinModalVisible}
        onRequestClose={() => {
          setJoinModalVisible(false);
          setJoinMeetingData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="videocam-outline" size={50} color="#1976D2" />
              <Text style={styles.modalTitle}>Join Meeting</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                You are about to join{' '}
                <Text style={styles.modalHighlight}>
                  "{meetingTitle}"
                </Text>
              </Text>
              
              <View style={styles.meetingInfoContainer}>
                <View style={styles.meetingInfoRow}>
                  <Text style={styles.meetingInfoLabel}>Platform:</Text>
                  <Text style={styles.meetingInfoValue}>
                    {platformIcon} {platformName}
                  </Text>
                </View>
                <View style={styles.meetingInfoRow}>
                  <Text style={styles.meetingInfoLabel}>Link:</Text>
                  <Text style={styles.meetingInfoLink} numberOfLines={2}>
                    {meetingLink}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalInfo}>
                This will open the meeting in a new window/tab.
              </Text>
              
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>🔍 Meeting Info:</Text>
                <Text style={styles.debugText}>Meeting Title: {meetingTitle}</Text>
                <Text style={styles.debugText}>Platform: {platformName}</Text>
                <Text style={styles.debugText}>User: {currentUser?.email}</Text>
                <Text style={styles.debugText}>Role: {currentUser?.role}</Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  console.log('❌ Join cancelled by user');
                  setJoinModalVisible(false);
                  setJoinMeetingData(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalJoinButton]}
                onPress={performJoin}
              >
                <>
                  <Ionicons name="open-outline" size={20} color="#fff" />
                  <Text style={styles.modalJoinButtonText}>Join Now</Text>
                </>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ✅ Render edit modal
  const renderEditModal = () => {
    if (!showEditModal) return null;

    return (
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Meeting</Text>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Meeting Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter meeting title"
                  value={editFormData.title}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, title: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Agenda</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Describe what this meeting is about..."
                  value={editFormData.agenda}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, agenda: text }))}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  value={editFormData.meetingDate}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, meetingDate: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Time *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="HH:MM"
                  value={editFormData.meetingTime}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, meetingTime: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Duration (minutes)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="60"
                  value={editFormData.duration.toString()}
                  onChangeText={(text) => {
                    const duration = parseInt(text) || 60;
                    setEditFormData(prev => ({ ...prev, duration }));
                  }}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Meeting Type</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={editFormData.meetingType}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, meetingType: value }))}
                    style={styles.picker}
                  >
                    <Picker.Item label="📱 In-App Video Meeting" value="webview" />
                    <Picker.Item label="🔵 Zoom Meeting" value="zoom" />
                    <Picker.Item label="💙 Microsoft Teams" value="teams" />
                    <Picker.Item label="💚 Google Meet" value="google_meet" />
                    <Picker.Item label="📍 In-Person" value="in_person" />
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Target Audience</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={editFormData.targetAudience}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, targetAudience: value }))}
                    style={styles.picker}
                  >
                    <Picker.Item label="Group Admins" value="GroupAdmins" />
                    <Picker.Item label="Group Members" value="GroupMembers" />
                  </Picker>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalCancelButton, editingLoading && styles.buttonDisabled]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingMeeting(null);
                }}
                disabled={editingLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalConfirmButton, editingLoading && styles.buttonDisabled]}
                onPress={handleUpdateMeeting}
                disabled={editingLoading}
              >
                {editingLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Update Meeting</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ✅ Render in-app meeting modal
  const renderInAppMeeting = () => {
    if (!showInAppMeeting) return null;

    return (
      <Modal
        visible={showInAppMeeting}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>
              🎥 {currentMeetingTitle || 'Meeting'}
            </Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowInAppMeeting(false)}
            >
              <Text style={styles.closeButtonText}>✕ Leave</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: currentMeetingLink }}
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
            renderError={(error) => (
              <View style={styles.errorContainer}>
                <Text style={styles.errorEmoji}>😕</Text>
                <Text style={styles.errorTitle}>Failed to load meeting</Text>
                <Text style={styles.errorMessage}>
                  Please check your internet connection and try again.
                </Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => setShowInAppMeeting(false)}
                >
                  <Text style={styles.retryButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <View style={styles.headerRight}>
          <Text style={styles.userInfo}>
            {currentUser.firstName} {currentUser.lastName} ({currentUser.role})
          </Text>
          <TouchableOpacity onPress={() => {
            if (currentUser.role === 'SuperAdmin') {
              router.push('/(superadmin)/dashboard');
            } else if (currentUser.role === 'GroupAdmin') {
              router.push('/(groupadmin)/dashboard');
            } else {
              router.push('/(member)/dashboard');
            }
          }}>
            <Text style={styles.homeLink}>🏠 Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.roleBadge}>{currentUser.role}</Text>
          <Text style={styles.title}>{getScreenTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>
        </View>

        {canScheduleMeetings() && (
          <TouchableOpacity style={styles.scheduleButton} onPress={goToScheduleMeeting}>
            <Text style={styles.scheduleText}>➕ Schedule New Meeting</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionHeader}>
          {currentUser.role === 'SuperAdmin' ? '📋 All Meetings' : '📋 My Meetings'}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 20 }} />
        ) : meetings.length === 0 ? (
          <Text style={styles.noMeetingsText}>
            {currentUser.role === 'SuperAdmin' 
              ? 'No meetings scheduled yet.' 
              : 'No meetings scheduled for your group yet.'
            }
          </Text>
        ) : (
          meetings.map((meeting: Meeting) => (
            <View key={meeting.id} style={styles.card}>
              <Text style={styles.cardTitle}>{meeting.title}</Text>
              <Text style={styles.cardDetail}>📅 {meeting.meetingDate}</Text>
              <Text style={styles.cardDetail}>🕒 {meeting.meetingTime}</Text>

              {meeting.meetingType && (
                <View style={styles.typeBadgeContainer}>
                  <Text style={[
                    styles.typeBadge,
                    meeting.meetingType === 'webview' && styles.inAppBadge,
                    meeting.meetingType === 'zoom' && styles.zoomBadge,
                    meeting.meetingType === 'teams' && styles.teamsBadge,
                    meeting.meetingType === 'google_meet' && styles.googleBadge,
                  ]}>
                    {meeting.meetingType === 'webview' && '📱 In-App'}
                    {meeting.meetingType === 'zoom' && '🔵 Zoom'}
                    {meeting.meetingType === 'teams' && '💙 Teams'}
                    {meeting.meetingType === 'google_meet' && '💚 Google Meet'}
                    {meeting.meetingType === 'in_person' && '📍 In-Person'}
                  </Text>
                </View>
              )}

              {meeting.meetingLink && (
                <View style={styles.linkContainer}>
                  <Text style={styles.cardLink}>🔗 {meeting.meetingLink}</Text>
                  <TouchableOpacity 
                    style={styles.copyButton}
                    onPress={() => copyLinkToClipboard(meeting.meetingLink!)}
                  >
                    <Text style={styles.copyButtonText}>📋 Copy</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {meeting.agenda && (
                <Text style={styles.cardAgenda}>📝 {meeting.agenda}</Text>
              )}
              
              {meeting.group && (
                <Text style={styles.cardDetail}>👥 Group: {meeting.group.groupName}</Text>
              )}
              
              <Text style={styles.cardDetail}>🎯 {meeting.targetAudience}</Text>
              <Text style={styles.cardDetail}>👤 Called by: {meeting.calledByRole}</Text>

              {currentUser.groupId && meeting.group?.id === currentUser.groupId && (
                <Text style={styles.yourGroupBadge}>Your Group</Text>
              )}

              {meeting.meetingLink && (
                <TouchableOpacity 
                  style={[
                    styles.joinButton,
                    meeting.meetingType === 'webview' && styles.inAppJoinButton
                  ]}
                  onPress={() => handleJoinMeeting(meeting)}
                >
                  <Text style={styles.joinButtonText}>
                    {meeting.meetingType === 'webview' ? '📱 Join In-App Meeting' : '🎥 Join Meeting'}
                  </Text>
                </TouchableOpacity>
              )}

              {canUserManageMeeting(meeting) && (
                <View style={styles.managementActions}>
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => handleEditMeeting(meeting)}
                  >
                    <Text style={styles.editButtonText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDeleteMeeting(meeting)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* ✅ Modals */}
      {renderDeleteModal()}
      {renderJoinModal()}
      {renderEditModal()}
      {renderInAppMeeting()}
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
  headerRight: {
    alignItems: 'flex-end',
  },
  userInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  homeLink: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  container: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2E7D32',
    color: 'white',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
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
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 15,
    color: '#2E7D32',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cardAgenda: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 6,
    marginTop: 4,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
    marginTop: 4,
  },
  cardLink: {
    fontSize: 12,
    color: '#1976D2',
    flex: 1,
    fontStyle: 'italic',
  },
  copyButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  typeBadgeContainer: {
    marginVertical: 4,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#E0E0E0',
    color: '#333',
  },
  inAppBadge: {
    backgroundColor: '#4CAF50',
    color: '#fff',
  },
  zoomBadge: {
    backgroundColor: '#0B5CFF',
    color: '#fff',
  },
  teamsBadge: {
    backgroundColor: '#6264A7',
    color: '#fff',
  },
  googleBadge: {
    backgroundColor: '#1A73E8',
    color: '#fff',
  },
  scheduleButton: {
    backgroundColor: '#388E3C',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  scheduleText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  joinButton: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
    elevation: 1,
  },
  inAppJoinButton: {
    backgroundColor: '#4CAF50',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  noMeetingsText: {
    color: '#777',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
    fontStyle: 'italic',
  },
  yourGroupBadge: {
    fontSize: 10,
    color: '#2E7D32',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  managementActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  editButton: {
    backgroundColor: '#FFB74D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#E57373',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalHighlight: {
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  modalWarning: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  modalInfo: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 12,
  },
  modalDangerButton: {
    backgroundColor: '#F44336',
  },
  modalDangerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  modalJoinButton: {
    backgroundColor: '#1976D2',
  },
  modalJoinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  meetingInfoContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  meetingInfoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  meetingInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    width: 70,
  },
  meetingInfoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  meetingInfoLink: {
    fontSize: 12,
    color: '#1976D2',
    flex: 1,
  },
  debugContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 11,
    color: '#888',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalScrollView: {
    maxHeight: '70%',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalConfirmButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalCancelText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default MeetingManagementScreen;
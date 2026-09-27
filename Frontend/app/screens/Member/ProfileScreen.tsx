import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
  Dimensions,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import MemberBottomNav from '@/app/components/MemberBottomNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_URL = 'http://192.168.0.101:8080/api';

interface LoggedInMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
  mansoftTenantId: string;
  joinDate: string;
  created_by: string;
  modified_by: string;
  created_on: string;
  modified_on: string;
  group_id: string | null;
}

interface Group {
  id: string;
  groupName: string;
  description: string;
  status: string;
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [profile, setProfile] = useState<LoggedInMember | null>(null);
  const [editedProfile, setEditedProfile] = useState<LoggedInMember | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        router.replace('/(auth)');
        return;
      }

      const res = await fetch(`${BASE_URL}/members/${userId}`);
      const data = await res.json();

      const fetchedProfile: LoggedInMember = {
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        role: data.role,
        status: data.status,
        mansoftTenantId: data.mansoftTenantId,
        joinDate: data.joinDate ?? 'N/A',
        created_by: data.createdBy ?? 'N/A',
        modified_by: data.modifiedBy ?? 'N/A',
        created_on: data.createdOn ?? new Date().toISOString(),
        modified_on: data.modifiedOn ?? new Date().toISOString(),
        group_id: data.groupId ?? null,
      };

      setProfile(fetchedProfile);
      setEditedProfile(fetchedProfile);

      // Fetch group details if groupId exists
      if (data.groupId) {
        try {
          const groupRes = await fetch(`${BASE_URL}/groups/${data.groupId}`);
          const groupData = await groupRes.json();
          setGroup(groupData);
        } catch (groupErr) {
          console.error('Failed to fetch group:', groupErr);
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handleEditToggle = () => {
    setEditing(true);
    if (profile) setEditedProfile(profile);
  };

  const handleCancel = () => {
    setEditing(false);
    if (profile) setEditedProfile(profile);
  };

  const handleSave = async () => {
    if (!editedProfile) return;

    setSaving(true);
    try {
      // Here you would typically make an API call to update the profile
      // For now, we'll simulate a successful update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProfile(editedProfile);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'userToken', 'userId', 'userEmail', 'userFirstName',
                'userLastName', 'userRole', 'userStatus', 'userTenantId',
                'userPhoneNumber', 'userGroupId', 'userJoinDate',
              ]);
              Alert.alert('Success', 'Account deleted successfully');
              router.replace('/(auth)');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    return status?.toLowerCase() === 'active' ? '#4CAF50' : '#F44336';
  };

  const getStatusIcon = (status: string) => {
    return status?.toLowerCase() === 'active' ? 'checkmark-circle' : 'close-circle';
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const renderProfileInfo = () => (
    <View style={styles.profileSection}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, isDarkMode && styles.darkProfileHeader]}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.firstName?.[0]}{profile?.lastName?.[0]}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(profile?.status || '') }]}>
            <Ionicons 
              name={getStatusIcon(profile?.status || '')} 
              size={16} 
              color="#FFF" 
            />
          </View>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, isDarkMode && styles.darkText]}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text style={[styles.profileRole, isDarkMode && styles.darkSubText]}>
            {profile?.role}
          </Text>
          <Text style={[styles.profileEmail, isDarkMode && styles.darkSubText]}>
            {profile?.email}
          </Text>
        </View>
      </View>

      {/* Personal Information */}
      <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person" size={20} color={isDarkMode ? "#81C784" : "#4CAF50"} />
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Personal Information
          </Text>
        </View>

        {[
          { label: 'First Name', value: profile?.firstName, editableKey: 'firstName' as keyof LoggedInMember, icon: 'person-outline' },
          { label: 'Last Name', value: profile?.lastName, editableKey: 'lastName' as keyof LoggedInMember, icon: 'person-outline' },
          { label: 'Email', value: profile?.email, editableKey: 'email' as keyof LoggedInMember, icon: 'mail-outline' },
          { label: 'Phone', value: profile?.phoneNumber, editableKey: 'phoneNumber' as keyof LoggedInMember, icon: 'call-outline' },
        ].map((item, index) => (
          <View key={index} style={styles.infoItem}>
            <View style={styles.infoLeft}>
              <Ionicons 
                name={item.icon as any} 
                size={18} 
                color={isDarkMode ? "#81C784" : "#4CAF50"} 
                style={styles.infoIcon}
              />
              <Text style={[styles.infoLabel, isDarkMode && styles.darkSubText]}>
                {item.label}
              </Text>
            </View>
            {editing && item.editableKey ? (
              <TextInput
                style={[styles.infoInput, isDarkMode && styles.darkInfoInput]}
                value={editedProfile?.[item.editableKey] || ''}
                onChangeText={(text) =>
                  setEditedProfile((prev) => prev ? ({ ...prev, [item.editableKey]: text }) : prev)
                }
                placeholder={`Enter ${item.label.toLowerCase()}`}
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
              />
            ) : (
              <Text style={[styles.infoValue, isDarkMode && styles.darkText]}>
                {item.value || 'Not provided'}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Group Information */}
      {group && (
        <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={isDarkMode ? "#81C784" : "#4CAF50"} />
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
              Group Information
            </Text>
          </View>

          <View style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <Ionicons name="business" size={24} color={isDarkMode ? "#81C784" : "#4CAF50"} />
              <Text style={[styles.groupName, isDarkMode && styles.darkText]}>
                {group.groupName}
              </Text>
              <View style={[styles.groupStatus, { backgroundColor: getStatusColor(group.status) }]}>
                <Text style={styles.groupStatusText}>{group.status}</Text>
              </View>
            </View>
            {group.description && (
              <Text style={[styles.groupDescription, isDarkMode && styles.darkSubText]}>
                {group.description}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* System Information */}
      <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information" size={20} color={isDarkMode ? "#81C784" : "#4CAF50"} />
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            System Information
          </Text>
        </View>

        {[
          { label: 'Member ID', value: profile?.id, icon: 'finger-print' },
          { label: 'Join Date', value: formatDate(profile?.joinDate || ''), icon: 'calendar' },
          { label: 'Status', value: profile?.status, icon: 'checkmark-circle', status: true },
          { label: 'Tenant ID', value: profile?.mansoftTenantId, icon: 'business' },
          { label: 'Created By', value: profile?.created_by, icon: 'person-add' },
          { label: 'Modified By', value: profile?.modified_by, icon: 'create' },
        ].map((item, index) => (
          <View key={index} style={styles.infoItem}>
            <View style={styles.infoLeft}>
              <Ionicons 
                name={item.icon as any} 
                size={18} 
                color={isDarkMode ? "#81C784" : "#4CAF50"} 
                style={styles.infoIcon}
              />
              <Text style={[styles.infoLabel, isDarkMode && styles.darkSubText]}>
                {item.label}
              </Text>
            </View>
            {item.status ? (
              <View style={[styles.statusContainer, { backgroundColor: getStatusColor(item.value || '') }]}>
                <Ionicons name={getStatusIcon(item.value || '')} size={14} color="#FFF" />
                <Text style={styles.statusText}>{item.value}</Text>
              </View>
            ) : (
              <Text style={[styles.infoValue, isDarkMode && styles.darkText]}>
                {item.value || 'N/A'}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const renderSettings = () => (
    <View style={styles.settingsSection}>
      {/* Appearance Settings */}
      <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="color-palette" size={20} color={isDarkMode ? "#81C784" : "#4CAF50"} />
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Appearance
          </Text>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="moon" size={20} color={isDarkMode ? "#81C784" : "#4CAF50"} />
            <View>
              <Text style={[styles.settingLabel, isDarkMode && styles.darkText]}>Dark Mode</Text>
              <Text style={[styles.settingDescription, isDarkMode && styles.darkSubText]}>
                Switch between light and dark theme
              </Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={setIsDarkMode}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={isDarkMode ? '#4CAF50' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Account Actions */}
      <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="settings" size={20} color={isDarkMode ? "#81C784" : "#4CAF50"} />
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Account Actions
          </Text>
        </View>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="lock-closed" size={20} color="#2196F3" />
          <Text style={[styles.actionText, isDarkMode && styles.darkText]}>Change Password</Text>
          <Ionicons name="chevron-forward" size={20} color={isDarkMode ? "#666" : "#999"} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="notifications" size={20} color="#FF9800" />
          <Text style={[styles.actionText, isDarkMode && styles.darkText]}>Notification Settings</Text>
          <Ionicons name="chevron-forward" size={20} color={isDarkMode ? "#666" : "#999"} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
          <Text style={[styles.actionText, isDarkMode && styles.darkText]}>Privacy & Security</Text>
          <Ionicons name="chevron-forward" size={20} color={isDarkMode ? "#666" : "#999"} />
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="warning" size={20} color="#F44336" />
          <Text style={[styles.sectionTitle, { color: '#F44336' }]}>
            Danger Zone
          </Text>
        </View>

        <TouchableOpacity style={styles.dangerButton} onPress={handleDelete}>
          <Ionicons name="trash" size={20} color="#F44336" />
          <Text style={styles.dangerText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
            Loading your profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#F44336" />
          <Text style={[styles.errorText, isDarkMode && styles.darkText]}>
            Error loading profile
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
      {/* Enhanced Header */}
      <View style={[styles.headerContainer, isDarkMode && styles.darkHeaderContainer]}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../../assets/images/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.appTitleContainer}>
            <Text style={[styles.titleBlack, isDarkMode && styles.darkTitleBlack]}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => router.replace('/(member)/dashboard')}
        >
          <Ionicons name="home" size={20} color={isDarkMode ? "#81C784" : "#4CAF50"} />
          <Text style={[styles.backToHome, isDarkMode && styles.darkBackToHome]}>Home</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, isDarkMode && styles.darkTabContainer]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'profile' && styles.activeTab,
            activeTab === 'profile' && isDarkMode && styles.darkActiveTab
          ]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons 
            name="person" 
            size={20} 
            color={activeTab === 'profile' ? '#4CAF50' : (isDarkMode ? '#B0B0B0' : '#666')} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'profile' && styles.activeTabText,
            isDarkMode && styles.darkTabText
          ]}>
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'settings' && styles.activeTab,
            activeTab === 'settings' && isDarkMode && styles.darkActiveTab
          ]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons 
            name="settings" 
            size={20} 
            color={activeTab === 'settings' ? '#4CAF50' : (isDarkMode ? '#B0B0B0' : '#666')} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'settings' && styles.activeTabText,
            isDarkMode && styles.darkTabText
          ]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDarkMode && styles.darkScrollContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor={isDarkMode ? '#81C784' : '#4CAF50'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'profile' ? renderProfileInfo() : renderSettings()}

        {/* Action Buttons for Profile Tab */}
        {activeTab === 'profile' && (
          <View style={styles.actionContainer}>
            {!editing ? (
              <TouchableOpacity 
                style={[styles.editButton, isDarkMode && styles.darkEditButton]}
                onPress={handleEditToggle}
              >
                <Ionicons name="create-outline" size={18} color="#FFF" />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity 
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.cancelButton, isDarkMode && styles.darkCancelButton]}
                  onPress={handleCancel}
                >
                  <Ionicons name="close" size={18} color="#F44336" />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F1F8E9' },
  darkSafeArea: { backgroundColor: '#121212' },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 16, 
    color: '#555' 
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#333',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#C8E6C9',
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
    elevation: 3,
  },
  darkHeaderContainer: {
    backgroundColor: '#1E1E1E',
    borderBottomColor: '#333',
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  logo: { 
    width: 40, 
    height: 40, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  appTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  titleBlack: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  darkTitleBlack: {
    color: '#FFFFFF'
  },
  titleGreen: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#4CAF50', 
    marginLeft: 4 
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backToHome: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  darkBackToHome: {
    color: '#81C784',
  },

  // Tab Navigation
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkTabContainer: {
    backgroundColor: '#1E1E1E',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#E8F5E8',
  },
  darkActiveTab: {
    backgroundColor: '#333',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  darkTabText: {
    color: '#B0B0B0',
  },
  activeTabText: {
    color: '#4CAF50',
  },

  scrollContent: { 
    flexGrow: 1, 
    padding: 16,
    paddingBottom: 100 
  },
  darkScrollContent: { 
    backgroundColor: '#121212' 
  },

  // Profile Section
  profileSection: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 16,
  },
  darkProfileHeader: {
    backgroundColor: '#1E1E1E',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },

  // Info Cards
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkInfoCard: {
    backgroundColor: '#1E1E1E',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },

  // Info Items
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  infoInput: {
    fontSize: 14,
    borderBottomWidth: 1,
    borderColor: '#4CAF50',
    paddingVertical: 4,
    color: '#333',
    textAlign: 'right',
    flex: 1,
  },
  darkInfoInput: {
    color: '#FFFFFF',
    borderColor: '#81C784',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Group Card
  groupCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  groupStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },

  // Settings Section
  settingsSection: {
    flex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  dangerText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: '600',
    marginLeft: 12,
  },

  // Action Container
  actionContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  darkEditButton: {
    backgroundColor: '#2E7D32',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    flex: 1,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    flex: 1,
    borderWidth: 1,
    borderColor: '#F44336',
    gap: 8,
  },
  darkCancelButton: {
    backgroundColor: '#1E1E1E',
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },

  // Utility
  darkText: {
    color: '#FFFFFF',
  },
  darkSubText: {
    color: '#B0B0B0',
  },
});
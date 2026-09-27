import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_URL = 'http://192.168.0.101:8080/api';

interface AdminProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  joinDate: string;
  status: string;
  role: string;
  created_by: string;
  modified_by: string;
  created_on: string;
  modified_on: string;
  mansoft_tenant_id: string;
}

interface Group {
  id: string;
  groupName: string;
  description: string;
  creationDate: string;
  status: string;
  members?: any[]; // Members should already be included in the group data
  memberCount?: number;
}

function GroupAdminProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDarkMode = false;

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [adminGroups, setAdminGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'groups'>('profile');

  useEffect(() => {
    fetchProfileAndGroups();
  }, []);

  const fetchProfileAndGroups = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      const firstName = await AsyncStorage.getItem('userFirstName');
      const lastName = await AsyncStorage.getItem('userLastName');
      const email = await AsyncStorage.getItem('userEmail');
      const phoneNumber = await AsyncStorage.getItem('userPhoneNumber');
      const joinDate = await AsyncStorage.getItem('userJoinDate');
      const status = await AsyncStorage.getItem('userStatus');
      const role = await AsyncStorage.getItem('userRole');
      const tenantId = await AsyncStorage.getItem('userTenantId');
      const createdBy = await AsyncStorage.getItem('userCreatedBy');
      const modifiedBy = await AsyncStorage.getItem('userModifiedBy');
      const createdOn = await AsyncStorage.getItem('userCreatedOn');
      const modifiedOn = await AsyncStorage.getItem('userModifiedOn');

      const profile: AdminProfile = {
        id: userId || '',
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
        phoneNumber: phoneNumber || '',
        joinDate: joinDate || '',
        status: status || '',
        role: role || '',
        created_by: createdBy || '',
        modified_by: modifiedBy || '',
        created_on: createdOn || '',
        modified_on: modifiedOn || '',
        mansoft_tenant_id: tenantId || '',
      };

      setAdminProfile(profile);

      // Fetch groups created by this admin using their user ID
      if (userId) {
        const response = await fetch(`${BASE_URL}/groups/groupadmin/${userId}`);
        if (response.ok) {
          const groups: Group[] = await response.json();
          
          // CORRECTED: Use the members data that already comes with each group
          // No need for additional API calls to /groups/{id}/members
          const enhancedGroups = groups.map((group) => ({
            ...group,
            memberCount: group.members?.length || 0 // Use the members array that's already in the group data
          }));
          
          setAdminGroups(enhancedGroups);
        } else {
          console.warn('Failed to fetch groups. Status:', response.status);
          // Set empty groups array if fetch fails
          setAdminGroups([]);
        }
      } else {
        console.warn('No user ID found');
        setAdminGroups([]);
      }
    } catch (error) {
      console.error('Error fetching profile or groups:', error);
      Alert.alert('Error', 'Failed to load profile data. Please try again.');
      setAdminGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfileAndGroups();
    setRefreshing(false);
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'This feature will be available soon!');
  };

  const handleGroupPress = (groupId: string) => {
    // You can navigate to group details if needed
    router.push(`/(groupadmin)/group-details?id=${groupId}`);
  };

  const handleCreateGroup = () => {
    router.push('/(groupadmin)/create-group');
  };

  const getStatusColor = (status: string) => {
    return status?.toLowerCase() === 'active' ? '#4CAF50' : '#F44336';
  };

  const getStatusIcon = (status: string) => {
    return status?.toLowerCase() === 'active' ? 'checkmark-circle' : 'close-circle';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
      {/* Enhanced Header */}
      <View style={[styles.header, isDarkMode && styles.darkHeader]}>
        <View style={styles.logoRow}>
          <Image 
            source={require('../../../assets/images/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.logoText, isDarkMode && styles.darkText]}>
            MAN<Text style={styles.logoGreen}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => router.replace('/(groupadmin)/dashboard')}
        >
          <Ionicons name="home" size={20} color={isDarkMode ? "#90CAF9" : "#1565C0"} />
          <Text style={[styles.backToHome, isDarkMode && styles.darkBackToHome]}>Home</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Header Card */}
      <View style={[styles.profileHeader, isDarkMode && styles.darkProfileHeader]}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {adminProfile?.firstName?.[0]}{adminProfile?.lastName?.[0]}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Ionicons 
              name={getStatusIcon(adminProfile?.status || '')} 
              size={16} 
              color="#FFF" 
            />
          </View>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, isDarkMode && styles.darkText]}>
            {adminProfile?.firstName} {adminProfile?.lastName}
          </Text>
          <Text style={[styles.profileRole, isDarkMode && styles.darkSubText]}>
            {adminProfile?.role}
          </Text>
          <Text style={[styles.profileEmail, isDarkMode && styles.darkSubText]}>
            {adminProfile?.email}
          </Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Ionicons name="create-outline" size={18} color="#2196F3" />
          <Text style={styles.editButtonText}>Edit</Text>
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
            color={activeTab === 'profile' ? '#2196F3' : (isDarkMode ? '#B0B0B0' : '#666')} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'profile' && styles.activeTabText,
            isDarkMode && styles.darkTabText
          ]}>
            Profile Details
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'groups' && styles.activeTab,
            activeTab === 'groups' && isDarkMode && styles.darkActiveTab
          ]}
          onPress={() => setActiveTab('groups')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'groups' ? '#2196F3' : (isDarkMode ? '#B0B0B0' : '#666')} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'groups' && styles.activeTabText,
            isDarkMode && styles.darkTabText
          ]}>
            My Groups ({adminGroups.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.container, isDarkMode && styles.darkContainer]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor={isDarkMode ? '#90CAF9' : '#2196F3'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'profile' ? (
          /* Profile Details */
          <View style={styles.profileSection}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
              Account Information
            </Text>
            
            <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
              {[
                { label: 'Full Name', value: `${adminProfile?.firstName} ${adminProfile?.lastName}`, icon: 'person' },
                { label: 'Email', value: adminProfile?.email, icon: 'mail' },
                { label: 'Phone', value: adminProfile?.phoneNumber || 'Not provided', icon: 'call' },
                { label: 'Join Date', value: adminProfile?.joinDate ? new Date(adminProfile.joinDate).toLocaleDateString() : 'N/A', icon: 'calendar' },
                { label: 'Status', value: adminProfile?.status, icon: 'checkmark-circle', status: true },
                { label: 'Tenant ID', value: adminProfile?.mansoft_tenant_id, icon: 'business' },
              ].map((item, index) => (
                <View key={index} style={styles.infoItem}>
                  <View style={styles.infoLeft}>
                    <Ionicons 
                      name={item.icon as any} 
                      size={18} 
                      color={isDarkMode ? "#90CAF9" : "#2196F3"} 
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
                      {item.value}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* System Information */}
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText, { marginTop: 24 }]}>
              System Information
            </Text>
            <View style={[styles.infoCard, isDarkMode && styles.darkInfoCard]}>
              {[
                { label: 'Created By', value: adminProfile?.created_by || 'System' },
                { label: 'Modified By', value: adminProfile?.modified_by || 'Never modified' },
                { label: 'Created On', value: adminProfile?.created_on ? new Date(adminProfile.created_on).toLocaleDateString() : 'N/A' },
                { label: 'Last Modified', value: adminProfile?.modified_on ? new Date(adminProfile.modified_on).toLocaleDateString() : 'Never' },
              ].map((item, index) => (
                <View key={index} style={styles.infoItem}>
                  <Text style={[styles.infoLabel, isDarkMode && styles.darkSubText]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.infoValue, isDarkMode && styles.darkText]}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* Groups Section */
          <View style={styles.groupsSection}>
            <View style={styles.groupsHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
                Managed Groups
              </Text>
              <TouchableOpacity 
                style={styles.createGroupButton}
                onPress={handleCreateGroup}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.createGroupText}>Create Group</Text>
              </TouchableOpacity>
            </View>

            {adminGroups.length > 0 ? (
              <View style={styles.groupsGrid}>
                {adminGroups.map((group, index) => (
                  <TouchableOpacity
                    key={group.id || index}
                    style={[styles.groupCard, isDarkMode && styles.darkGroupCard]}
                    onPress={() => handleGroupPress(group.id)}
                  >
                    <View style={styles.groupHeader}>
                      <View style={styles.groupIcon}>
                        <Ionicons name="people" size={24} color="#2196F3" />
                      </View>
                      <View style={[
                        styles.groupStatus,
                        { backgroundColor: getStatusColor(group.status) }
                      ]}>
                        <Text style={styles.groupStatusText}>
                          {group.status}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={[styles.groupTitle, isDarkMode && styles.darkText]}>
                      {group.groupName}
                    </Text>
                    <Text style={[styles.groupDescription, isDarkMode && styles.darkSubText]}>
                      {group.description || 'No description provided'}
                    </Text>
                    
                    <View style={styles.groupFooter}>
                      <View style={styles.groupMeta}>
                        <Ionicons name="calendar" size={14} color={isDarkMode ? "#B0B0B0" : "#666"} />
                        <Text style={[styles.groupMetaText, isDarkMode && styles.darkSubText]}>
                          {group.creationDate?.split('T')[0] || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.groupMeta}>
                        <Ionicons name="person" size={14} color={isDarkMode ? "#B0B0B0" : "#666"} />
                        <Text style={[styles.groupMetaText, isDarkMode && styles.darkSubText]}>
                          {group.memberCount || 0} members
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={isDarkMode ? "#666" : "#CCC"} />
                <Text style={[styles.emptyStateTitle, isDarkMode && styles.darkText]}>
                  No Groups Created
                </Text>
                <Text style={[styles.emptyStateText, isDarkMode && styles.darkSubText]}>
                  You haven't created any groups yet. Start by creating your first group!
                </Text>
                <TouchableOpacity 
                  style={styles.createGroupButton}
                  onPress={handleCreateGroup}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.createGroupText}>Create Your First Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

// Your existing styles remain the same...
const styles = StyleSheet.create({
  // ... (keep all your existing styles exactly as they are)
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  darkSafeArea: {
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  darkHeader: {
    backgroundColor: '#1E1E1E',
    borderBottomColor: '#333',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  logoGreen: {
    color: '#4CAF50',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backToHome: {
    color: '#1565C0',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  darkBackToHome: {
    color: '#90CAF9',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  darkProfileHeader: {
    backgroundColor: '#1E1E1E',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  editButtonText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
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
    backgroundColor: '#E3F2FD',
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
    color: '#2196F3',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  profileSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkInfoCard: {
    backgroundColor: '#1E1E1E',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  darkInfoItem: {
    borderBottomColor: '#333',
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
  groupsSection: {
    flex: 1,
  },
  groupsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  createGroupText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  groupsGrid: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkGroupCard: {
    backgroundColor: '#1E1E1E',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
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
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  groupDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupMetaText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  darkText: {
    color: '#FFFFFF',
  },
  darkSubText: {
    color: '#B0B0B0',
  },
});

export default GroupAdminProfileScreen;
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

// Helper function for alerts
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

const GroupSettingsScreen = () => {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [editMode, setEditMode] = useState(false);
  
  // Form state
  const [contributionFrequency, setContributionFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [enablePenalty, setEnablePenalty] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState('3');
  const [enableReminders, setEnableReminders] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState('2');
  const [contributionDueDay, setContributionDueDay] = useState('1');

  // Store current settings for display
  const [currentSettings, setCurrentSettings] = useState<any>(null);
  const [nextDueDate, setNextDueDate] = useState<string>('');

  useEffect(() => {
    loadUserAndSettings();
  }, []);

  const loadUserAndSettings = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      const userFirstName = await AsyncStorage.getItem('userFirstName');
      const userLastName = await AsyncStorage.getItem('userLastName');

      if (!userId) {
        showAlert('Error', 'Please log in again', () => {
          router.replace('/(auth)/index');
        });
        return;
      }

      if (!userGroupId) {
        showAlert('Error', 'You are not assigned to any group. Please contact your administrator.', () => {
          router.back();
        });
        return;
      }

      setAdminId(userId);
      setGroupId(userGroupId);
      setGroupName(`${userFirstName || ''} ${userLastName || ''}'s Group`);
      
      await fetchGroupName(userGroupId);
      await fetchGroupSettings(userId, userGroupId);
      await fetchNextDueDate(userGroupId);
      
    } catch (error) {
      console.error('Error loading:', error);
      showAlert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupName = async (groupId: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/groups/${groupId}`);
      if (response.data && response.data.groupName) {
        setGroupName(response.data.groupName);
      }
    } catch (error) {
      console.error('Error fetching group name:', error);
    }
  };

  const fetchGroupSettings = async (userId: string, groupId: string) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/groups/${groupId}/settings`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
          },
        }
      );

      if (response.data && response.data.settings) {
        const settings = response.data.settings;
        setCurrentSettings(settings);
        
        // Set form values
        setContributionFrequency(settings.contributionFrequency || 'MONTHLY');
        setExpectedAmount(settings.expectedContributionAmount?.toString() || '');
        setEnablePenalty(settings.enablePenalty || false);
        setPenaltyAmount(settings.penaltyAmount?.toString() || '');
        setGracePeriodDays(settings.gracePeriodDays?.toString() || '3');
        setEnableReminders(settings.enableReminders !== false);
        setReminderDaysBefore(settings.reminderDaysBefore?.toString() || '2');
        setContributionDueDay(settings.contributionDueDay?.toString() || '1');
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchNextDueDate = async (groupId: string) => {
    try {
      // Fetch group details to get next_contribution_date
      const response = await axios.get(`${BASE_URL}/groups/${groupId}`);
      if (response.data && response.data.nextContributionDate) {
        const nextDate = new Date(response.data.nextContributionDate);
        const formattedDate = nextDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        setNextDueDate(formattedDate);
      } else {
        setNextDueDate('Not calculated yet');
      }
    } catch (error) {
      console.error('Error fetching next due date:', error);
      setNextDueDate('Not available');
    }
  };

  const handleSaveSettings = async () => {
    if (!expectedAmount || parseFloat(expectedAmount) <= 0) {
      showAlert('Validation', 'Please enter a valid contribution amount');
      return;
    }

    if (enablePenalty && (!penaltyAmount || parseFloat(penaltyAmount) <= 0)) {
      showAlert('Validation', 'Please enter a valid penalty amount');
      return;
    }

    setSaving(true);

    const payload = {
      contributionFrequency,
      expectedContributionAmount: parseFloat(expectedAmount),
      enablePenalty,
      penaltyAmount: enablePenalty ? parseFloat(penaltyAmount) : null,
      gracePeriodDays: enablePenalty ? parseInt(gracePeriodDays) : 3,
      enableReminders,
      reminderDaysBefore: enableReminders ? parseInt(reminderDaysBefore) : 2,
      contributionDueDay: parseInt(contributionDueDay),
    };

    try {
      const response = await axios.put(
        `${BASE_URL}/groups/${groupId}/settings`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': adminId,
          },
        }
      );

      if (response.data && response.data.status === 200) {
        // Refresh settings after save
        await fetchGroupSettings(adminId, groupId);
        await fetchNextDueDate(groupId);
        setEditMode(false);
        showAlert('Success ✅', 'Group contribution settings saved successfully!');
      } else {
        showAlert('Error', response.data?.message || 'Failed to save settings');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      const msg = error.response?.data?.message || error.message || 'Something went wrong';
      showAlert('Error ❌', msg.toString());
    } finally {
      setSaving(false);
    }
  };

  // Get the day name for weekly display
  const getDayName = (dayNumber: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber - 1] || 'Monday';
  };

  // Format date nicely
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Not calculated yet' || dateString === 'Not available') {
      return dateString;
    }
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  // Render Current Settings Card
  const renderSettingsCard = () => {
    if (!currentSettings) return null;
    
    const frequency = currentSettings.contributionFrequency || 'Not set';
    const amount = currentSettings.expectedContributionAmount || '0';
    const dueDay = currentSettings.contributionDueDay || '1';
    const penalty = currentSettings.enablePenalty;
    const penaltyAmt = currentSettings.penaltyAmount || '0';
    const graceDays = currentSettings.gracePeriodDays || '3';
    const reminders = currentSettings.enableReminders;
    const reminderDays = currentSettings.reminderDaysBefore || '2';
    
    const dueText = frequency === 'MONTHLY' 
      ? `Day ${dueDay} of each month` 
      : `Every ${getDayName(parseInt(dueDay))}`;

    return (
      <View style={styles.currentSettingsCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📋 Current Contribution Settings</Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setEditMode(true)}
          >
            <Text style={styles.editButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.cardContent}>
          {/* Frequency Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Frequency:</Text>
            <Text style={styles.infoValue}>
              {frequency === 'MONTHLY' ? '📅 Monthly' : '📆 Weekly'}
            </Text>
          </View>
          
          {/* Amount Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Amount:</Text>
            <Text style={[styles.infoValue, styles.amountValue]}>
              KES {parseFloat(amount).toLocaleString()}
            </Text>
          </View>
          
          {/* Due Day Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Due:</Text>
            <Text style={styles.infoValue}>{dueText}</Text>
          </View>
          
          {/* NEXT DUE DATE - NEW LINE */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Next Due Date:</Text>
            <Text style={[styles.infoValue, styles.nextDueDateValue]}>
              📅 {formatDate(nextDueDate)}
            </Text>
          </View>
          
          {/* Penalty Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Penalty:</Text>
            <Text style={[styles.infoValue, penalty ? styles.enabledText : styles.disabledText]}>
              {penalty ? `KES ${parseFloat(penaltyAmt).toLocaleString()} (after ${graceDays} days)` : '❌ Disabled'}
            </Text>
          </View>
          
          {/* Reminders Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reminders:</Text>
            <Text style={[styles.infoValue, reminders ? styles.enabledText : styles.disabledText]}>
              {reminders ? `✅ ${reminderDays} day(s) before due` : '❌ Disabled'}
            </Text>
          </View>
        </View>
        
        {/* Status Indicator */}
        {frequency && amount && parseFloat(amount) > 0 ? (
          <View style={styles.statusActive}>
            <Text style={styles.statusActiveText}>✅ Active - Contributions will be auto-generated</Text>
          </View>
        ) : (
          <View style={styles.statusInactive}>
            <Text style={styles.statusInactiveText}>⚠️ Not Configured - Set up your contribution rules</Text>
          </View>
        )}
      </View>
    );
  };

  // Render Edit Form Modal
  const renderEditModal = () => {
    return (
      <Modal
        visible={editMode}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditMode(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ Edit Settings</Text>
              <TouchableOpacity onPress={() => setEditMode(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Frequency Selection */}
              <Text style={styles.label}>Contribution Frequency</Text>
              <View style={styles.frequencyRow}>
                <TouchableOpacity
                  style={[
                    styles.frequencyButton,
                    contributionFrequency === 'MONTHLY' && styles.frequencyButtonActive,
                  ]}
                  onPress={() => setContributionFrequency('MONTHLY')}
                >
                  <Text style={[
                    styles.frequencyText,
                    contributionFrequency === 'MONTHLY' && styles.frequencyTextActive,
                  ]}>📅 Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.frequencyButton,
                    contributionFrequency === 'WEEKLY' && styles.frequencyButtonActive,
                  ]}
                  onPress={() => setContributionFrequency('WEEKLY')}
                >
                  <Text style={[
                    styles.frequencyText,
                    contributionFrequency === 'WEEKLY' && styles.frequencyTextActive,
                  ]}>📆 Weekly</Text>
                </TouchableOpacity>
              </View>

              {/* Expected Amount */}
              <Text style={styles.label}>Expected Contribution Amount (KES)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1000"
                value={expectedAmount}
                onChangeText={setExpectedAmount}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />

              {/* Due Day */}
              <Text style={styles.label}>
                {contributionFrequency === 'MONTHLY' ? 'Due Day of Month' : 'Due Day of Week'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                {contributionFrequency === 'MONTHLY' ? (
                  [1, 5, 10, 15, 20, 25, 28, 30].map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.chip,
                        parseInt(contributionDueDay) === day && styles.selectedChip,
                      ]}
                      onPress={() => setContributionDueDay(day.toString())}
                    >
                      <Text style={parseInt(contributionDueDay) === day ? styles.selectedChipText : styles.chipText}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.chip,
                        parseInt(contributionDueDay) === index + 1 && styles.selectedChip,
                      ]}
                      onPress={() => setContributionDueDay((index + 1).toString())}
                    >
                      <Text style={parseInt(contributionDueDay) === index + 1 ? styles.selectedChipText : styles.chipText}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              {/* Penalty Section */}
              <View style={styles.section}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>🔨 Enable Late Penalties</Text>
                  <Switch
                    value={enablePenalty}
                    onValueChange={setEnablePenalty}
                    trackColor={{ false: '#ccc', true: '#2196F3' }}
                  />
                </View>

                {enablePenalty && (
                  <View style={styles.nestedContainer}>
                    <Text style={styles.subLabel}>Penalty Amount (KES)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 100"
                      value={penaltyAmount}
                      onChangeText={setPenaltyAmount}
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.subLabel}>Grace Period (Days)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 3"
                      value={gracePeriodDays}
                      onChangeText={setGracePeriodDays}
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.hint}>Days after due date before penalty applies</Text>
                  </View>
                )}
              </View>

              {/* Reminder Section */}
              <View style={styles.section}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>🔔 Enable Reminders</Text>
                  <Switch
                    value={enableReminders}
                    onValueChange={setEnableReminders}
                    trackColor={{ false: '#ccc', true: '#2196F3' }}
                  />
                </View>

                {enableReminders && (
                  <View style={styles.nestedContainer}>
                    <Text style={styles.subLabel}>Remind Members (Days Before Due)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                      {[1, 2, 3, 5, 7].map((days) => (
                        <TouchableOpacity
                          key={days}
                          style={[
                            styles.chip,
                            parseInt(reminderDaysBefore) === days && styles.selectedChip,
                          ]}
                          onPress={() => setReminderDaysBefore(days.toString())}
                        >
                          <Text style={parseInt(reminderDaysBefore) === days ? styles.selectedChipText : styles.chipText}>
                            {days} day{days !== 1 ? 's' : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, (!expectedAmount || saving) && styles.buttonDisabled]}
                onPress={handleSaveSettings}
                disabled={!expectedAmount || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>💾 Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backToHome}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>💰 Contribution Settings</Text>
        <Text style={styles.subtitle}>Group: {groupName}</Text>

        {/* Current Settings Card */}
        {renderSettingsCard()}
      </ScrollView>

      {/* Edit Modal */}
      {renderEditModal()}

      {/* Persistent Bottom Navigation */}
      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
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
  backToHome: {
    color: '#1565C0',
    fontWeight: 'bold',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#555',
  },
  inner: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    color: '#1A237E',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  // Current Settings Card Styles
  currentSettingsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2196F3',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  nextDueDateValue: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  enabledText: {
    color: '#4CAF50',
  },
  disabledText: {
    color: '#F44336',
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    alignItems: 'center',
  },
  statusActiveText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 12,
  },
  statusInactive: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    alignItems: 'center',
  },
  statusInactiveText: {
    color: '#FF9800',
    fontWeight: '600',
    fontSize: 12,
  },
  // Form Styles
  label: {
    marginTop: 20,
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
    alignItems: 'center',
  },
  frequencyButtonActive: {
    backgroundColor: '#2196F3',
  },
  frequencyText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  frequencyTextActive: {
    color: '#fff',
  },
  chipScrollView: {
    paddingVertical: 5,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginRight: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  selectedChip: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  chipText: {
    color: '#333',
    fontWeight: '500',
  },
  selectedChipText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nestedContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  // Save Button
  saveButton: {
    marginTop: 30,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 30,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default GroupSettingsScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

type SystemSettings = {
  // Security Settings
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expiryDays: number;
  };
  // System Defaults
  defaults: {
    currency: string;
    language: string;
    timezone: string;
    dateFormat: string;
  };
  // Notifications
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    lowBalanceAlert: boolean;
    newMemberAlert: boolean;
    expenseApprovalAlert: boolean;
  };
  // System Limits
  limits: {
    maxGroupMembers: number;
    maxFileSizeMB: number;
    maxExpenseAmount: number;
    contributionDeadlineDays: number;
  };
  // Appearance
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    primaryColor: string;
    fontScale: number;
  };
};

export default function AdminSettingsScreen(): React.JSX.Element {
  const [settings, setSettings] = useState<SystemSettings>({
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      expiryDays: 90,
    },
    defaults: {
      currency: 'KES',
      language: 'English',
      timezone: 'Africa/Nairobi',
      dateFormat: 'DD/MM/YYYY',
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      lowBalanceAlert: true,
      newMemberAlert: true,
      expenseApprovalAlert: true,
    },
    limits: {
      maxGroupMembers: 50,
      maxFileSizeMB: 10,
      maxExpenseAmount: 100000,
      contributionDeadlineDays: 7,
    },
    appearance: {
      theme: 'light',
      primaryColor: '#2E7D32',
      fontScale: 1,
    },
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeSection, setActiveSection] = useState('security');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('systemSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem('systemSettings', JSON.stringify(settings));
      Alert.alert('Success', 'System settings saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (section: keyof SystemSettings, updates: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < settings.passwordPolicy.minLength) {
      Alert.alert('Error', `Password must be at least ${settings.passwordPolicy.minLength} characters long.`);
      return;
    }
    Alert.alert('Success', 'Password changed successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const resetToDefaults = () => {
    setSettings({
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        expiryDays: 90,
      },
      defaults: {
        currency: 'KES',
        language: 'English',
        timezone: 'Africa/Nairobi',
        dateFormat: 'DD/MM/YYYY',
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: true,
        lowBalanceAlert: true,
        newMemberAlert: true,
        expenseApprovalAlert: true,
      },
      limits: {
        maxGroupMembers: 50,
        maxFileSizeMB: 10,
        maxExpenseAmount: 100000,
        contributionDeadlineDays: 7,
      },
      appearance: {
        theme: 'light',
        primaryColor: '#2E7D32',
        fontScale: 1,
      },
    });
    setShowResetModal(false);
    Alert.alert('Success', 'Settings reset to defaults!');
  };

  const NavigationButton = ({ section, icon, label }: { section: string, icon: string, label: string }) => (
    <TouchableOpacity
      style={[
        styles.navButton,
        activeSection === section && styles.navButtonActive
      ]}
      onPress={() => setActiveSection(section)}
    >
      <Text style={styles.navIcon}>{icon}</Text>
      <Text style={[
        styles.navLabel,
        activeSection === section && styles.navLabelActive
      ]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading System Settings...</Text>
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
        <TouchableOpacity onPress={() => router.push('/(superadmin)/dashboard')}>
          <Text style={styles.homeLink}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>⚙️ System Settings</Text>
        <Text style={styles.subtitle}>Configure application-wide settings and defaults</Text>

        {/* Navigation Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navContainer}>
          <NavigationButton section="security" icon="🔐" label="Security" />
          <NavigationButton section="defaults" icon="🌍" label="Defaults" />
          <NavigationButton section="notifications" icon="🔔" label="Notifications" />
          <NavigationButton section="limits" icon="📊" label="Limits" />
          <NavigationButton section="appearance" icon="🎨" label="Appearance" />
        </ScrollView>

        {/* Security Section */}
        {activeSection === 'security' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔐 Security Settings</Text>
            
            <Text style={styles.subSectionTitle}>Password Policy</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Minimum Password Length</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={settings.passwordPolicy.minLength.toString()}
                onChangeText={(val) => updateSettings('passwordPolicy', { minLength: parseInt(val) || 8 })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Require Uppercase Letters</Text>
              <Switch
                value={settings.passwordPolicy.requireUppercase}
                onValueChange={(val) => updateSettings('passwordPolicy', { requireUppercase: val })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Require Lowercase Letters</Text>
              <Switch
                value={settings.passwordPolicy.requireLowercase}
                onValueChange={(val) => updateSettings('passwordPolicy', { requireLowercase: val })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Require Numbers</Text>
              <Switch
                value={settings.passwordPolicy.requireNumbers}
                onValueChange={(val) => updateSettings('passwordPolicy', { requireNumbers: val })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Require Special Characters</Text>
              <Switch
                value={settings.passwordPolicy.requireSpecialChars}
                onValueChange={(val) => updateSettings('passwordPolicy', { requireSpecialChars: val })}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Password Expiry (Days)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={settings.passwordPolicy.expiryDays.toString()}
                onChangeText={(val) => updateSettings('passwordPolicy', { expiryDays: parseInt(val) || 90 })}
              />
            </View>

            <Text style={styles.subSectionTitle}>Change Admin Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Current Password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="New Password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity style={styles.actionButton} onPress={handlePasswordChange}>
              <Text style={styles.actionButtonText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* System Defaults Section */}
        {activeSection === 'defaults' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌍 System Defaults</Text>
            
            <Text style={styles.settingLabel}>Default Currency</Text>
            <Picker
              selectedValue={settings.defaults.currency}
              onValueChange={(val) => updateSettings('defaults', { currency: val })}
              style={styles.picker}
            >
              <Picker.Item label="Kenyan Shilling (KES)" value="KES" />
              <Picker.Item label="US Dollar (USD)" value="USD" />
              <Picker.Item label="Euro (EUR)" value="EUR" />
              <Picker.Item label="British Pound (GBP)" value="GBP" />
            </Picker>

            <Text style={styles.settingLabel}>Default Language</Text>
            <Picker
              selectedValue={settings.defaults.language}
              onValueChange={(val) => updateSettings('defaults', { language: val })}
              style={styles.picker}
            >
              <Picker.Item label="English" value="English" />
              <Picker.Item label="Swahili" value="Swahili" />
              <Picker.Item label="French" value="French" />
              <Picker.Item label="Spanish" value="Spanish" />
            </Picker>

            <Text style={styles.settingLabel}>Timezone</Text>
            <Picker
              selectedValue={settings.defaults.timezone}
              onValueChange={(val) => updateSettings('defaults', { timezone: val })}
              style={styles.picker}
            >
              <Picker.Item label="Nairobi (EAT)" value="Africa/Nairobi" />
              <Picker.Item label="London (GMT)" value="Europe/London" />
              <Picker.Item label="New York (EST)" value="America/New_York" />
            </Picker>

            <Text style={styles.settingLabel}>Date Format</Text>
            <Picker
              selectedValue={settings.defaults.dateFormat}
              onValueChange={(val) => updateSettings('defaults', { dateFormat: val })}
              style={styles.picker}
            >
              <Picker.Item label="DD/MM/YYYY" value="DD/MM/YYYY" />
              <Picker.Item label="MM/DD/YYYY" value="MM/DD/YYYY" />
              <Picker.Item label="YYYY-MM-DD" value="YYYY-MM-DD" />
            </Picker>
          </View>
        )}

        {/* Notifications Section */}
        {activeSection === 'notifications' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔔 Notification Settings</Text>
            
            <Text style={styles.subSectionTitle}>Notification Channels</Text>
            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Switch
                value={settings.notifications.emailEnabled}
                onValueChange={(val) => updateSettings('notifications', { emailEnabled: val })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>SMS Notifications</Text>
              <Switch
                value={settings.notifications.smsEnabled}
                onValueChange={(val) => updateSettings('notifications', { smsEnabled: val })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Switch
                value={settings.notifications.pushEnabled}
                onValueChange={(val) => updateSettings('notifications', { pushEnabled: val })}
              />
            </View>

            <Text style={styles.subSectionTitle}>Alert Types</Text>
            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Low Balance Alerts</Text>
              <Switch
                value={settings.notifications.lowBalanceAlert}
                onValueChange={(val) => updateSettings('notifications', { lowBalanceAlert: val })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>New Member Alerts</Text>
              <Switch
                value={settings.notifications.newMemberAlert}
                onValueChange={(val) => updateSettings('notifications', { newMemberAlert: val })}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Expense Approval Alerts</Text>
              <Switch
                value={settings.notifications.expenseApprovalAlert}
                onValueChange={(val) => updateSettings('notifications', { expenseApprovalAlert: val })}
              />
            </View>
          </View>
        )}

        {/* System Limits Section */}
        {activeSection === 'limits' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 System Limits</Text>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Max Group Members</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={settings.limits.maxGroupMembers.toString()}
                onChangeText={(val) => updateSettings('limits', { maxGroupMembers: parseInt(val) || 50 })}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Max File Size (MB)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={settings.limits.maxFileSizeMB.toString()}
                onChangeText={(val) => updateSettings('limits', { maxFileSizeMB: parseInt(val) || 10 })}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Max Expense Amount (KES)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={settings.limits.maxExpenseAmount.toString()}
                onChangeText={(val) => updateSettings('limits', { maxExpenseAmount: parseInt(val) || 100000 })}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Contribution Deadline (Days)</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={settings.limits.contributionDeadlineDays.toString()}
                onChangeText={(val) => updateSettings('limits', { contributionDeadlineDays: parseInt(val) || 7 })}
              />
            </View>
          </View>
        )}

        {/* Appearance Section */}
        {activeSection === 'appearance' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎨 Appearance Settings</Text>
            
            <Text style={styles.settingLabel}>Theme</Text>
            <Picker
              selectedValue={settings.appearance.theme}
              onValueChange={(val) => updateSettings('appearance', { theme: val })}
              style={styles.picker}
            >
              <Picker.Item label="Light" value="light" />
              <Picker.Item label="Dark" value="dark" />
              <Picker.Item label="Auto" value="auto" />
            </Picker>

            <Text style={styles.settingLabel}>Primary Color</Text>
            <Picker
              selectedValue={settings.appearance.primaryColor}
              onValueChange={(val) => updateSettings('appearance', { primaryColor: val })}
              style={styles.picker}
            >
              <Picker.Item label="Green" value="#2E7D32" />
              <Picker.Item label="Blue" value="#1976D2" />
              <Picker.Item label="Purple" value="#7B1FA2" />
              <Picker.Item label="Orange" value="#F57C00" />
            </Picker>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Font Scale</Text>
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                value={settings.appearance.fontScale.toString()}
                onChangeText={(val) => updateSettings('appearance', { fontScale: parseFloat(val) || 1 })}
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.resetButton} 
            onPress={() => setShowResetModal(true)}
          >
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save All Settings</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Settings</Text>
            <Text style={styles.modalText}>
              Are you sure you want to reset all settings to default values? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={resetToDefaults}
              >
                <Text style={styles.modalConfirmText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SuperAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
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
  homeLink: {
    fontSize: 14,
    color: '#D84315',
    fontWeight: '600',
  },
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  navContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  navButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  navIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  navLabelActive: {
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 15,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderColor: '#ccc',
    borderWidth: 1,
  },
  numberInput: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    width: 80,
    textAlign: 'center',
  },
  picker: {
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#ffebee',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  resetButtonText: {
    color: '#D32F2F',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    margin: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
  },
  modalCancelText: {
    color: '#666',
    fontWeight: '500',
  },
  modalConfirmButton: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
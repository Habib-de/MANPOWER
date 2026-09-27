import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://172.20.10.2:8080/api';

interface Group {
  id: string;
  groupName: string;
  mpesaConsumerKey: string;
  mpesaConsumerSecret: string;
  mpesaBusinessShortcode: string;
  mpesaPasskey: string;
  mpesaCallbackUrl: string;
  mpesaIsActive: boolean;
  mpesaLastConfigured: string;
}

interface MpesaConfig {
  groupId: string;
  groupName: string;
  businessShortcode: string;
  callbackUrl: string;
  isActive: boolean;
  lastConfigured: string;
  hasConsumerKey: boolean;
  hasConsumerSecret: boolean;
  hasPasskey: boolean;
}

export default function GroupMpesaSettingsScreen() {
  const router = useRouter();
  const { setUserRole } = useContext(AuthContext)!;
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configStatus, setConfigStatus] = useState<MpesaConfig | null>(null);
  
  // Form fields
  const [mpesaConsumerKey, setMpesaConsumerKey] = useState('');
  const [mpesaConsumerSecret, setMpesaConsumerSecret] = useState('');
  const [mpesaBusinessShortcode, setMpesaBusinessShortcode] = useState('');
  const [mpesaPasskey, setMpesaPasskey] = useState('');
  const [mpesaCallbackUrl, setMpesaCallbackUrl] = useState('');
  const [mpesaIsActive, setMpesaIsActive] = useState(true);

  // Original values for tracking changes
  const [originalConfig, setOriginalConfig] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchGroups();
    }, [])
  );

  const fetchGroups = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${BASE_URL}/groups/groupadmin/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch groups');
      
      const data = await response.json();
      setGroups(data);
      
      // Auto-select first group if available
      if (data.length > 0) {
        await selectGroup(data[0]);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      Alert.alert('Error', 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const selectGroup = async (group: Group) => {
    setSelectedGroup(group);
    setLoading(true);
    
    try {
      // Fetch current MPESA configuration
      const configResponse = await fetch(`${BASE_URL}/groups/${group.id}/mpesa/config`);
      if (configResponse.ok) {
        const configData = await configResponse.json();
        if (configData.status === 200 && configData.config) {
          const config = configData.config;
          setOriginalConfig(config);
          setMpesaBusinessShortcode(config.businessShortcode || '');
          setMpesaCallbackUrl(config.callbackUrl || '');
          setMpesaIsActive(config.isActive !== undefined ? config.isActive : true);
          
          // Only show consumer key/secret/passkey if they exist (masked)
          if (config.hasConsumerKey) {
            setMpesaConsumerKey('••••••••••••••••');
          } else {
            setMpesaConsumerKey('');
          }
          
          if (config.hasConsumerSecret) {
            setMpesaConsumerSecret('••••••••••••••••');
          } else {
            setMpesaConsumerSecret('');
          }
          
          if (config.hasPasskey) {
            setMpesaPasskey('••••••••••••••••');
          } else {
            setMpesaPasskey('');
          }
          
          setConfigStatus(config);
        }
      }
    } catch (error) {
      console.error('Error fetching MPESA config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedGroup) return;

    // Validate required fields
    const consumerKey = mpesaConsumerKey.trim();
    const consumerSecret = mpesaConsumerSecret.trim();
    const businessShortcode = mpesaBusinessShortcode.trim();
    const passkey = mpesaPasskey.trim();
    
    if (!businessShortcode) {
      Alert.alert('Validation Error', 'Business Shortcode is required');
      return;
    }
    
    // Check if user is trying to update with masked values
    const hasMaskedValues = 
      consumerKey === '••••••••••••••••' || 
      consumerSecret === '••••••••••••••••' || 
      passkey === '••••••••••••••••';
    
    if (hasMaskedValues && (!consumerKey || !consumerSecret || !passkey)) {
      Alert.alert(
        'Update Required',
        'You must enter new values for Consumer Key, Consumer Secret, and Passkey. Masked values cannot be saved.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!consumerKey || !consumerSecret || !passkey) {
      Alert.alert('Validation Error', 'Consumer Key, Consumer Secret, and Passkey are required');
      return;
    }

    // Confirm if user wants to update
    Alert.alert(
      'Confirm Update',
      'Are you sure you want to update MPESA configuration for ' + selectedGroup.groupName + '?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update', onPress: performSave }
      ]
    );
  };

  const performSave = async () => {
    if (!selectedGroup) return;
    
    setSaving(true);
    
    try {
      const userId = await AsyncStorage.getItem('userId');
      
      const payload = {
        consumerKey: mpesaConsumerKey.trim(),
        consumerSecret: mpesaConsumerSecret.trim(),
        businessShortcode: mpesaBusinessShortcode.trim(),
        passkey: mpesaPasskey.trim(),
        callbackUrl: mpesaCallbackUrl.trim(),
      };
      
      const response = await fetch(`${BASE_URL}/groups/${selectedGroup.id}/mpesa/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || '',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 200) {
        Alert.alert(
          'Success',
          data.message || 'MPESA configuration updated successfully!',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Refresh configuration
                if (selectedGroup) {
                  selectGroup(selectedGroup);
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to update MPESA configuration');
      }
    } catch (error) {
      console.error('Error saving MPESA config:', error);
      Alert.alert('Error', 'An error occurred while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMpesa = async (active: boolean) => {
    if (!selectedGroup) return;
    
    setSaving(true);
    
    try {
      const userId = await AsyncStorage.getItem('userId');
      
      const response = await fetch(
        `${BASE_URL}/groups/${selectedGroup.id}/mpesa/toggle?active=${active}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId || '',
          },
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.status === 200) {
        setMpesaIsActive(active);
        Alert.alert('Success', data.message || `MPESA ${active ? 'activated' : 'deactivated'} successfully`);
        // Refresh configuration
        if (selectedGroup) {
          selectGroup(selectedGroup);
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to toggle MPESA status');
        // Revert switch
        setMpesaIsActive(!active);
      }
    } catch (error) {
      console.error('Error toggling MPESA:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
      setMpesaIsActive(!active);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConfiguration = async () => {
    if (!selectedGroup) return;
    
    setTesting(true);
    
    try {
      const response = await fetch(`${BASE_URL}/groups/${selectedGroup.id}/mpesa/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === 200) {
        let message = '✅ MPESA Configuration is valid!\n\n';
        const testResult = data.testResult;
        message += `Group: ${testResult.group}\n`;
        message += `Business Shortcode: ${testResult.businessShortcode}\n`;
        message += `Callback URL: ${testResult.callbackUrl || 'Not set'}\n`;
        message += `Status: ${testResult.isActive ? 'Active ✅' : 'Inactive ❌'}\n`;
        message += `Last Configured: ${testResult.lastConfigured ? new Date(testResult.lastConfigured).toLocaleString() : 'Never'}`;
        
        Alert.alert('Configuration Test', message);
      } else {
        Alert.alert('Test Failed', data.message || 'MPESA configuration test failed');
      }
    } catch (error) {
      console.error('Error testing MPESA:', error);
      Alert.alert('Error', 'Failed to test MPESA configuration');
    } finally {
      setTesting(false);
    }
  };

  const handleUpdateCallbackUrl = async () => {
    if (!selectedGroup || !mpesaCallbackUrl.trim()) {
      Alert.alert('Validation Error', 'Callback URL is required');
      return;
    }
    
    setSaving(true);
    
    try {
      const userId = await AsyncStorage.getItem('userId');
      
      const response = await fetch(
        `${BASE_URL}/groups/${selectedGroup.id}/mpesa/callback?callbackUrl=${encodeURIComponent(mpesaCallbackUrl.trim())}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId || '',
          },
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.status === 200) {
        Alert.alert('Success', data.message || 'Callback URL updated successfully');
        // Refresh configuration
        if (selectedGroup) {
          selectGroup(selectedGroup);
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to update callback URL');
      }
    } catch (error) {
      console.error('Error updating callback URL:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusIndicator = (isActive: boolean) => {
    return {
      color: isActive ? '#4CAF50' : '#F44336',
      text: isActive ? 'Active' : 'Inactive',
      bgColor: isActive ? '#E8F5E9' : '#FFEBEE',
    };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const hasMpesaConfig = configStatus && (
    configStatus.hasConsumerKey || 
    configStatus.hasConsumerSecret || 
    configStatus.hasPasskey
  );

  const renderGroupSelector = () => {
    if (groups.length <= 1) return null;
    
    return (
      <View style={styles.groupSelectorContainer}>
        <Text style={styles.groupSelectorLabel}>Select Group:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSelectorScroll}>
          {groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupSelectorButton,
                selectedGroup?.id === group.id && styles.groupSelectorButtonActive,
              ]}
              onPress={() => selectGroup(group)}
            >
              <Text
                style={[
                  styles.groupSelectorText,
                  selectedGroup?.id === group.id && styles.groupSelectorTextActive,
                ]}
                numberOfLines={1}
              >
                {group.groupName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={styles.logo}
            />
            <View style={styles.appTitleContainer}>
              <Text style={styles.titleBlack}>MAN</Text>
              <Text style={styles.titleGreen}>POWER</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
            <Text style={styles.headerButtonText}>← Home</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading MPESA Settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.appTitleContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.headerButtonText}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>M-PESA Configuration</Text>
        <Text style={styles.screenSubtitle}>
          Configure M-PESA payment settings for your group
        </Text>

        {renderGroupSelector()}

        {selectedGroup ? (
          <View style={styles.configCard}>
            {/* Status Banner */}
            <View style={[styles.statusBanner, { backgroundColor: getStatusIndicator(mpesaIsActive).bgColor }]}>
              <Text style={[styles.statusText, { color: getStatusIndicator(mpesaIsActive).color }]}>
                Status: {getStatusIndicator(mpesaIsActive).text}
              </Text>
              {configStatus?.lastConfigured && (
                <Text style={styles.lastConfiguredText}>
                  Last configured: {formatDate(configStatus.lastConfigured)}
                </Text>
              )}
            </View>

            {/* Active/Inactive Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Enable M-PESA Payments</Text>
              <Switch
                value={mpesaIsActive}
                onValueChange={handleToggleMpesa}
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor={mpesaIsActive ? '#fff' : '#f4f3f4'}
                disabled={saving}
              />
            </View>

            <View style={styles.divider} />

            {/* Business Shortcode */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Shortcode *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter business shortcode (e.g., 174379)"
                placeholderTextColor="#999"
                value={mpesaBusinessShortcode}
                onChangeText={setMpesaBusinessShortcode}
                keyboardType="numeric"
              />
            </View>

            {/* Consumer Key */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Consumer Key *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter consumer key"
                  placeholderTextColor="#999"
                  value={mpesaConsumerKey}
                  onChangeText={setMpesaConsumerKey}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeButtonText}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Consumer Secret */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Consumer Secret *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter consumer secret"
                  placeholderTextColor="#999"
                  value={mpesaConsumerSecret}
                  onChangeText={setMpesaConsumerSecret}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Passkey */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Passkey *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter passkey"
                  placeholderTextColor="#999"
                  value={mpesaPasskey}
                  onChangeText={setMpesaPasskey}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Callback URL */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Callback URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://your-server.com/mpesa/callback"
                placeholderTextColor="#999"
                value={mpesaCallbackUrl}
                onChangeText={setMpesaCallbackUrl}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.updateCallbackButton}
                onPress={handleUpdateCallbackUrl}
                disabled={saving}
              >
                <Text style={styles.updateCallbackButtonText}>
                  Update Callback URL
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveSettings}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save M-PESA Settings</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.testButton]}
                onPress={handleTestConfiguration}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>🔍 Test Configuration</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Configuration Status Summary */}
            {configStatus && (
              <View style={styles.statusSummary}>
                <Text style={styles.statusSummaryTitle}>Configuration Summary</Text>
                <View style={styles.statusSummaryItem}>
                  <Text style={styles.statusSummaryLabel}>Business Shortcode:</Text>
                  <Text style={styles.statusSummaryValue}>
                    {configStatus.businessShortcode || 'Not set'}
                  </Text>
                </View>
                <View style={styles.statusSummaryItem}>
                  <Text style={styles.statusSummaryLabel}>Consumer Key:</Text>
                  <Text style={[styles.statusSummaryValue, configStatus.hasConsumerKey ? styles.statusSet : styles.statusNotSet]}>
                    {configStatus.hasConsumerKey ? '✅ Set' : '❌ Not set'}
                  </Text>
                </View>
                <View style={styles.statusSummaryItem}>
                  <Text style={styles.statusSummaryLabel}>Consumer Secret:</Text>
                  <Text style={[styles.statusSummaryValue, configStatus.hasConsumerSecret ? styles.statusSet : styles.statusNotSet]}>
                    {configStatus.hasConsumerSecret ? '✅ Set' : '❌ Not set'}
                  </Text>
                </View>
                <View style={styles.statusSummaryItem}>
                  <Text style={styles.statusSummaryLabel}>Passkey:</Text>
                  <Text style={[styles.statusSummaryValue, configStatus.hasPasskey ? styles.statusSet : styles.statusNotSet]}>
                    {configStatus.hasPasskey ? '✅ Set' : '❌ Not set'}
                  </Text>
                </View>
                <View style={styles.statusSummaryItem}>
                  <Text style={styles.statusSummaryLabel}>Callback URL:</Text>
                  <Text style={styles.statusSummaryValue} numberOfLines={2}>
                    {configStatus.callbackUrl || 'Not set'}
                  </Text>
                </View>
                <View style={styles.statusSummaryItem}>
                  <Text style={styles.statusSummaryLabel}>Status:</Text>
                  <Text style={[styles.statusSummaryValue, configStatus.isActive ? styles.statusActive : styles.statusInactive]}>
                    {configStatus.isActive ? '🟢 Active' : '🔴 Inactive'}
                  </Text>
                </View>
              </View>
            )}

            {/* Help/Info Section */}
            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>ℹ️ Need Help?</Text>
              <Text style={styles.helpText}>
                1. Get your M-PESA API credentials from the Safaricom Developer Portal
              </Text>
              <Text style={styles.helpText}>
                2. Business Shortcode is your Paybill/Till number
              </Text>
              <Text style={styles.helpText}>
                3. Callback URL should be publicly accessible (HTTPS recommended)
              </Text>
              <Text style={styles.helpText}>
                {/* 4. Test your configuration before going live */}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No groups found</Text>
            <Text style={styles.emptySubtext}>
              You need to be a group admin to configure M-PESA
            </Text>
          </View>
        )}
      </ScrollView>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 181, 246, 1)',
    elevation: 3,
  },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  appTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  titleBlack: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  titleGreen: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50', marginLeft: 4 },
  headerButtonText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },

  container: { padding: 20, paddingBottom: 100 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  screenSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },

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

  groupSelectorContainer: {
    marginBottom: 16,
  },
  groupSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  groupSelectorScroll: {
    flexDirection: 'row',
  },
  groupSelectorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    marginRight: 8,
  },
  groupSelectorButtonActive: {
    backgroundColor: '#2196F3',
  },
  groupSelectorText: {
    fontSize: 14,
    color: '#333',
  },
  groupSelectorTextActive: {
    color: '#fff',
  },

  configCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  statusBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  lastConfiguredText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
  },

  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },

  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  eyeButtonText: {
    fontSize: 20,
  },

  updateCallbackButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    alignItems: 'center',
  },
  updateCallbackButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },

  buttonContainer: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  testButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  statusSummary: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  statusSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statusSummaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  statusSummaryValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  statusSet: {
    color: '#4CAF50',
  },
  statusNotSet: {
    color: '#F44336',
  },
  statusActive: {
    color: '#4CAF50',
  },
  statusInactive: {
    color: '#F44336',
  },

  helpSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
    paddingLeft: 4,
  },

  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

function GroupAdminSettingsScreen(): React.JSX.Element {
  const router = useRouter();

  const handleResetPassword = () => {
    Alert.alert('Reset Password', 'A password reset link will be sent to your email.');
  };

  const handleToggleTheme = () => {
    Alert.alert('Theme Switched', 'Dark mode enabled (mock)');
  };

  const handleNotificationToggle = () => {
    Alert.alert('Notifications', 'Notifications have been toggled (mock)');
  };

  const handlePrivacySettings = () => {
    Alert.alert('Privacy Settings', 'You can manage your data sharing preferences here.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with logo + MANPOWER + Home */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Group Admin Settings</Text>
        <Text style={styles.subtitle}>
          Configure your preferences and manage your group admin experience.
        </Text>

        <TouchableOpacity style={styles.settingItem} onPress={handleResetPassword}>
          <Text style={styles.settingText}>🔐 Reset Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleToggleTheme}>
          <Text style={styles.settingText}>🌓 Toggle Theme</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleNotificationToggle}>
          <Text style={styles.settingText}>🔔 Notification Preferences</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handlePrivacySettings}>
          <Text style={styles.settingText}>🔒 Privacy Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('About App', 'Version 1.0.0\nBuilt by EduFlex')}>
          <Text style={styles.settingText}>ℹ️ About App</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.settingItem, { backgroundColor: '#EF5350' }]} onPress={() => Alert.alert('Log Out', 'Logging out...')}>
          <Text style={[styles.settingText, { color: '#fff' }]}>🚪 Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <GroupAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

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
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 35,
    height: 35,
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
  container: {
    padding: 20,
    paddingBottom: 100, // leave space for nav
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingItem: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
});

export default GroupAdminSettingsScreen;

import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import MemberBottomNav from '../../components/MemberBottomNav';

type MemberStackParamList = {
  Profile: undefined;
  ForgotPassword: undefined;
};

type NavigationProp = StackNavigationProp<MemberStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userRole');
            router.replace('/(auth)/login');
          } catch (err) {
            console.error('Logout failed', err);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Account',
      'This will deactivate your account. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Delete', onPress: () => console.log('Account deleted') },
      ]
    );
  };

  const themeStyles = getThemeStyles(darkTheme);

  return (
    <SafeAreaView style={themeStyles.container}>
      {/* Header */}
      <View style={themeStyles.headerContainer}>
        <View style={themeStyles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={themeStyles.logo}
          />
          <Text style={themeStyles.brandText}>
            <Text style={themeStyles.brandMan}>MAN</Text>
            <Text style={themeStyles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={themeStyles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={themeStyles.scroll}>
        <Text style={themeStyles.title}>⚙️ Settings</Text>

        {/* Theme Toggle */}
        <View style={themeStyles.section}>
          <Text style={themeStyles.sectionTitle}>Theme</Text>
          <View style={themeStyles.optionRow}>
            <Text style={themeStyles.optionText}>Dark Mode</Text>
            <Switch
              value={darkTheme}
              onValueChange={setDarkTheme}
              trackColor={{ false: '#ccc', true: '#555' }}
              thumbColor={darkTheme ? '#FFF' : '#333'}
            />
          </View>
        </View>

        {/* Profile Settings */}
        <View style={themeStyles.section}>
          <Text style={themeStyles.sectionTitle}>Profile</Text>
          <TouchableOpacity
            style={themeStyles.option}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={themeStyles.optionText}>View / Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={themeStyles.option}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={themeStyles.optionText}>Change Password</Text>
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={themeStyles.section}>
          <Text style={themeStyles.sectionTitle}>Notifications</Text>
          <View style={themeStyles.optionRow}>
            <Text style={themeStyles.optionText}>SMS Notifications</Text>
            <Switch
              value={smsNotifs}
              onValueChange={setSmsNotifs}
              trackColor={{ false: '#ccc', true: '#8E24AA' }}
            />
          </View>
          <View style={themeStyles.optionRow}>
            <Text style={themeStyles.optionText}>Email Notifications</Text>
            <Switch
              value={emailNotifs}
              onValueChange={setEmailNotifs}
              trackColor={{ false: '#ccc', true: '#8E24AA' }}
            />
          </View>
          
        </View>

        {/* Account Actions */}
        <View style={themeStyles.section}>
          <Text style={themeStyles.sectionTitle}>Account</Text>
          <TouchableOpacity style={themeStyles.option} onPress={handleLogout}>
            <Text style={[themeStyles.optionText, { color: '#D32F2F' }]}>Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={themeStyles.option} onPress={handleDelete}>
            <Text style={[themeStyles.optionText, { color: '#B71C1C' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Nav (not highlighting any tab) */}
      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

// Dynamic styles based on theme
function getThemeStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#121212' : '#F3E5F5',
    },
    scroll: {
      padding: 20,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 10,
      paddingHorizontal: 10,
      backgroundColor: '#C8E6C9',
      borderBottomWidth: 1,
      borderBottomColor: '#A5D6A7',
      elevation: 3,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logo: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
      marginRight: 8,
    },
    brandText: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    brandMan: { color: '#000000' },
    brandPower: { color: '#D32F2F' },
    returnButton: {
      fontSize: 14,
      color: '#2E7D32',
      fontWeight: '600',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#E1BEE7' : '#6A1B9A',
      marginBottom: 20,
      textAlign: 'center',
    },
    section: {
      marginBottom: 24,
      backgroundColor: isDark ? '#1E1E1E' : '#fff',
      borderRadius: 12,
      padding: 15,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#BB86FC' : '#7B1FA2',
      marginBottom: 12,
    },
    option: {
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: '#ddd',
    },
    optionText: {
      fontSize: 16,
      color: isDark ? '#ddd' : '#333',
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: '#ddd',
    },
  });
}

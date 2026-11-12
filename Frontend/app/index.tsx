// app/index.tsx
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('userToken');
      const role = await AsyncStorage.getItem('userRole'); // Expecting 'SuperAdmin' | 'GroupAdmin' | 'Member'

      if (token && role) {
        const normalized = role.toLowerCase();
        if (normalized === 'superadmin') {
          router.replace('/(superadmin)/dashboard');
        } else if (normalized === 'groupadmin') {
          router.replace('/(groupadmin)/dashboard');
        } else {
          router.replace('/(member)/dashboard');
        }
      } else {
        router.replace('/login');
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}

// app/layout.tsx
import 'react-native-gesture-handler';
import React, { useState, useEffect, createContext } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router, useSegments } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';

type UserRole = 'Member' | 'SuperAdmin' | 'GroupAdmin';

interface AuthContextType {
  userRole: UserRole | null;
  setUserRole: React.Dispatch<React.SetStateAction<UserRole | null>>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Handle redirect after checking auth state
function useAuthRedirect(userRole: UserRole | null, isLoading: boolean) {
  const segments = useSegments();
  const currentGroup = segments[0];
  const inAuthGroup = currentGroup === '(auth)';

  useEffect(() => {
    if (isLoading) return;

    const routeMap: Record<UserRole, string> = {
      Member: '/(member)/dashboard',
      GroupAdmin: '/(groupadmin)/dashboard',
      SuperAdmin: '/(superadmin)/dashboard',
    };

    if (!userRole) {
      // Guests land on the public home page, not login
      if (!inAuthGroup && currentGroup !== 'home') {
        router.replace('/home' as any);
      }
      return;
    }

    // If user is in auth screens, push them to their dashboard
    if (inAuthGroup) {
      router.replace(routeMap[userRole]);
      return;
    }

    // 👇 ALLOW GROUP ADMIN TO VIEW MEMBER SCREENS 👇
    if (userRole === 'GroupAdmin' && currentGroup === '(member)') {
      return; // Let them through
    }

    // Enforce role's correct root group — redirect if mismatched
    const expectedGroup =
      userRole === 'Member' ? '(member)' :
      userRole === 'GroupAdmin' ? '(groupadmin)' :
      '(superadmin)';

    if (currentGroup !== expectedGroup) {
      router.replace(routeMap[userRole]);
    }
  }, [userRole, currentGroup, isLoading]);
}

export default function Layout(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const role = await AsyncStorage.getItem('userRole');
        if (role === 'Member' || role === 'SuperAdmin' || role === 'GroupAdmin') {
          setUserRole(role);
        }
      } catch (e) {
        console.error('Failed to load user role from storage', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  useAuthRedirect(userRole, isLoading);

  if (!loaded || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F8E9' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 10, fontSize: 16, color: '#333' }}>Loading application...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={{ userRole, setUserRole, isLoading }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="home" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(member)" />
            <Stack.Screen name="(groupadmin)" />
            <Stack.Screen name="(superadmin)" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}

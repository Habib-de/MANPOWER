// components/Header.tsx
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  user: string;
  role: 'Member' | 'GroupAdmin' | 'SuperAdmin';
  onLogout?: () => void;
  onMenuToggle?: () => void;
  onNavigate?: (screen: string) => void;
}

// Same colours as the bottom bars
const ROLE_COLORS: Record<HeaderProps['role'], { main: string; light: string }> = {
  Member: { main: '#4CAF50', light: '#E8F5E9' },
  GroupAdmin: { main: '#1976D2', light: '#E3F2FD' },
  SuperAdmin: { main: '#FB8C00', light: '#FFF3E0' },
};

const Header: React.FC<HeaderProps> = ({ user, role, onLogout, onMenuToggle, onNavigate }) => {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const colors = ROLE_COLORS[role];

  const handleMenuPress = () => {
    if (onMenuToggle) {
      onMenuToggle();
    } else {
      navigation.dispatch(DrawerActions.openDrawer());
    }
  };

  return (
    <View style={styles.header}>
      {/* Left: menu + logo */}
      <View style={styles.leftHeader}>
        <TouchableOpacity onPress={handleMenuPress} style={styles.iconButton} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color="#333" />
        </TouchableOpacity>

        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>
          <Text style={styles.man}>MAN</Text>
          <Text style={styles.power}>POWER</Text>
        </Text>
      </View>

      {/* Right: role, user, actions */}
      <View style={styles.rightHeader}>
        <View style={[styles.roleBadge, { backgroundColor: colors.light }]}>
          <Text style={[styles.roleText, { color: colors.main }]}>{role}</Text>
        </View>

        {isWide && (
          <Text style={styles.userText} numberOfLines={1}>
            {user}
          </Text>
        )}

        {onNavigate && (
          <>
            <TouchableOpacity
              onPress={() => onNavigate('Profile')}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={24} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onNavigate('Settings')}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={22} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onLogout || (() => {})}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#D32F2F" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  iconButton: {
    padding: 6,
  },
  logo: {
    width: 34,
    height: 34,
    marginHorizontal: 6,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  man: {
    color: '#000',
  },
  power: {
    color: '#4CAF50',
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    maxWidth: 140,
    marginRight: 6,
  },
});

export default Header;
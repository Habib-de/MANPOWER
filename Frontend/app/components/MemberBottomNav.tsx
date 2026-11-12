// components/MemberBottomNav.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type NavKey =
  | 'home'
  | 'mycontributions'
  | 'meetings'
  | 'documents'
  | 'notifications'
  | 'Groupchat'
  | 'private-chat'
  | 'loans'
  | 'decision-logs'
  | 'dividends'
  | 'guarantor-requests'
  | 'volunteercontributions'
  | 'profile'
  | 'settings'
  | 'none';

type Props = {
  current: NavKey;
  isDarkMode?: boolean;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// --- MOBILE BOTTOM NAV ITEMS ---
const mobileNavItems: {
  key: NavKey;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  route: string;
}[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/(member)/dashboard' },
  { key: 'mycontributions', label: 'Contributions', icon: 'wallet-outline', activeIcon: 'wallet', route: '/(member)/mycontributions' },
  { key: 'meetings', label: 'Meetings', icon: 'calendar-outline', activeIcon: 'calendar', route: '/(member)/meetings' },
  { key: 'documents', label: 'Documents', icon: 'folder-outline', activeIcon: 'folder', route: '/(member)/documents' },
  { key: 'Groupchat', label: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', route: '/(member)/chat' },
];

// --- DESKTOP SIDEBAR GROUPS ---
const sidebarSections = [
  {
    title: 'Overview',
    icon: 'grid-outline',
    items: [
      { key: 'home', label: 'Dashboard', icon: 'home-outline', route: '/(member)/dashboard' },
      { key: 'profile', label: 'My Profile', icon: 'person-outline', route: '/(member)/profile' },
    ],
  },
  {
    title: 'Finance',
    icon: 'cash-outline',
    items: [
      { key: 'mycontributions', label: 'My Contributions', icon: 'wallet-outline', route: '/(member)/mycontributions' },
      { key: 'loans', label: 'My Loans', icon: 'document-text-outline', route: '/(member)/loans' },
      { key: 'decision-logs', label: 'AI Decisions', icon: 'analytics-outline', route: '/(member)/decision-logs' },
      { key: 'guarantor-requests', label: 'Guarantor Requests', icon: 'shield-checkmark-outline', route: '/(member)/guarantor-requests' },
      { key: 'dividends', label: 'Dividends', icon: 'gift-outline', route: '/(member)/dividends' },
      { key: 'volunteercontributions', label: 'Volunteer Campaigns', icon: 'heart-outline', route: '/(member)/volunteercontributions' },
    ],
  },
  {
    title: 'Engagement',
    icon: 'chatbubbles-outline',
    items: [
      { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', route: '/(member)/notifications' },
      { key: 'meetings', label: 'Meetings', icon: 'calendar-outline', route: '/(member)/meetings' },
      { key: 'Groupchat', label: 'Group Chat', icon: 'chatbubbles-outline', route: '/(member)/chat' },
      { key: 'private-chat', label: 'Private Messages', icon: 'mail-outline', route: '/(member)/private-chat-list' },
      { key: 'documents', label: 'Documents', icon: 'folder-outline', route: '/(member)/documents' },
    ],
  },
  {
    title: 'Account',
    icon: 'person-circle-outline',
    items: [
      { key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/(member)/settings' },
    ],
  },
];

// ─── MOBILE BOTTOM NAV ────────────────────────────────────────────────────────
export default function MemberBottomNav({ current }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) return null;

  return (
    <View style={styles.container}>
      {mobileNavItems.map((item) => {
        const isActive = current === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => router.replace(item.route as any)}
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? '#2E7D32' : '#8A8A8A'}
              />
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── DESKTOP SIDEBAR NAV ──────────────────────────────────────────────────────

// 👇 Module-level cache — persists across remounts
let cachedOpenSections: Record<string, boolean> = {
  'Overview': true,
  'Finance': false,
  'Engagement': false,
  'Account': false,
};

export function MemberDesktopNav({ current, isDarkMode = false }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

    const [openSections, setOpenSectionsState] = useState<Record<string, boolean>>(cachedOpenSections);

  const setOpenSections = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    setOpenSectionsState((prev) => {
      const next = updater(prev);
      cachedOpenSections = next; // 👈 persist to module cache
      return next;
    });
  };

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  if (!isDesktop) return null;

  return (
    <View style={[styles.sidebarContainer, isDarkMode && styles.sidebarDark]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {sidebarSections.map((section) => {
          const isOpen = openSections[section.title];

          return (
            <View key={section.title} style={styles.sidebarSection}>
              <TouchableOpacity
                style={styles.sidebarSectionHeader}
                onPress={() => toggleSection(section.title)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={section.icon as any}
                    size={18}
                    color={isDarkMode ? '#B0B0B0' : '#666'}
                  />
                  <Text
                    style={[
                      styles.sidebarSectionTitle,
                      isDarkMode && { color: '#B0B0B0' },
                    ]}
                  >
                    {section.title}
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={isDarkMode ? '#B0B0B0' : '#888'}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.sidebarItemsContainer}>
                  {section.items.map((item) => {
                    const isActive = current === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => router.replace(item.route as any)}
                        style={[
                          styles.sidebarItem,
                          isActive && styles.sidebarItemActive,
                          isDarkMode && isActive && styles.sidebarItemActiveDark,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={20}
                          color={
                            isActive
                              ? '#2E7D32'
                              : isDarkMode
                              ? '#81C784'
                              : '#555'
                          }
                        />
                        <Text
                          style={[
                            styles.sidebarItemText,
                            isActive && styles.sidebarItemTextActive,
                            isDarkMode && { color: '#B0B0B0' },
                            isActive && isDarkMode && { color: '#81C784' },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- MOBILE STYLES ---
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  indicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginBottom: 6,
  },
  indicatorActive: {
    backgroundColor: '#4CAF50',
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#E8F5E9',
  },
  label: {
    fontSize: 10,
    color: '#8A8A8A',
    fontWeight: '500',
    marginTop: 3,
  },
  activeLabel: {
    color: '#2E7D32',
    fontWeight: '700',
  },

  // --- DESKTOP SIDEBAR STYLES ---
  sidebarContainer: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    paddingVertical: 16,
    paddingHorizontal: 12,
    height: '100%',
  },
  sidebarDark: {
    backgroundColor: '#1E1E1E',
    borderRightColor: '#333',
  },
  sidebarLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sidebarLogo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  sidebarTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sidebarTitleBlack: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  sidebarTitleGreen: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 4,
  },
  sidebarSection: {
    marginBottom: 12,
  },
  sidebarSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sidebarSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginLeft: 8,
  },
  sidebarItemsContainer: {
    marginTop: 4,
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#F0F0F0',
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  sidebarItemActive: {
    backgroundColor: '#E8F5E9',
  },
  sidebarItemActiveDark: {
    backgroundColor: 'rgba(129, 199, 132, 0.1)',
  },
  sidebarItemText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 12,
    fontWeight: '500',
  },
  sidebarItemTextActive: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
});
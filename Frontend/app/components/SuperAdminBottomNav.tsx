// components/SuperAdminBottomNav.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type NavKey =
  | 'home'
  | 'members'
  | 'group-admins'
  | 'finance'
  | 'contribution-report'
  | 'documents'
  | 'meetings'
  | 'schedule-meeting'
  | 'settings'
  | 'profile'
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
  path: string;
}[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', path: '/(superadmin)/dashboard' },
  { key: 'members', label: 'Members', icon: 'people-outline', activeIcon: 'people', path: '/(superadmin)/member-management' },
  { key: 'finance', label: 'Finance', icon: 'cash-outline', activeIcon: 'cash', path: '/(superadmin)/financial-management' },
  { key: 'documents', label: 'Documents', icon: 'folder-outline', activeIcon: 'folder', path: '/(superadmin)/document-management' },
];

// --- DESKTOP SIDEBAR SECTIONS ---
const sidebarSections = [
  {
    title: 'Overview',
    icon: 'grid-outline',
    items: [
      { key: 'home', label: 'Dashboard', icon: 'home-outline', path: '/(superadmin)/dashboard' },
      { key: 'profile', label: 'My Profile', icon: 'person-outline', path: '/(superadmin)/admin-profile' },
    ],
  },
  {
    title: 'User Management',
    icon: 'people-outline',
    items: [
      { key: 'members', label: 'All Members', icon: 'people-outline', path: '/(superadmin)/member-management' },
      { key: 'group-admins', label: 'Group Admins', icon: 'shield-checkmark-outline', path: '/(superadmin)/manage-group-admins' },
    ],
  },
  {
    title: 'Finance',
    icon: 'cash-outline',
    items: [
      { key: 'finance', label: 'Financial Overview', icon: 'stats-chart-outline', path: '/(superadmin)/financial-management' },
      { key: 'contribution-report', label: 'Contribution Reports', icon: 'document-text-outline', path: '/(superadmin)/contribution-report' },
    ],
  },
  {
    title: 'Documents',
    icon: 'folder-outline',
    items: [
      { key: 'documents', label: 'All Documents', icon: 'folder-outline', path: '/(superadmin)/document-management' },
    ],
  },
  {
    title: 'Meetings',
    icon: 'calendar-outline',
    items: [
      { key: 'meetings', label: 'All Meetings', icon: 'calendar-outline', path: '/(superadmin)/meeting-management' },
      { key: 'schedule-meeting', label: 'Schedule Meeting', icon: 'add-circle-outline', path: '/(superadmin)/schedule-meeting' },
    ],
  },
  {
    title: 'System',
    icon: 'settings-outline',
    items: [
      { key: 'settings', label: 'System Settings', icon: 'settings-outline', path: '/(superadmin)/admin-settings' },
    ],
  },
];

// ─── MOBILE BOTTOM NAV ────────────────────────────────────────────────────────
export default function SuperAdminBottomNav({ current }: Props) {
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
            style={styles.navItem}
            onPress={() => router.push(item.path as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? '#E65100' : '#8A8A8A'}
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
  'User Management': false,
  'Finance': false,
  'Documents': false,
  'Meetings': false,
  'System': false,
};

export function SuperAdminDesktopNav({ current, isDarkMode = false }: Props) {
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
                        onPress={() => router.push(item.path as any)}
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
                              ? '#E65100'
                              : isDarkMode
                              ? '#FFB74D'
                              : '#555'
                          }
                        />
                        <Text
                          style={[
                            styles.sidebarItemText,
                            isActive && styles.sidebarItemTextActive,
                            isDarkMode && { color: '#B0B0B0' },
                            isActive && isDarkMode && { color: '#FFB74D' },
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
  indicatorActive: { backgroundColor: '#FB8C00' },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: '#FFF3E0' },
  label: {
    fontSize: 10,
    color: '#8A8A8A',
    fontWeight: '500',
    marginTop: 3,
  },
  activeLabel: {
    color: '#E65100',
    fontWeight: '700',
  },

  // --- DESKTOP SIDEBAR ---
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
  sidebarSection: { marginBottom: 12 },
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
  sidebarItemActive: { backgroundColor: '#FFF3E0' },
  sidebarItemActiveDark: {
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
  },
  sidebarItemText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 12,
    fontWeight: '500',
  },
  sidebarItemTextActive: {
    color: '#E65100',
    fontWeight: 'bold',
  },
});
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type NavKey =
  | 'home'
  | 'create-group'
  | 'manage-groups'
  | 'group-members'
  | 'group-contributions'
  | 'record-contributions'
  | 'record-expenses'
  | 'loan-management'
  | 'chat-monitoring'
  | 'investments'
  | 'dividends'
  | 'mpesa-settings'
  | 'group-settings'
  | 'churn-analysis'
  | 'decision-logs'
  | 'notifications'
  | 'meetings'
  | 'volunteer'
  | 'documents'
  | 'profile'
  | 'settings'
  | 'none';

type Props = {
  current: NavKey;
  isDarkMode?: boolean;
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// --- MOBILE BOTTOM NAV ITEMS ---
const mobileNavItems: { key: NavKey; label: string; icon: IconName; activeIcon: IconName; route: string }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/(groupadmin)/dashboard' },
  { key: 'record-expenses', label: 'Expenses', icon: 'receipt-outline', activeIcon: 'receipt', route: '/(groupadmin)/record-expenses' },
  { key: 'manage-groups', label: 'Groups', icon: 'settings-outline', activeIcon: 'settings', route: '/(groupadmin)/manage-groups' },
  { key: 'group-contributions', label: 'Contributions', icon: 'cash-outline', activeIcon: 'cash', route: '/(groupadmin)/group-contributions' },
  { key: 'loan-management', label: 'Loans', icon: 'document-text-outline', activeIcon: 'document-text', route: '/(groupadmin)/loan-management' },
];

// --- DESKTOP SIDEBAR GROUPS ---
const sidebarSections = [
  {
    title: 'Overview',
    icon: 'grid-outline',
    items: [
      { key: 'home', label: 'Dashboard', icon: 'home-outline', route: '/(groupadmin)/dashboard' },
      { key: 'manage-groups', label: 'Manage Groups', icon: 'business-outline', route: '/(groupadmin)/manage-groups' },
      { key: 'create-group', label: 'Create Group', icon: 'add-circle-outline', route: '/(groupadmin)/create-group' },
      { key: 'group-members', label: 'Members', icon: 'people-outline', route: '/(groupadmin)/group-members' },
    ],
  },
  {
    title: 'Finance & Money',
    icon: 'cash-outline',
    items: [
      { key: 'record-contributions', label: 'Record Contribution', icon: 'cash-outline', route: '/(groupadmin)/record-contributions' },
      { key: 'group-contributions', label: 'Contributions Report', icon: 'pie-chart-outline', route: '/(groupadmin)/group-contributions' },
      { key: 'record-expenses', label: 'Record Expenses', icon: 'receipt-outline', route: '/(groupadmin)/record-expenses' },
      { key: 'loan-management', label: 'Loan Management', icon: 'document-text-outline', route: '/(groupadmin)/loan-management' },
      { key: 'investments', label: 'Investments', icon: 'trending-up-outline', route: '/(groupadmin)/investments' },
      { key: 'dividends', label: 'Dividends', icon: 'gift-outline', route: '/(groupadmin)/admin-dividends' },
      { key: 'mpesa-settings', label: 'M-PESA Settings', icon: 'phone-portrait-outline', route: '/(groupadmin)/mpesa-settings' },
      { key: 'group-settings', label: 'Group Settings', icon: 'settings-outline', route: '/(groupadmin)/group-settings' },
    ],
  },
  {
    title: 'AI & Intelligence',
    icon: 'sparkles-outline',
    items: [
      { key: 'churn-analysis', label: 'Churn Analysis', icon: 'bar-chart-outline', route: '/(groupadmin)/churn-analysis' },
      { key: 'decision-logs', label: 'AI Decision Logs', icon: 'analytics-outline', route: '/(groupadmin)/decision-logs' },
    ],
  },
  {
    title: 'Engagement',
    icon: 'chatbubbles-outline',
    items: [
      { key: 'notifications', label: 'Send Notifications', icon: 'notifications-outline', route: '/(groupadmin)/notifications' },
      { key: 'chat-monitoring', label: 'Monitor Chats', icon: 'chatbubbles-outline', route: '/(groupadmin)/monitor' },
      { key: 'meetings', label: 'Meetings', icon: 'calendar-outline', route: '/(groupadmin)/meetings' },
      { key: 'volunteer', label: 'Volunteer Campaigns', icon: 'heart-outline', route: '/(groupadmin)/create-campaign' },
      { key: 'documents', label: 'Documents', icon: 'document-outline', route: '/(groupadmin)/document-management' },
    ],
  },
  {
    title: 'Account',
    icon: 'person-circle-outline',
    items: [
      { key: 'profile', label: 'My Profile', icon: 'person-outline', route: '/(groupadmin)/group-admin-profile' },
      { key: 'settings', label: 'App Settings', icon: 'settings-outline', route: '/(groupadmin)/settings' },
    ],
  },
];

// ─── MOBILE BOTTOM NAV ────────────────────────────────────────────────────────
export default function GroupAdminBottomNav({ current }: Props) {
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
              <Ionicons name={isActive ? item.activeIcon : item.icon} size={22} color={isActive ? '#1565C0' : '#8A8A8A'} />
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
  'Finance & Money': false,
  'AI & Intelligence': false,
  'Engagement': false,
  'Account': false,
};
export function GroupAdminDesktopNav({ current, isDarkMode = false }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

    // State — initialized from module cache so it survives remounts
  const [openSections, setOpenSectionsState] = useState<Record<string, boolean>>(cachedOpenSections);

  const setOpenSections = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    setOpenSectionsState((prev) => {
      const next = updater(prev);
      cachedOpenSections = next; // 👈 persist to module cache
      return next;
    });
  };

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  if (!isDesktop) return null;

  return (
    <View style={[styles.sidebarContainer, isDarkMode && styles.sidebarDark]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* <Text style={[styles.sidebarHeading, isDarkMode && { color: '#90CAF9' }]}>MENU</Text> */}
        
        {sidebarSections.map((section) => {
          const isOpen = openSections[section.title];
          
          return (
            <View key={section.title} style={styles.sidebarSection}>
              {/* Section Header / Dropdown Toggle */}
              <TouchableOpacity 
                style={styles.sidebarSectionHeader} 
                onPress={() => toggleSection(section.title)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={section.icon as any} size={18} color={isDarkMode ? '#B0B0B0' : '#666'} />
                  <Text style={[styles.sidebarSectionTitle, isDarkMode && { color: '#B0B0B0' }]}>
                    {section.title}
                  </Text>
                </View>
                <Ionicons 
                  name={isOpen ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color={isDarkMode ? '#B0B0B0' : '#888'} 
                />
              </TouchableOpacity>

              {/* Section Items */}
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
                          color={isActive ? '#1565C0' : (isDarkMode ? '#90CAF9' : '#555')} 
                        />
                        <Text 
                          style={[
                            styles.sidebarItemText, 
                            isActive && styles.sidebarItemTextActive,
                            isDarkMode && { color: '#B0B0B0' },
                            isActive && isDarkMode && { color: '#90CAF9' }
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
    backgroundColor: '#1976D2',
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#E3F2FD',
  },
  label: {
    fontSize: 10,
    color: '#8A8A8A',
    fontWeight: '500',
    marginTop: 3,
  },
  activeLabel: {
    color: '#1565C0',
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
  sidebarHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 8,
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
    backgroundColor: '#E3F2FD',
  },
  sidebarItemActiveDark: {
    backgroundColor: 'rgba(144, 202, 249, 0.1)',
  },
  sidebarItemText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 12,
    fontWeight: '500',
  },
  sidebarItemTextActive: {
    color: '#1565C0',
    fontWeight: 'bold',
  },
});
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://192.168.0.102:8080/api';

const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

type Group = {
  id: string;
  groupName: string;
  creationDate: string;
  status: 'Active' | 'Terminated';
};

type GroupStats = {
  totalMembers: number;
  pendingContributions: number;
  pendingAmount: number;
  overdueCount: number;
  hasSettings: boolean;
  hasActiveLoans: boolean;
  loanCount: number;
};

// ─────────────────────────────────────────────────────────────
// Reusable action row ("full sentence → arrow")
// ─────────────────────────────────────────────────────────────
function ActionRow({
  icon,
  label,
  onPress,
  destructive,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, disabled && styles.actionRowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={18}
        color={disabled ? '#BDBDBD' : destructive ? '#D32F2F' : '#1565C0'}
        style={{ marginRight: 10 }}
      />
      <Text
        style={[
          styles.actionRowText,
          destructive && styles.actionRowDestructive,
          disabled && styles.actionRowTextDisabled,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.actionRowArrow,
          disabled && { color: '#BDBDBD' },
        ]}
      >
        {disabled ? '🔒' : '→'}
      </Text>
    </TouchableOpacity>
  );
}

function ManageGroupsScreen(): React.JSX.Element {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupStats, setGroupStats] = useState<Record<string, GroupStats>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allLoans, setAllLoans] = useState<any[]>([]);

  const fetchGroups = async () => {
    try {
      const groupAdminId = await AsyncStorage.getItem('userId');
      if (!groupAdminId) throw new Error('No GroupAdmin ID found');

      const [groupsRes, loansRes] = await Promise.all([
        fetch(`${API_BASE_URL}/groups/groupadmin/${groupAdminId}`),
        fetch(`${API_BASE_URL}/loans`),
      ]);

      const data = await groupsRes.json();
      const loansData = loansRes.ok ? await loansRes.json() : [];
      setAllLoans(loansData);
      console.log(`✅ Fetched ${loansData.length} total loans`);

      const formatted: Group[] = data.map((group: any) => ({
        id: group.id,
        groupName: group.groupName,
        creationDate: group.creationDate,
        status: group.status || 'Active',
      }));
      setGroups(formatted);

      await fetchStatsForGroups(formatted, loansData);
    } catch (error) {
      console.error('Failed to load groups:', error);
      showAlert('Error', 'Could not fetch groups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStatsForGroups = async (groupsList: Group[], loansList: any[]) => {
    const statsMap: Record<string, GroupStats> = {};

    for (const group of groupsList) {
      try {
        const membersRes = await fetch(`${API_BASE_URL}/members/by-group/${group.id}`);
        const members = membersRes.ok ? await membersRes.json() : [];
        const totalMembers = members.filter((m: any) => m.status === 'Active').length;
        const memberIds = members.map((m: any) => m.id);

        const groupLoans = loansList.filter((loan: any) =>
          memberIds.includes(loan.member?.id)
        );
        const activeLoans = groupLoans.filter(
          (loan: any) =>
            (loan.status === 'PENDING' ||
              loan.status === 'APPROVED' ||
              loan.status === 'ACTIVE') &&
            loan.outstandingBalance > 0
        );
        const hasActiveLoans = activeLoans.length > 0;
        const loanCount = activeLoans.length;

        const contributionsRes = await fetch(
          `${API_BASE_URL}/contributions/group/${group.id}`
        );
        let pendingCount = 0;
        let pendingAmount = 0;
        let overdueCount = 0;

        if (contributionsRes.ok) {
          const contributions = await contributionsRes.json();
          const pending = contributions.filter((c: any) => c.status === 'Pending');
          pendingCount = pending.length;
          pendingAmount = pending.reduce(
            (sum: number, c: any) => sum + c.amount,
            0
          );

          const today = new Date();
          overdueCount = pending.filter((c: any) => {
            if (c.dueDate) return new Date(c.dueDate) < today;
            return false;
          }).length;
        }

        const settingsRes = await fetch(
          `${API_BASE_URL}/groups/${group.id}/settings`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        const hasSettings =
          settingsRes.ok &&
          (await settingsRes.json()).settings?.contributionFrequency;

        statsMap[group.id] = {
          totalMembers,
          pendingContributions: pendingCount,
          pendingAmount,
          overdueCount,
          hasSettings: !!hasSettings,
          hasActiveLoans,
          loanCount,
        };
      } catch (error) {
        console.error(`Error fetching stats for group ${group.id}:`, error);
        statsMap[group.id] = {
          totalMembers: 0,
          pendingContributions: 0,
          pendingAmount: 0,
          overdueCount: 0,
          hasSettings: false,
          hasActiveLoans: false,
          loanCount: 0,
        };
      }
    }

    setGroupStats(statsMap);
  };

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const canTerminateGroup = (
    stats: GroupStats
  ): { canTerminate: boolean; reason: string } => {
    if (stats.pendingContributions > 0) {
      return {
        canTerminate: false,
        reason: `Cannot terminate group because there ${
          stats.pendingContributions === 1 ? 'is' : 'are'
        } ${stats.pendingContributions} pending contribution${
          stats.pendingContributions === 1 ? '' : 's'
        } that ${
          stats.pendingContributions === 1 ? 'has' : 'have'
        } not been paid.`,
      };
    }
    if (stats.hasActiveLoans) {
      return {
        canTerminate: false,
        reason: `Cannot terminate group because there ${
          stats.loanCount === 1 ? 'is' : 'are'
        } ${stats.loanCount} active loan${
          stats.loanCount === 1 ? '' : 's'
        } that ${stats.loanCount === 1 ? 'has' : 'have'} not been fully repaid.`,
      };
    }
    return { canTerminate: true, reason: '' };
  };

  const handleTerminateGroup = (
    groupId: string,
    groupName: string,
    stats: GroupStats
  ) => {
    const { canTerminate, reason } = canTerminateGroup(stats);

    if (!canTerminate) {
      showAlert('Cannot Terminate', reason);
      return;
    }

    const Alert = require('react-native').Alert;
    Alert.alert(
      'Confirm Termination',
      `Are you sure you want to terminate group "${groupName}"?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/groups/${groupId}/terminate`,
                { method: 'PUT' }
              );
              if (!response.ok) throw new Error('Failed to terminate group');

              const updatedGroup = await response.json();
              setGroups((prev) =>
                prev.map((group) =>
                  group.id === updatedGroup.id
                    ? { ...group, status: updatedGroup.status }
                    : group
                )
              );
              showAlert(
                'Success',
                `Group "${groupName}" has been terminated successfully.`
              );
            } catch (error) {
              console.error('Failed to terminate group:', error);
              showAlert('Error', 'Failed to terminate the group. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Card renderer — info block + question + always-visible actions
  // ─────────────────────────────────────────────────────────────
  const renderGroupItem = ({ item }: { item: Group }) => {
    const stats = groupStats[item.id] || {
      totalMembers: 0,
      pendingContributions: 0,
      pendingAmount: 0,
      overdueCount: 0,
      hasSettings: false,
      hasActiveLoans: false,
      loanCount: 0,
    };

    const isActive = item.status === 'Active';
    const isTerminated = item.status === 'Terminated';
    const { canTerminate, reason } = canTerminateGroup(stats);

    return (
      <View style={[styles.groupCard, !isActive && !isTerminated && styles.inactiveCard]}>
        {/* ── GROUP INFO (left alone) ── */}
        <View style={styles.groupHeader}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.groupName}
          </Text>
          <View
            style={[
              styles.statusBadge,
              isActive ? styles.activeBadge : styles.terminatedBadge,
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.groupMeta}>
          📅 Created {formatDate(item.creationDate)}
        </Text>

        <View style={styles.statsLine}>
          <Text style={styles.statChip}>
            👥 {stats.totalMembers} member{stats.totalMembers !== 1 ? 's' : ''}
          </Text>
          {stats.pendingContributions > 0 && (
            <Text style={[styles.statChip, styles.warnChip]}>
              💰 {stats.pendingContributions} pending
            </Text>
          )}
          {stats.overdueCount > 0 && (
            <Text style={[styles.statChip, styles.dangerChip]}>
              ⏰ {stats.overdueCount} overdue
            </Text>
          )}
          {stats.hasActiveLoans && (
            <Text style={[styles.statChip, styles.warnChip]}>
              ⚠️ {stats.loanCount} loan{stats.loanCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {stats.pendingAmount > 0 && (
          <Text style={styles.pendingAmountText}>
            💰 Pending: KES {stats.pendingAmount.toLocaleString()}
          </Text>
        )}

        {/* ── QUESTION + ACTIONS (always visible) ── */}
        {!isTerminated ? (
          <View style={styles.actionsBlock}>
            <Text style={styles.questionText}>
              What would you like to do today?
            </Text>

            <ActionRow
              icon="cash-outline"
              label="Record a contribution for a member"
              onPress={() =>
                router.push({
                  pathname: '/(groupadmin)/record-contributions',
                  params: { groupId: item.id, groupName: item.groupName },
                })
              }
            />
            <ActionRow
              icon="people-outline"
              label="Manage group members"
              onPress={() =>
                router.push({
                  pathname: '/(groupadmin)/group-members',
                  params: { groupId: item.id, groupName: item.groupName },
                })
              }
            />
            <ActionRow
              icon="settings-outline"
              label="Change contribution settings"
              onPress={() =>
                router.push({
                  pathname: '/(groupadmin)/group-settings',
                  params: { groupId: item.id, groupName: item.groupName },
                })
              }
            />
            <ActionRow
              icon="phone-portrait-outline"
              label="Configure M-PESA"
              onPress={() =>
                router.push({
                  pathname: '/(groupadmin)/mpesa-settings',
                  params: { groupId: item.id, groupName: item.groupName },
                })
              }
            />
            <ActionRow
              icon="close-circle-outline"
              label={
                canTerminate
                  ? 'Terminate this group'
                  : 'Cannot terminate — tap to see why'
              }
              destructive
              onPress={() => {
                if (!canTerminate) {
                  showAlert('Cannot Terminate', reason);
                } else {
                  handleTerminateGroup(item.id, item.groupName, stats);
                }
              }}
            />
          </View>
        ) : (
          <View style={styles.terminatedMessage}>
            <Text style={styles.terminatedMessageText}>
              This group has been terminated.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const filteredGroups = groups.filter((group) =>
    group.groupName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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

      {/* Main content */}
      <View style={styles.container}>
        <Text style={styles.title}>Manage Groups</Text>
        <TextInput
          placeholder="🔍 Search group name..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#1565C0" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#1565C0']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="albums-outline" size={48} color="#90CAF9" />
                <Text style={styles.noResultsText}>
                  {searchQuery
                    ? 'No matching groups found.'
                    : 'You have not created any groups yet.'}
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <GroupAdminBottomNav current="manage-groups" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  logo: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
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
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 16,
  },

  // ── Group Card ──────────────────────────────────────────────
  groupCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  inactiveCard: {
    backgroundColor: '#FFF8E1',
    opacity: 0.9,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: { backgroundColor: '#4CAF50' },
  terminatedBadge: { backgroundColor: '#F44336' },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  groupMeta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },

  // ── Stats chips ─────────────────────────────────────────────
  statsLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statChip: {
    fontSize: 12,
    color: '#555',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  warnChip: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
  },
  dangerChip: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
  },
  pendingAmountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 10,
  },

  // ── Question + Actions block ────────────────────────────────
  actionsBlock: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565C0',
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  actionRowDisabled: { opacity: 0.55 },
  actionRowText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  actionRowTextDisabled: { color: '#999' },
  actionRowDestructive: {
    color: '#D32F2F',
    fontWeight: '600',
  },
  actionRowArrow: {
    fontSize: 16,
    color: '#1565C0',
    marginLeft: 8,
  },

  // ── Terminated note ─────────────────────────────────────────
  terminatedMessage: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  terminatedMessageText: {
    color: '#C62828',
    fontSize: 12,
    textAlign: 'center',
  },

  // ── Empty state ─────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default ManageGroupsScreen;
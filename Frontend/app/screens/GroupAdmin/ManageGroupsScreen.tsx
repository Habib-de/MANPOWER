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
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://192.168.0.101:8080/api';

// Same alert style as your other screens
const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [
      { text: 'OK', onPress: onOk }
    ]);
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
        fetch(`${API_BASE_URL}/loans`)
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
        // Get members for this group
        const membersRes = await fetch(`${API_BASE_URL}/members/by-group/${group.id}`);
        const members = membersRes.ok ? await membersRes.json() : [];
        const totalMembers = members.filter((m: any) => m.status === 'Active').length;
        
        // Get all member IDs in this group
        const memberIds = members.map((m: any) => m.id);
        
        // Filter loans for this group by member IDs
        const groupLoans = loansList.filter((loan: any) => 
          memberIds.includes(loan.member?.id)
        );
        
        // Check for active loans - USE UPPERCASE TO MATCH DATABASE
        const activeLoans = groupLoans.filter((loan: any) => 
          (loan.status === 'PENDING' || loan.status === 'APPROVED' || loan.status === 'ACTIVE') &&
          loan.outstandingBalance > 0
        );
        const hasActiveLoans = activeLoans.length > 0;
        const loanCount = activeLoans.length;
        
        console.log(`Group ${group.groupName}: ${groupLoans.length} total loans, ${loanCount} active loans (status: ${activeLoans.map(l => l.status).join(', ') || 'none'})`);
        
        // Get contributions summary
        const contributionsRes = await fetch(`${API_BASE_URL}/contributions/group/${group.id}`);
        let pendingCount = 0;
        let pendingAmount = 0;
        let overdueCount = 0;
        
        if (contributionsRes.ok) {
          const contributions = await contributionsRes.json();
          const pending = contributions.filter((c: any) => c.status === 'Pending');
          pendingCount = pending.length;
          pendingAmount = pending.reduce((sum: number, c: any) => sum + c.amount, 0);
          
          const today = new Date();
          overdueCount = pending.filter((c: any) => {
            if (c.dueDate) return new Date(c.dueDate) < today;
            return false;
          }).length;
        }
        
        // Check if group has contribution settings
        const settingsRes = await fetch(`${API_BASE_URL}/groups/${group.id}/settings`, {
          headers: { 'Content-Type': 'application/json' }
        });
        const hasSettings = settingsRes.ok && (await settingsRes.json()).settings?.contributionFrequency;
        
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

  const canTerminateGroup = (stats: GroupStats): { canTerminate: boolean; reason: string } => {
    if (stats.pendingContributions > 0) {
      return { 
        canTerminate: false, 
        reason: `Cannot terminate group because there ${stats.pendingContributions === 1 ? 'is' : 'are'} ${stats.pendingContributions} pending contribution${stats.pendingContributions === 1 ? '' : 's'} that ${stats.pendingContributions === 1 ? 'has' : 'have'} not been paid.` 
      };
    }
    if (stats.hasActiveLoans) {
      return { 
        canTerminate: false, 
        reason: `Cannot terminate group because there ${stats.loanCount === 1 ? 'is' : 'are'} ${stats.loanCount} active loan${stats.loanCount === 1 ? '' : 's'} that ${stats.loanCount === 1 ? 'has' : 'have'} not been fully repaid.` 
      };
    }
    return { canTerminate: true, reason: '' };
  };

  const handleTerminateGroup = (groupId: string, groupName: string, stats: GroupStats) => {
    const { canTerminate, reason } = canTerminateGroup(stats);
    
    if (!canTerminate) {
      showAlert('Cannot Terminate', reason);
      return;
    }
    
    // Confirm termination with custom alert style
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
              const response = await fetch(`${API_BASE_URL}/groups/${groupId}/terminate`, {
                method: 'PUT',
              });
              if (!response.ok) throw new Error('Failed to terminate group');

              const updatedGroup = await response.json();
              setGroups((prev) =>
                prev.map((group) =>
                  group.id === updatedGroup.id ? { ...group, status: updatedGroup.status } : group
                )
              );
              showAlert('Success', `Group "${groupName}" has been terminated successfully.`);
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
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

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
    const { canTerminate } = canTerminateGroup(stats);
    
    return (
      <View style={[styles.groupCard, !isActive && !isTerminated && styles.inactiveCard]}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{item.groupName}</Text>
          <View style={[
            styles.statusBadge,
            isActive ? styles.activeBadge : styles.terminatedBadge
          ]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        
        <Text style={styles.groupMeta}>📅 Created: {formatDate(item.creationDate)}</Text>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalMembers}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, stats.pendingContributions > 0 && styles.pendingNumber]}>
              {stats.pendingContributions}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, stats.overdueCount > 0 && styles.overdueNumber]}>
              {stats.overdueCount}
            </Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
        </View>
        
        {/* Active Loans Warning */}
        {stats.hasActiveLoans && (
          <View style={styles.loanWarning}>
            <Text style={styles.loanWarningText}>
              ⚠️ {stats.loanCount} active loan{stats.loanCount !== 1 ? 's' : ''} pending repayment
            </Text>
          </View>
        )}
        
        {/* Pending Amount if any */}
        {stats.pendingAmount > 0 && (
          <Text style={styles.pendingAmountText}>
            💰 Pending Amount: KES {stats.pendingAmount.toLocaleString()}
          </Text>
        )}
        
        {/* Action Buttons - Updated with M-PESA button */}
        {!isTerminated && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.settingsButton]}
              onPress={() => router.push({
                pathname: '/(groupadmin)/group-settings',
                params: { groupId: item.id, groupName: item.groupName }
              })}
            >
              <Text style={styles.actionButtonText}>⚙️ Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.membersButton]}
              onPress={() => router.push({
                pathname: '/(groupadmin)/group-members',
                params: { groupId: item.id, groupName: item.groupName }
              })}
            >
              <Text style={styles.actionButtonText}>👥 Members</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.recordButton]}
              onPress={() => router.push({
                pathname: '/(groupadmin)/record-contributions',
                params: { groupId: item.id, groupName: item.groupName }
              })}
            >
              <Text style={styles.actionButtonText}>💰 Record</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* M-PESA Settings - New row */}
        {!isTerminated && (
          <TouchableOpacity
            style={styles.mpesaButton}
            onPress={() => router.push({
              pathname: '/(groupadmin)/mpesa-settings',
              params: { groupId: item.id, groupName: item.groupName }
            })}
          >
            <Text style={styles.mpesaButtonText}>💳 Configure M-PESA</Text>
          </TouchableOpacity>
        )}
        
        {/* Terminate Button - only show if active and can terminate */}
        {isActive && (
          <TouchableOpacity
            style={[
              styles.terminateButton,
              !canTerminate && styles.terminateButtonDisabled
            ]}
            onPress={() => handleTerminateGroup(item.id, item.groupName, stats)}
            disabled={!canTerminate}
          >
            <Text style={styles.terminateText}>
              {!canTerminate ? '🔒 Cannot Terminate' : '❌ Terminate Group'}
            </Text>
          </TouchableOpacity>
        )}
        
        {isTerminated && (
          <View style={styles.terminatedMessage}>
            <Text style={styles.terminatedMessageText}>
              ⚠️ This group has been terminated.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const filteredGroups = groups.filter(group =>
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
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1565C0']} />
            }
            ListEmptyComponent={
              <Text style={styles.noResultsText}>
                {searchQuery ? 'No matching groups found.' : 'No groups found.'}
              </Text>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Bottom nav */}
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
  groupCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inactiveCard: {
    backgroundColor: '#FFF8E1',
    opacity: 0.9,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
  },
  terminatedBadge: {
    backgroundColor: '#F44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  groupMeta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pendingNumber: {
    color: '#FF9800',
  },
  overdueNumber: {
    color: '#F44336',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  loanWarning: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  loanWarningText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500',
  },
  pendingAmountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  settingsButton: {
    backgroundColor: '#9C27B0',
  },
  membersButton: {
    backgroundColor: '#2196F3',
  },
  recordButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  // NEW: M-PESA Button
  mpesaButton: {
    backgroundColor: '#00695C',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#004D40',
  },
  mpesaButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  terminateButton: {
    marginTop: 5,
    backgroundColor: '#F44336',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  terminateButtonDisabled: {
    backgroundColor: '#EF9A9A',
  },
  terminateText: {
    color: '#fff',
    fontWeight: '600',
  },
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
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 30,
  },
});

export default ManageGroupsScreen;
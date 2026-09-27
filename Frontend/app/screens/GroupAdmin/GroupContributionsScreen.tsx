import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthContext } from '../../../app/_layout';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

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

interface Member {
  id: string;
  firstName: string;
  lastName: string;
}

interface Contribution {
  id: string;
  amount: number;
  transactionDate: string;
  paymentDate?: string;
  dueDate?: string;
  paymentMethod: string;
  status: string;
  isLate?: boolean;
  daysLate?: number;
  penaltyApplied?: number;
  member?: Member;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  dateIncurred: string;
  group: { id: string } | string;
}

interface Group {
  id: string;
  groupName: string;
  contributions: Contribution[];
  totalAmount: number;
  pendingAmount: number;
  overdueCount: number;
  expenses: Expense[];
  totalExpenses: number;
  totalInvested: number;  // ✅ Added this
  currentBalance: number;
}

export default function GroupContributionsScreen() {
  const router = useRouter();
  const { setUserRole } = useContext(AuthContext)!;
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [uniqueMembers, setUniqueMembers] = useState<Map<string, Member>>(new Map());
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      fetchGroupContributions();
    }, [])
  );

  const fetchGroupContributions = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        setLoading(false);
        return;
      }

      const groupRes = await fetch(`${BASE_URL}/groups/groupadmin/${userId}`);
      if (!groupRes.ok) throw new Error('Failed to fetch groups');

      const groupData = await groupRes.json();
      const updatedGroups: Group[] = [];
      const allMembersMap = new Map<string, Member>();
      const allYearsSet = new Set<string>();

      const expensesRes = await fetch(`${BASE_URL}/expenses`);
      const allExpenses: Expense[] = expensesRes.ok ? await expensesRes.json() : [];

      for (const group of groupData) {
        const contributionRes = await fetch(`${BASE_URL}/contributions/group/${group.id}`);
        let allContributions: Contribution[] = [];
        let totalAmount = 0;
        let pendingAmount = 0;
        let overdueCount = 0;

        if (contributionRes.ok) {
          allContributions = await contributionRes.json();
          
          allContributions.forEach(contrib => {
            if (contrib.member && contrib.member.id) {
              allMembersMap.set(contrib.member.id, contrib.member);
            }
            
            const dateToCheck = contrib.transactionDate || contrib.dueDate;
            if (dateToCheck) {
              const year = new Date(dateToCheck).getFullYear();
              if (!isNaN(year)) {
                allYearsSet.add(year.toString());
              }
            }
          });
          
          const completed = allContributions.filter(c => c.status === 'Completed');
          const pending = allContributions.filter(c => c.status === 'Pending');
          
          totalAmount = completed.reduce((sum, c) => sum + c.amount, 0);
          pendingAmount = pending.reduce((sum, c) => sum + c.amount, 0);
          
          const today = new Date();
          overdueCount = pending.filter(c => {
            if (c.dueDate) {
              return new Date(c.dueDate) < today;
            }
            return false;
          }).length;
        }

        const groupExpenses = allExpenses.filter((expense: Expense) => {
          if (typeof expense.group === 'object' && expense.group !== null) {
            return expense.group.id === group.id;
          }
          return expense.group === group.id;
        });
        const totalExpenses = groupExpenses.reduce((sum, expense) => sum + expense.amount, 0);

        // ✅ Fetch investments for this specific group using the dedicated endpoint
        const investmentsRes = await fetch(`${BASE_URL}/investments/group/${group.id}`);
        let totalInvested = 0;
        
        if (investmentsRes.ok) {
          const investments = await investmentsRes.json();
          console.log(`📊 Investments for ${group.groupName}:`, investments);
          
          // Calculate total invested - sum ALL investments regardless of status
          totalInvested = investments.reduce((sum: number, inv: any) => {
            return sum + (inv.amountInvested || 0);
          }, 0);
          
          console.log(`💰 Total invested for ${group.groupName}: KES ${totalInvested}`);
        }

        // ✅ Calculate balance: Contributions - Expenses - Investments
        const currentBalance = totalAmount - totalExpenses - totalInvested;

        updatedGroups.push({
          id: group.id,
          groupName: group.groupName,
          contributions: allContributions,
          totalAmount,
          pendingAmount,
          overdueCount,
          expenses: groupExpenses,
          totalExpenses,
          totalInvested,  // ✅ Added this
          currentBalance,
        });
      }

      setGroups(updatedGroups);
      setUniqueMembers(allMembersMap);
      const yearsArray = Array.from(allYearsSet).sort().reverse();
      setAvailableYears(yearsArray);
      
    } catch (err) {
      console.error('Error fetching group contributions:', err);
      showAlert('Error', 'Failed to fetch group contributions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...groups];
    
    if (showPendingOnly) {
      filtered = filtered.map(group => ({
        ...group,
        contributions: group.contributions.filter(c => c.status === 'Pending')
      })).filter(group => group.contributions.length > 0);
    }
    
    if (selectedYear !== 'all') {
      filtered = filtered.map(group => ({
        ...group,
        contributions: group.contributions.filter(contrib => {
          const dateToCheck = contrib.transactionDate || contrib.dueDate;
          if (dateToCheck) {
            const year = new Date(dateToCheck).getFullYear();
            return year.toString() === selectedYear;
          }
          return false;
        })
      })).filter(group => group.contributions.length > 0);
    }
    
    if (selectedMemberId !== 'all') {
      filtered = filtered.map(group => ({
        ...group,
        contributions: group.contributions.filter(contrib => 
          contrib.member?.id === selectedMemberId
        )
      })).filter(group => group.contributions.length > 0);
    }
    
    if (searchQuery !== '') {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered
        .map((group) => {
          const filteredContributions = group.contributions.filter((contrib) => {
            const memberName = contrib.member
              ? `${contrib.member.firstName} ${contrib.member.lastName}`.toLowerCase()
              : '';
            const paymentMethod = contrib.paymentMethod?.toLowerCase() || '';
            const transactionDate = new Date(contrib.transactionDate || contrib.dueDate || '').toDateString().toLowerCase();
            const amount = contrib.amount.toLocaleString().toLowerCase();
            const status = contrib.status?.toLowerCase() || '';
            const dueDate = contrib.dueDate ? new Date(contrib.dueDate).toDateString().toLowerCase() : '';

            return (
              group.groupName.toLowerCase().includes(lowercasedQuery) ||
              memberName.includes(lowercasedQuery) ||
              paymentMethod.includes(lowercasedQuery) ||
              transactionDate.includes(lowercasedQuery) ||
              amount.includes(lowercasedQuery) ||
              status.includes(lowercasedQuery) ||
              dueDate.includes(lowercasedQuery)
            );
          });

          if (filteredContributions.length > 0) {
            return {
              ...group,
              contributions: filteredContributions,
            };
          }
          return null;
        })
        .filter(Boolean) as Group[];
    }
    
    setFilteredGroups(filtered);
  }, [searchQuery, groups, showPendingOnly, selectedYear, selectedMemberId]);

  const calculateMemberTotal = (group: Group): number => {
    return group.contributions.reduce((sum, contrib) => sum + contrib.amount, 0);
  };

  const calculateOverallTotal = (): number => {
    let total = 0;
    filteredGroups.forEach(group => {
      total += calculateMemberTotal(group);
    });
    return total;
  };

  const calculateTotalContributionsCount = (): number => {
    return filteredGroups.reduce((count, group) => count + group.contributions.length, 0);
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusBadge = (status: string, isLate?: boolean, dueDate?: string) => {
    if (status === 'Completed') {
      return { text: '✅ PAID', color: '#4CAF50', bgColor: '#E8F5E9' };
    } else if (status === 'Pending') {
      if (isLate || (dueDate && new Date(dueDate) < new Date())) {
        return { text: '⚠️ OVERDUE', color: '#F44336', bgColor: '#FFEBEE' };
      }
      return { text: '⏳ PENDING', color: '#FF9800', bgColor: '#FFF3E0' };
    }
    return { text: status, color: '#666', bgColor: '#F5F5F5' };
  };

  const getSelectedMemberName = (): string => {
    if (selectedMemberId === 'all') return 'All Members';
    const member = uniqueMembers.get(selectedMemberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Select Member';
  };

  const showMemberFilterOptions = () => {
    const memberOptions = Array.from(uniqueMembers.values()).map(m => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`
    }));
    
    const buttons = [
      { text: 'All Members', onPress: () => setSelectedMemberId('all') },
      ...memberOptions.map(m => ({
        text: m.name,
        onPress: () => setSelectedMemberId(m.id)
      })),
      { text: 'Cancel', onPress: () => {}, style: 'cancel' as const }
    ];
    
    if (Platform.OS === 'web') {
      const options = memberOptions.map(m => `${m.name}`).join('\n');
      const result = window.prompt(`Select Member:\n${options}\n\nType the member name exactly as shown:`);
      if (result) {
        const foundMember = memberOptions.find(m => m.name.toLowerCase() === result.toLowerCase());
        if (foundMember) {
          setSelectedMemberId(foundMember.id);
        } else if (result.toLowerCase() === 'all members') {
          setSelectedMemberId('all');
        } else {
          showAlert('Invalid Selection', 'Please select a valid member from the list');
        }
      }
    } else {
      const Alert = require('react-native').Alert;
      Alert.alert(
        'Select Member',
        'Choose a member to filter contributions',
        buttons,
        { cancelable: true }
      );
    }
  };

  const showYearFilterOptions = () => {
    const yearButtons = [
      { text: 'All Years', onPress: () => setSelectedYear('all') },
      ...availableYears.map(year => ({
        text: year,
        onPress: () => setSelectedYear(year)
      })),
      { text: 'Cancel', onPress: () => {}, style: 'cancel' as const }
    ];
    
    if (Platform.OS === 'web') {
      const options = availableYears.join('\n');
      const result = window.prompt(`Select Year:\n${options}\n\nType the year:`);
      if (result) {
        if (result.toLowerCase() === 'all years') {
          setSelectedYear('all');
        } else if (availableYears.includes(result)) {
          setSelectedYear(result);
        } else {
          showAlert('Invalid Selection', 'Please select a valid year from the list');
        }
      }
    } else {
      const Alert = require('react-native').Alert;
      Alert.alert(
        'Select Year',
        'Choose a year to filter contributions',
        yearButtons,
        { cancelable: true }
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.appTitleContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleGreen}>POWER</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.headerButtonText}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Group Contributions</Text>
        
        <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => router.push('/(superadmin)/contribution-report')}
          >
            <Text style={styles.reportButtonText}>📊 View Detailed Report</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.searchWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity 
            style={styles.filterWrapper}
            onPress={showMemberFilterOptions}
          >
            <View style={styles.filterButton}>
              <Text style={styles.filterButtonLabel}>Member</Text>
              <Text style={styles.filterButtonValue} numberOfLines={1}>
                {getSelectedMemberName()}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.filterWrapper}
            onPress={showYearFilterOptions}
          >
            <View style={styles.filterButton}>
              <Text style={styles.filterButtonLabel}>Year</Text>
              <Text style={styles.filterButtonValue}>
                {selectedYear === 'all' ? 'All Years' : selectedYear}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.toggleButton, showPendingOnly && styles.toggleButtonActive]}
          onPress={() => setShowPendingOnly(!showPendingOnly)}
        >
          <Text style={[styles.toggleText, showPendingOnly && styles.toggleTextActive]}>
            {showPendingOnly ? '📋 Showing Pending Only' : '🔽 Show Pending Only'}
          </Text>
        </TouchableOpacity>

        {(selectedYear !== 'all' || selectedMemberId !== 'all' || showPendingOnly || searchQuery) && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setSelectedYear('all');
              setSelectedMemberId('all');
              setShowPendingOnly(false);
              setSearchQuery('');
            }}
          >
            <Text style={styles.resetButtonText}>🔄 Reset All Filters</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" />
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contributions found</Text>
            <Text style={styles.emptySubtext}>Try different filters or record a contribution</Text>
          </View>
        ) : (
          <>
            {(selectedMemberId !== 'all' || selectedYear !== 'all') && (
              <View style={styles.totalSummaryCard}>
                <View style={styles.totalSummaryRow}>
                  <Text style={styles.totalSummaryTitle}>
                    {selectedMemberId !== 'all' ? getSelectedMemberName() : 'Selected Filters'}
                    {selectedYear !== 'all' && ` (${selectedYear})`}
                  </Text>
                  <View style={styles.totalSummaryDivider} />
                  <Text style={styles.totalSummaryAmount}>
                    KES {calculateOverallTotal().toLocaleString()}
                  </Text>
                  <View style={styles.totalSummaryDivider} />
                  <Text style={styles.totalSummaryCount}>
                    {calculateTotalContributionsCount()} {calculateTotalContributionsCount() === 1 ? 'contribution' : 'contributions'}
                  </Text>
                </View>
              </View>
            )}

            {filteredGroups.map((group) => {
              const memberTotal = calculateMemberTotal(group);
              
              return (
                <View key={group.id} style={styles.groupCard}>
                  <Text style={styles.groupTitle}>{group.groupName}</Text>
                  
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Total Collected</Text>
                      <Text style={[styles.summaryValue, styles.collectedValue]}>
                        KES {group.totalAmount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Pending</Text>
                      <Text style={[styles.summaryValue, styles.pendingValue]}>
                        KES {group.pendingAmount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Overdue</Text>
                      <Text style={[styles.summaryValue, styles.overdueValue]}>
                        {group.overdueCount}
                      </Text>
                    </View>
                  </View>

                  {/* ✅ Expenses - Simple display */}
                  <Text style={styles.expensesText}>
                    Total Expenses: KES {group.totalExpenses.toLocaleString()}
                  </Text>

                  {/* ✅ Investments - Simple display (just like expenses) */}
                  <Text style={styles.investmentText}>
                    Total Investments: KES {group.totalInvested.toLocaleString()}
                  </Text>

                  {/* ✅ Balance */}
                  <Text style={[
                    styles.balanceText,
                    { color: group.currentBalance >= 0 ? '#2E7D32' : '#D32F2F' }
                  ]}>
                    Available Balance: KES {group.currentBalance.toLocaleString()}
                  </Text>

                  <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>Contribution History</Text>
                  </View>

                  {group.contributions.length === 0 ? (
                    <Text style={styles.noContributions}>No contributions match the filters</Text>
                  ) : (
                    <>
                      {group.contributions.map((contrib) => {
                        const statusBadge = getStatusBadge(contrib.status, contrib.isLate, contrib.dueDate);
                        
                        return (
                          <View key={contrib.id} style={styles.contributionRow}>
                            <View style={styles.contributionLeft}>
                              <View style={styles.contributionHeader}>
                                <Text style={styles.memberName}>
                                  {contrib.member
                                    ? `${contrib.member.firstName} ${contrib.member.lastName}`
                                    : 'Unknown Member'}
                                </Text>
                                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                                  <Text style={[styles.statusText, { color: statusBadge.color }]}>
                                    {statusBadge.text}
                                  </Text>
                                </View>
                              </View>
                              
                              <Text style={styles.dateText}>
                                {contrib.status === 'Completed' ? 'Paid: ' : 'Due: '}
                                {formatDate(contrib.status === 'Completed' ? contrib.paymentDate : contrib.dueDate)}
                              </Text>
                              
                              {contrib.dueDate && contrib.status === 'Completed' && (
                                <Text style={styles.dueDateText}>
                                  Original due: {formatDate(contrib.dueDate)}
                                </Text>
                              )}
                              
                              {contrib.isLate && contrib.penaltyApplied && contrib.penaltyApplied > 0 && (
                                <Text style={styles.penaltyText}>
                                  ⚠️ Penalty: KES {contrib.penaltyApplied.toLocaleString()} (Late by {contrib.daysLate} days)
                                </Text>
                              )}
                              
                              <Text style={styles.paymentText}>
                                Method: {contrib.paymentMethod || 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.contributionRight}>
                              <Text style={[
                                styles.amountText,
                                contrib.status === 'Pending' && styles.pendingAmountText
                              ]}>
                                KES {contrib.amount.toLocaleString()}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      
                      {(selectedMemberId !== 'all' || selectedYear !== 'all') && (
                        <View style={styles.groupTotalCard}>
                          <Text style={styles.groupTotalText}>
                            Total for this group: KES {memberTotal.toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <GroupAdminBottomNav current="group-contributions" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 181, 246, 1)',
    elevation: 3,
  },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  appTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  titleBlack: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  titleGreen: { fontSize: 22, fontWeight: 'bold', color: '#4CAF50', marginLeft: 4 },
  headerButtonText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },

  container: { padding: 20, paddingBottom: 100 },
  screenTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#333' },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchWrapper: {
    flex: 2,
  },
  searchInput: {
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#333',
  },
  filterWrapper: {
    flex: 1,
  },
  filterButton: {
    height: 45,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonValue: {
    fontSize: 11,
    color: '#333',
    fontWeight: '600',
    marginTop: 2,
  },

  toggleButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginBottom: 12,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2196F3',
  },
  toggleText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },

  resetButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  totalSummaryCard: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  totalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalSummaryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    flex: 2,
  },
  totalSummaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  totalSummaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  totalSummaryCount: {
    fontSize: 11,
    color: '#E8F5E9',
    flex: 1,
    textAlign: 'right',
  },

  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },

  groupCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
  },
  groupTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#1565C0' },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  collectedValue: {
    color: '#4CAF50',
  },
  pendingValue: {
    color: '#FF9800',
  },
  overdueValue: {
    color: '#F44336',
  },

  expensesText: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 5, 
    color: '#F44336' 
  },

  // ✅ Investment text - styled just like expenses
  investmentText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#2196F3',
  },

  balanceText: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 20, 
  },

  historyHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    marginBottom: 15,
    paddingBottom: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    textAlign: 'center',
  },

  noContributions: { 
    fontStyle: 'italic', 
    color: '#888',
    textAlign: 'center',
    paddingVertical: 10,
  },

  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  contributionLeft: {
    flex: 3,
  },
  contributionRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  contributionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  dateText: { 
    fontSize: 12, 
    color: '#555',
    marginBottom: 2,
  },
  dueDateText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  penaltyText: {
    fontSize: 11,
    color: '#F44336',
    marginTop: 2,
  },
  paymentText: { 
    fontSize: 11, 
    color: '#777', 
    marginTop: 2,
  },
  amountText: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#333',
  },
  pendingAmountText: {
    color: '#FF9800',
  },
  
  groupTotalCard: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  groupTotalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  
  reportButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reportButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import axios from 'axios';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const { width } = Dimensions.get('window');

export default function ContributionSummaryScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupData(selectedGroup);
    } else {
      fetchAllData();
    }
  }, [selectedGroup]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchGroups(),
        fetchContributions(),
        fetchLoans(),
        fetchExpenses()
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupData = async (groupId: string) => {
    try {
      setLoading(true);
      await Promise.all([
        fetchContributionsByGroup(groupId),
        fetchLoansData(groupId),
        fetchExpensesData(groupId)
      ]);
    } catch (error) {
      console.error('Failed to fetch group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchContributions = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/contributions');
      setContributions(response.data);
    } catch (error) {
      console.error('Failed to fetch contributions:', error);
    }
  };

  const fetchContributionsByGroup = async (groupId: string) => {
    try {
      const response = await axios.get(`http://localhost:8080/api/contributions/group/${groupId}`);
      setContributions(response.data);
    } catch (error) {
      console.error('Failed to fetch contributions by group:', error);
    }
  };

  const fetchLoans = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/loans');
      setLoans(response.data);
    } catch (error) {
      console.error('Failed to fetch loans:', error);
      // If loans endpoint fails, set empty array
      setLoans([]);
    }
  };

  const fetchLoansData = async (groupId: string) => {
    try {
      // Try group-specific loans endpoint first
      const response = await axios.get(`http://localhost:8080/api/loans/group/${groupId}`);
      setLoans(response.data);
    } catch (error) {
      console.error('Failed to fetch loans by group, trying all loans:', error);
      // Fallback: fetch all loans and filter client-side
      try {
        const allLoansResponse = await axios.get('http://localhost:8080/api/loans');
        const filteredLoans = allLoansResponse.data.filter((loan: any) => 
          loan.groupId === groupId || loan.group?.id === groupId
        );
        setLoans(filteredLoans);
      } catch (fallbackError) {
        console.error('Failed to fetch all loans:', fallbackError);
        setLoans([]);
      }
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/expenses');
      setExpenses(response.data);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      // If expenses endpoint fails, set empty array
      setExpenses([]);
    }
  };

  const fetchExpensesData = async (groupId: string) => {
    try {
      // Try group-specific expenses endpoint first
      const response = await axios.get(`http://localhost:8080/api/expenses/group/${groupId}`);
      setExpenses(response.data);
    } catch (error) {
      console.error('Failed to fetch expenses by group, trying all expenses:', error);
      // Fallback: fetch all expenses and filter client-side
      try {
        const allExpensesResponse = await axios.get('http://localhost:8080/api/expenses');
        const filteredExpenses = allExpensesResponse.data.filter((expense: any) => 
          expense.groupId === groupId || expense.group?.id === groupId
        );
        setExpenses(filteredExpenses);
      } catch (fallbackError) {
        console.error('Failed to fetch all expenses:', fallbackError);
        setExpenses([]);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // Calculate totals
  const totalContributions = contributions.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalLoans = loans.reduce((sum, loan) => sum + (loan.amount || 0), 0);
  const paidLoans = loans.reduce((sum, loan) => sum + (loan.paidAmount || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  
  // CORRECTED: Net Balance = Total Contributions - Total Expenses only
  const netBalance = totalContributions - totalExpenses;

  const StatCard = ({ title, amount, subtitle, color, icon }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <View style={styles.statContent}>
          <Text style={styles.statTitle}>{title}</Text>
          <Text style={styles.statAmount}>KES {amount?.toLocaleString() || '0'}</Text>
          {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  );

  const DataCountItem = ({ label, count, color }: any) => (
    <View style={styles.dataCountItem}>
      <View style={[styles.dataCountDot, { backgroundColor: color }]} />
      <Text style={styles.dataCountLabel}>{label}:</Text>
      <Text style={styles.dataCountValue}>{count}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.logoWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.appName}>
            <Text style={styles.black}>MAN</Text>
            <Text style={styles.red}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(superadmin)/dashboard')}>
          <Text style={styles.homeLink}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.title}>Contribution Summary</Text>
            <Text style={styles.subtitle}>Overview of group contributions and balances</Text>
          </View>
        </View>

        {/* Enhanced Group Selector */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>SELECT GROUP</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedGroup}
              onValueChange={(value) => setSelectedGroup(value)}
              style={styles.picker}
              dropdownIconColor="#2E7D32"
              mode="dropdown"
            >
              <Picker.Item 
                label="All Groups" 
                value={undefined} 
              />
              {groups.map((group) => (
                <Picker.Item
                  key={group.id}
                  label={group.groupName}
                  value={group.id}
                />
              ))}
            </Picker>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading financial data...</Text>
          </View>
        ) : (
          <>
            {/* Statistics Grid */}
            <View style={styles.statsGrid}>
              <StatCard
                title="Total Contributions"
                amount={totalContributions}
                icon="💰"
                color="#4CAF50"
              />
              <StatCard
                title="Total Loans"
                amount={totalLoans}
                icon="📊"
                color="#2196F3"
              />
              <StatCard
                title="Total Expenses"
                amount={totalExpenses}
                icon="💸"
                color="#FF9800"
              />
              <StatCard
                title="Net Balance"
                amount={netBalance}
                icon="⚖️"
                color={netBalance >= 0 ? '#2E7D32' : '#D32F2F'}
              />
            </View>

            {/* Enhanced Data Count Section */}
            <View style={styles.dataCountContainer}>
              <Text style={styles.dataCountTitle}>📊 DATA OVERVIEW</Text>
              <View style={styles.dataCountGrid}>
                <DataCountItem 
                  label="Contributions" 
                  count={contributions.length} 
                  color="#4CAF50"
                />
                <DataCountItem 
                  label="Loans" 
                  count={loans.length} 
                  color="#2196F3"
                />
                <DataCountItem 
                  label="Expenses" 
                  count={expenses.length} 
                  color="#FF9800"
                />
              </View>
              <View style={styles.calculationInfo}>
                <Text style={styles.calculationText}>
                  💡 Calculation: {totalContributions.toLocaleString()} (Contributions) - {totalExpenses.toLocaleString()} (Expenses) = {netBalance.toLocaleString()} (Net Balance)
                </Text>
              </View>
            </View>

            {/* Report Generation Button */}
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => router.push({
                pathname: '/(superadmin)/contribution-report',
                params: { groupId: selectedGroup }
              })}
            >
              <View style={styles.reportButtonContent}>
                <Text style={styles.reportIcon}>📄</Text>
                <View style={styles.reportTextContainer}>
                  <Text style={styles.reportText}>Generate Detailed Report</Text>
                  <Text style={styles.reportSubtext}>Export comprehensive financial analysis</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <SuperAdminBottomNav current="finance" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomColor: '#A5D6A7',
    borderBottomWidth: 1,
    elevation: 3,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  black: {
    color: '#000',
  },
  red: {
    color: '#D32F2F',
  },
  homeLink: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  container: {
    padding: 20,
    paddingBottom: 80,
  },
  headerSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
  },
  selectorContainer: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
  },
  picker: {
    height: 50,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    width: (width - 60) / 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  // Enhanced Data Count Styles
  dataCountContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  dataCountTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  dataCountGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dataCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  dataCountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dataCountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginRight: 4,
  },
  dataCountValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  calculationInfo: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  calculationText: {
    fontSize: 12,
    color: '#1565C0',
    textAlign: 'center',
    fontWeight: '500',
  },
  reportButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  reportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  reportTextContainer: {
    flex: 1,
  },
  reportText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  reportSubtext: {
    fontSize: 12,
    color: '#666',
  },
  chevron: {
    fontSize: 20,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
});
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import GroupAdminBottomNav from '../../components/GroupAdminBottomNav';

const API_BASE_URL = 'http://172.20.10.2:8080/api';

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
  description: string;
  creationDate: string;
  status: string;
};

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  status: string;
};

type Expense = {
  id: string;
  amount: number;
  description: string;
  dateIncurred: string;
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type FormData = {
  amount: string;
  description: string;
  dateIncurred: string;
  approvedBy: string;
};

type FilterType = 'all' | 'this-month' | 'last-month' | 'custom';

export default function RecordExpenseScreen(): React.JSX.Element {
  const router = useRouter();

  const [groupId, setGroupId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupBalance, setGroupBalance] = useState<number>(0);
  const [totalContributions, setTotalContributions] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [totalInvested, setTotalInvested] = useState<number>(0);
  const [pendingContributions, setPendingContributions] = useState<number>(0);
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [customMonth, setCustomMonth] = useState<string>('');
  const [customYear, setCustomYear] = useState<string>('');
  const [showCustomFilter, setShowCustomFilter] = useState<boolean>(false);
  
  const [formData, setFormData] = useState<FormData>({
    amount: '',
    description: '',
    dateIncurred: new Date().toISOString().split('T')[0],
    approvedBy: '',
  });

  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => 
    (currentYear - 5 + i).toString()
  );

  useFocusEffect(
    React.useCallback(() => {
      if (groupId) {
        fetchGroupBalance(groupId);
        fetchGroupExpenses(groupId);
      }
    }, [groupId])
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const storedGroupId = await AsyncStorage.getItem('userGroupId');
        const storedAdminId = await AsyncStorage.getItem('userId');

        if (storedGroupId && storedAdminId) {
          setGroupId(storedGroupId);
          setAdminId(storedAdminId);
          await Promise.all([
            fetchGroupData(storedGroupId),
            fetchGroupMembers(storedGroupId),
            fetchGroupBalance(storedGroupId),
            fetchGroupExpenses(storedGroupId)
          ]);
        } else {
          showAlert('Error', 'User session is invalid. Please log in again.');
        }
      } catch (err) {
        console.error('❌ Failed to load storage:', err);
        showAlert('Error', 'Could not load user or group data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [groupExpenses, filterType, selectedMonth, selectedYear, customMonth, customYear]);

  const fetchGroupData = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups/${gId}`);
      setGroupData(response.data);
    } catch (err) {
      console.error('❌ Error fetching group:', err);
      showAlert('Error', 'Could not fetch group details.');
    }
  };

  const fetchGroupMembers = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/members/by-group/${gId}`);
      setMembers(response.data);
      
      const currentUserId = await AsyncStorage.getItem('userId');
      if (currentUserId && response.data.find((m: Member) => m.id === currentUserId)) {
        setFormData(prev => ({ ...prev, approvedBy: currentUserId }));
      }
    } catch (err) {
      console.error('❌ Error fetching members:', err);
      showAlert('Error', 'Could not fetch group members.');
    }
  };

  const fetchGroupBalance = async (gId: string) => {
    try {
      const [contributionsRes, expensesRes, investmentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/contributions/group/${gId}`),
        axios.get(`${API_BASE_URL}/expenses`),
        axios.get(`${API_BASE_URL}/investments/group/${gId}`)
      ]);

      const allContributions = contributionsRes.data;
      const completedContributions = allContributions.filter((c: any) => c.status === 'Completed');
      const pendingContributionsList = allContributions.filter((c: any) => c.status === 'Pending');
      
      const totalCompleted = completedContributions.reduce(
        (sum: number, contribution: any) => sum + contribution.amount, 0
      );
      const totalPending = pendingContributionsList.reduce(
        (sum: number, contribution: any) => sum + contribution.amount, 0
      );

      const groupExpensesList = expensesRes.data.filter(
        (expense: any) => expense.group?.id === gId
      );
      
      const totalExpensesSum = groupExpensesList.reduce(
        (sum: number, expense: any) => sum + expense.amount, 0
      );

      const groupInvestments = investmentsRes.data.filter(
        (investment: any) => investment.group?.id === gId
      );
      
      const totalInvestedSum = groupInvestments.reduce(
        (sum: number, investment: any) => sum + investment.amountInvested, 0
      );

      // Available balance = Completed Contributions - Expenses - Investments
      const balance = totalCompleted - totalExpensesSum - totalInvestedSum;
      
      setTotalContributions(totalCompleted);
      setPendingContributions(totalPending);
      setTotalExpenses(totalExpensesSum);
      setTotalInvested(totalInvestedSum);
      setGroupBalance(balance);
    } catch (err) {
      console.error('❌ Error calculating balance:', err);
      setGroupBalance(0);
    }
  };

  const fetchGroupExpenses = async (gId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/expenses`);
      const allExpenses = response.data;
      
      const expenses = allExpenses
        .filter((expense: any) => expense.group?.id === gId)
        .map((expense: any) => ({
          id: expense.id,
          amount: expense.amount,
          description: expense.description,
          dateIncurred: expense.dateIncurred,
          approvedBy: expense.approvedBy || { id: '', firstName: 'Unknown', lastName: '' }
        }))
        .sort((a: Expense, b: Expense) => new Date(b.dateIncurred).getTime() - new Date(a.dateIncurred).getTime());

      setGroupExpenses(expenses);
      setFilteredExpenses(expenses);
    } catch (err) {
      console.error('❌ Error fetching expenses:', err);
      setGroupExpenses([]);
      setFilteredExpenses([]);
    }
  };

  const applyFilters = () => {
    let filtered = [...groupExpenses];

    switch (filterType) {
      case 'this-month':
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYearNum = now.getFullYear();
        filtered = filtered.filter(expense => {
          const expenseDate = new Date(expense.dateIncurred);
          return expenseDate.getMonth() + 1 === currentMonth && 
                 expenseDate.getFullYear() === currentYearNum;
        });
        break;

      case 'last-month':
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthNum = lastMonth.getMonth() + 1;
        const lastMonthYear = lastMonth.getFullYear();
        filtered = filtered.filter(expense => {
          const expenseDate = new Date(expense.dateIncurred);
          return expenseDate.getMonth() + 1 === lastMonthNum && 
                 expenseDate.getFullYear() === lastMonthYear;
        });
        break;

      case 'custom':
        if (customMonth && customYear) {
          filtered = filtered.filter(expense => {
            const expenseDate = new Date(expense.dateIncurred);
            const expenseMonth = (expenseDate.getMonth() + 1).toString().padStart(2, '0');
            const expenseYear = expenseDate.getFullYear().toString();
            return expenseMonth === customMonth && expenseYear === customYear;
          });
        }
        break;
    }

    if (selectedMonth) {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.dateIncurred);
        const expenseMonth = (expenseDate.getMonth() + 1).toString().padStart(2, '0');
        return expenseMonth === selectedMonth;
      });
    }

    if (selectedYear) {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.dateIncurred);
        const expenseYear = expenseDate.getFullYear().toString();
        return expenseYear === selectedYear;
      });
    }

    setFilteredExpenses(filtered);
  };

  const handleFilterChange = (type: FilterType) => {
    setFilterType(type);
    setShowCustomFilter(type === 'custom');
    
    if (type !== 'all') {
      setSelectedMonth('');
      setSelectedYear('');
    }
  };

  const getFilterSummary = () => {
    switch (filterType) {
      case 'this-month':
        return 'Showing expenses for this month';
      case 'last-month':
        return 'Showing expenses for last month';
      case 'custom':
        if (customMonth && customYear) {
          const monthName = months.find(m => m.value === customMonth)?.label;
          return `Showing expenses for ${monthName} ${customYear}`;
        }
        return 'Select custom month/year';
      case 'all':
      default:
        return selectedMonth || selectedYear 
          ? `Filtered expenses${selectedMonth ? ` (Month: ${months.find(m => m.value === selectedMonth)?.label})` : ''}${selectedYear ? ` (Year: ${selectedYear})` : ''}`
          : 'Showing all expenses';
    }
  };

  const calculateFilteredTotal = () => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  const updateForm = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showAlert('Validation', 'Please enter a valid amount.');
      return false;
    }
    
    if (!formData.description.trim()) {
      showAlert('Validation', 'Please enter a description for the expense.');
      return false;
    }

    if (!formData.approvedBy) {
      showAlert('Validation', 'Please select who approved this expense.');
      return false;
    }

    const expenseAmount = parseFloat(formData.amount);
    
    if (expenseAmount > groupBalance) {
      showAlert(
        'Insufficient Funds', 
        `Expense amount (KES ${expenseAmount.toLocaleString()}) exceeds available balance (KES ${groupBalance.toLocaleString()}).\n\n` +
        `💰 Total Completed Contributions: KES ${totalContributions.toLocaleString()}\n` +
        `📋 Pending Contributions: KES ${pendingContributions.toLocaleString()}\n` +
        `💸 Total Expenses: KES ${totalExpenses.toLocaleString()}\n` +
        `📈 Total Invested: KES ${totalInvested.toLocaleString()}`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !groupData) {
      return;
    }

    setSubmitting(true);
    try {
      const approvedByMember = members.find(m => m.id === formData.approvedBy);
      
      if (!approvedByMember) {
        showAlert('Error', 'Selected approver not found in group members.');
        return;
      }

      const payload = {
        group: {
          id: groupData.id,
        },
        amount: parseFloat(formData.amount),
        description: formData.description,
        dateIncurred: `${formData.dateIncurred}T00:00:00.000Z`,
        approvedBy: {
          id: approvedByMember.id,
        },
        createdBy: adminId,
        modifiedBy: adminId,
        createdOn: new Date().toISOString(),
        modifiedOn: new Date().toISOString(),
        mansoftTenantId: await AsyncStorage.getItem('mansoftTenantId') || '',
      };

      await axios.post(`${API_BASE_URL}/expenses`, payload);

      showAlert(
        'Success', 
        `Expense of KES ${parseFloat(formData.amount).toLocaleString()} recorded successfully.`,
        () => {
          setFormData({
            amount: '',
            description: '',
            dateIncurred: new Date().toISOString().split('T')[0],
            approvedBy: adminId,
          });
          fetchGroupBalance(groupId);
          fetchGroupExpenses(groupId);
        }
      );

    } catch (err: unknown) {
      console.error('❌ Expense submission error:', err);
      
      let errorMessage = 'Failed to record expense.';
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          errorMessage = err.response.data?.message || 'Server error. Please try again.';
        } else if (err.request) {
          errorMessage = 'No response from server. Check your network connection.';
        } else {
          errorMessage = err.message;
        }
      }
      
      showAlert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const expenseAmount = parseFloat(formData.amount) || 0;
  const remainingBalance = groupBalance - expenseAmount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.logoText}>
            MAN<Text style={{ color: '#4CAF50' }}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(groupadmin)/dashboard')}>
          <Text style={styles.backToHome}>← Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Record Group Expense</Text>
        
        {/* Balance Information Card - UPDATED */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>KES {groupBalance.toLocaleString()}</Text>
          
          {/* Financial Summary */}
          <View style={styles.financialSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Completed Contributions:</Text>
              <Text style={styles.summaryValueGreen}>KES {totalContributions.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pending Contributions:</Text>
              <Text style={styles.summaryValueOrange}>KES {pendingContributions.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Expenses:</Text>
              <Text style={styles.summaryValueRed}>KES {totalExpenses.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Invested:</Text>
              <Text style={styles.summaryValuePurple}>KES {totalInvested.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Formula:</Text>
              <Text style={styles.summaryFormula}>
                Contributions - Expenses - Investments
              </Text>
            </View>
          </View>
          
          {expenseAmount > 0 && (
            <View style={styles.balancePreview}>
              <Text style={styles.remainingLabel}>Balance After Expense:</Text>
              <Text style={[
                styles.remainingAmount,
                { color: remainingBalance >= 0 ? '#2E7D32' : '#D32F2F' }
              ]}>
                KES {remainingBalance.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" />
        ) : (
          <>
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Expense Details</Text>
              
              <Text style={styles.label}>Amount (KES) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                keyboardType="numeric"
                value={formData.amount}
                onChangeText={(val) => updateForm('amount', val)}
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the expense purpose..."
                value={formData.description}
                onChangeText={(val) => updateForm('description', val)}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Date Incurred *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={formData.dateIncurred}
                onChangeText={(val) => updateForm('dateIncurred', val)}
              />

              <Text style={styles.label}>Approved By *</Text>
              <Picker
                selectedValue={formData.approvedBy}
                onValueChange={(val) => updateForm('approvedBy', val)}
                style={styles.picker}
              >
                <Picker.Item label="Select approver..." value="" />
                {members.map((member) => (
                  <Picker.Item 
                    key={member.id} 
                    label={`${member.firstName} ${member.lastName} (${member.role})`} 
                    value={member.id} 
                  />
                ))}
              </Picker>

              <Text style={styles.helperText}>
                * Expenses will be deducted from the group's available balance (Completed Contributions - Expenses - Investments)
              </Text>
            </View>

            <TouchableOpacity 
              style={[
                styles.submitBtn, 
                submitting && styles.submitBtnDisabled
              ]} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  Record Expense {expenseAmount > 0 && `(KES ${expenseAmount.toLocaleString()})`}
                </Text>
              )}
            </TouchableOpacity>

            {/* Expense History Section */}
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Expense History</Text>
                <Text style={styles.filterSummary}>{getFilterSummary()}</Text>
              </View>

              <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Quick Filters:</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      filterType === 'all' && styles.filterButtonActive
                    ]}
                    onPress={() => handleFilterChange('all')}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      filterType === 'all' && styles.filterButtonTextActive
                    ]}>All</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      filterType === 'this-month' && styles.filterButtonActive
                    ]}
                    onPress={() => handleFilterChange('this-month')}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      filterType === 'this-month' && styles.filterButtonTextActive
                    ]}>This Month</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      filterType === 'last-month' && styles.filterButtonActive
                    ]}
                    onPress={() => handleFilterChange('last-month')}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      filterType === 'last-month' && styles.filterButtonTextActive
                    ]}>Last Month</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      filterType === 'custom' && styles.filterButtonActive
                    ]}
                    onPress={() => handleFilterChange('custom')}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      filterType === 'custom' && styles.filterButtonTextActive
                    ]}>Custom</Text>
                  </TouchableOpacity>
                </View>

                {showCustomFilter && (
                  <View style={styles.customFilterContainer}>
                    <Text style={styles.customFilterLabel}>Select Month & Year:</Text>
                    <View style={styles.pickerRow}>
                      <Picker
                        selectedValue={customMonth}
                        onValueChange={setCustomMonth}
                        style={styles.monthPicker}
                      >
                        <Picker.Item label="Select Month" value="" />
                        {months.map(month => (
                          <Picker.Item key={month.value} label={month.label} value={month.value} />
                        ))}
                      </Picker>
                      
                      <Picker
                        selectedValue={customYear}
                        onValueChange={setCustomYear}
                        style={styles.yearPicker}
                      >
                        <Picker.Item label="Select Year" value="" />
                        {years.map(year => (
                          <Picker.Item key={year} label={year} value={year} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                <View style={styles.monthYearFilterContainer}>
                  <Text style={styles.filterLabel}>Filter by:</Text>
                  <View style={styles.pickerRow}>
                    <Picker
                      selectedValue={selectedMonth}
                      onValueChange={setSelectedMonth}
                      style={styles.monthPicker}
                    >
                      <Picker.Item label="All Months" value="" />
                      {months.map(month => (
                        <Picker.Item key={month.value} label={month.label} value={month.value} />
                      ))}
                    </Picker>
                    
                    <Picker
                      selectedValue={selectedYear}
                      onValueChange={setSelectedYear}
                      style={styles.yearPicker}
                    >
                      <Picker.Item label="All Years" value="" />
                      {years.map(year => (
                        <Picker.Item key={year} label={year} value={year} />
                      ))}
                    </Picker>
                  </View>
                </View>

                {filteredExpenses.length > 0 && (
                  <View style={styles.filteredTotalContainer}>
                    <Text style={styles.filteredTotalLabel}>
                      Total for {filteredExpenses.length} expense(s):
                    </Text>
                    <Text style={styles.filteredTotalAmount}>
                      KES {calculateFilteredTotal().toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>

              {filteredExpenses.length === 0 ? (
                <Text style={styles.noExpenses}>No expenses found</Text>
              ) : (
                filteredExpenses.map((expense) => (
                  <View key={expense.id} style={styles.expenseRow}>
                    <View style={styles.expenseDetails}>
                      <Text style={styles.expenseDescription}>
                        {expense.description}
                      </Text>
                      <Text style={styles.expenseDate}>
                        {new Date(expense.dateIncurred).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                      <Text style={styles.approvedBy}>
                        Approved by: {expense.approvedBy.firstName} {expense.approvedBy.lastName}
                      </Text>
                    </View>
                    <Text style={styles.expenseAmount}>
                      KES {expense.amount.toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <GroupAdminBottomNav current="record-expenses" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
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
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  backToHome: { color: '#1565C0', fontWeight: 'bold', fontSize: 14 },
  container: { padding: 20, paddingBottom: 100 },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#1733a5ff', 
    marginBottom: 10,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceLabel: { 
    fontSize: 16, 
    color: '#666', 
    marginBottom: 8,
    fontWeight: '600',
  },
  balanceAmount: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#2E7D32',
  },
  financialSummary: {
    width: '100%',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  summaryLabelBold: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValueGreen: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  summaryValueOrange: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9800',
  },
  summaryValueRed: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F44336',
  },
  summaryValuePurple: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9C27B0',
  },
  summaryFormula: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  balancePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  remainingLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  remainingAmount: { fontSize: 16, fontWeight: 'bold' },
  formCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E3F2FD',
    paddingBottom: 10,
  },
  label: { 
    fontWeight: 'bold', 
    marginBottom: 8, 
    color: '#333',
    fontSize: 15,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderColor: '#ddd',
    borderWidth: 1,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  picker: { 
    backgroundColor: '#f9f9f9', 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#81C784',
  },
  submitBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16,
  },
  historySection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    elevation: 2,
  },
  historyHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    marginBottom: 15,
    paddingBottom: 8,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
    textAlign: 'center',
  },
  filterSummary: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },
  filterContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 10,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E9ECEF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#495057',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  customFilterContainer: {
    backgroundColor: '#F1F8E9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#DCEDC8',
  },
  customFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#33691E',
    marginBottom: 8,
  },
  monthYearFilterContainer: {
    marginTop: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  monthPicker: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  yearPicker: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  filteredTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 6,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#FFEEBA',
  },
  filteredTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  filteredTotalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
  },
  noExpenses: {
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  approvedBy: {
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D32F2F',
    textAlign: 'right',
  },
});
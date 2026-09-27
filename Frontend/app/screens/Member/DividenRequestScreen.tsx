import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://172.20.10.2:8080/api';

// Alert helper function
const showAlert = (title: string, message: string, onOk?: () => void) => {
  console.log(`🔔 Alert: ${title} - ${message}`);
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

// Interfaces
interface DividendDeclaration {
  id: string;
  financialYear: string;
  percentageRate: number;
  declaredDate: string;
  status: string;
}

interface MemberDividend {
  id: string;
  sharesAmount: number;
  dividendAmount: number;
  paymentStatus: string;
  paymentReference?: string;
  paymentDate?: string;
  declaration?: {
    financialYear: string;
    percentageRate: number;
  };
}

interface Group {
  id: string;
  groupName: string;
}

export default function DividendsScreen() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [totalShares, setTotalShares] = useState(0);
  const [yearShares, setYearShares] = useState(0);
  const [currentDeclaration, setCurrentDeclaration] = useState<DividendDeclaration | null>(null);
  const [availableDividends, setAvailableDividends] = useState<MemberDividend[]>([]);
  const [paidDividends, setPaidDividends] = useState<MemberDividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalDividendsEarned, setTotalDividendsEarned] = useState(0);

  const fetchGroupName = async (groupId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/groups/${groupId}`);
      if (response.ok) {
        const group: Group = await response.json();
        setGroupName(group.groupName);
      }
    } catch (error) {
      console.error('Error fetching group name:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const storedMemberId = await AsyncStorage.getItem('userId');
    const storedGroupId = await AsyncStorage.getItem('userGroupId');
    const firstName = await AsyncStorage.getItem('userFirstName');
    const lastName = await AsyncStorage.getItem('userLastName');
    
    console.log('🔍 Debug - storedMemberId:', storedMemberId);
    console.log('🔍 Debug - storedGroupId:', storedGroupId);
    
    if (!storedMemberId) {
      router.replace('/(auth)');
      return;
    }
    
    setMemberId(storedMemberId);
    setMemberName(`${firstName || ''} ${lastName || ''}`.trim());
    
    // ✅ Use storedGroupId directly from AsyncStorage (same as GroupAdmin)
    if (storedGroupId && storedGroupId !== 'null' && storedGroupId !== 'undefined') {
      await fetchGroupName(storedGroupId);
      await fetchDividendsData(storedMemberId, storedGroupId);
    } else {
      console.warn('⚠️ No groupId found in AsyncStorage');
      showAlert('Error', 'Group information not found. Please logout and login again.');
      setLoading(false);
    }
  };

  const fetchDividendsData = async (currentMemberId: string, userGroupId: string) => {
    setLoading(true);
    try {
      console.log('🔍 Using stored groupId:', userGroupId);
      
      // ✅ Get current declaration for this group
      const declarationRes = await fetch(`${BASE_URL}/dividends/declarations/current?groupId=${userGroupId}`);
      if (declarationRes.ok) {
        const declaration = await declarationRes.json();
        setCurrentDeclaration(declaration);
      }

      // ✅ Get member dividends for this group
      const dividendsRes = await fetch(`${BASE_URL}/dividends/member/${currentMemberId}?groupId=${userGroupId}`);
      if (dividendsRes.ok) {
        const allDividends: MemberDividend[] = await dividendsRes.json();
        
        const pending = allDividends.filter(d => d.paymentStatus === 'PENDING' || d.paymentStatus === 'PROCESSING');
        const paid = allDividends.filter(d => d.paymentStatus === 'PAID');
        
        if (pending.length > 0) {
          setYearShares(pending[0].sharesAmount);
        } else if (paid.length > 0) {
          setYearShares(paid[0].sharesAmount);
        } else {
          setYearShares(0);
        }
        
        setAvailableDividends(pending);
        setPaidDividends(paid);
        
        const total = paid.reduce((sum, d) => sum + d.dividendAmount, 0);
        setTotalDividendsEarned(total);
      }

      // Get total shares from contributions
      const contribRes = await fetch(`${BASE_URL}/contributions/member/${currentMemberId}`);
      if (contribRes.ok) {
        const contributions = await contribRes.json();
        const total = contributions.reduce((sum: number, c: any) => {
          if (c.transactionType === 'Contribution' && c.status === 'Completed') {
            return sum + c.amount;
          }
          return sum;
        }, 0);
        setTotalShares(total);
      }
      
    } catch (error) {
      console.error('Error:', error);
      showAlert('Error', 'Failed to load dividends data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (memberId) {
      const storedGroupId = await AsyncStorage.getItem('userGroupId');
      if (storedGroupId) {
        await fetchDividendsData(memberId, storedGroupId);
      }
    }
  };

  const requestPayment = async (dividendId: string, amount: number) => {
    showAlert(
      'Request Payment',
      `Request KES ${amount.toLocaleString()} to be sent to your M-PESA?`,
      async () => {
        try {
          const res = await fetch(`${BASE_URL}/dividends/${dividendId}/request-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod: 'MPESA' })
          });
          
          if (res.ok) {
            showAlert('Success', 'Payment request submitted! You will receive the amount shortly.', async () => {
              if (memberId) {
                const storedGroupId = await AsyncStorage.getItem('userGroupId');
                if (storedGroupId) {
                  await fetchDividendsData(memberId, storedGroupId);
                }
              }
            });
          } else {
            const error = await res.text();
            showAlert('Error', `Failed to request payment: ${error}`);
          }
        } catch (error) {
          showAlert('Error', 'Connection failed. Please try again.');
        }
      }
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#388E3C" />
        <Text style={styles.loadingText}>Loading dividends...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - Matching Loan Screen */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.dashboardButton} onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.dashboardButtonText}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#388E3C']} />
        }
      >
        <View style={styles.contentContainer}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>💰 Dividends</Text>
            <Text style={styles.subtitleText}>Your Share of Sacco Profits</Text>
            <Text style={styles.groupSubtitle}>{groupName}</Text>
          </View>

          {/* Member Info Card */}
          <View style={styles.memberCard}>
            <Text style={styles.memberName}>{memberName}</Text>
            <Text style={styles.memberShares}>Total Shares: KES {totalShares.toLocaleString()}</Text>
          </View>

          {/* Current Declaration Card */}
          {currentDeclaration && currentDeclaration.status === 'APPROVED' && (
            <View style={styles.declarationCard}>
              <View style={styles.declarationHeader}>
                <Text style={styles.declarationIcon}>📢</Text>
                <View>
                  <Text style={styles.declarationTitle}>Current Dividend Declaration</Text>
                  <Text style={styles.declarationYear}>Year: {currentDeclaration.financialYear}</Text>
                </View>
              </View>
              <View style={styles.declarationDetails}>
                <Text style={styles.rateText}>
                  Rate: <Text style={styles.rateValue}>{currentDeclaration.percentageRate}%</Text>
                </Text>
                <Text style={styles.declarationDate}>
                  Declared: {new Date(currentDeclaration.declaredDate).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}

          {/* Total Dividends Earned Card */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Dividends Earned (All Time)</Text>
            <Text style={styles.totalAmount}>KES {totalDividendsEarned.toLocaleString()}</Text>
          </View>

          {/* Available Dividends Section */}
          {availableDividends.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Available for Payout</Text>
              <Text style={styles.sectionSubtitle}>
                These dividends are ready to be sent to your M-PESA
              </Text>
              
              {availableDividends.map((dividend) => (
                <View key={dividend.id} style={styles.dividendCard}>
                  <View style={styles.dividendHeader}>
                    <Text style={styles.dividendYear}>
                      {dividend.declaration?.financialYear || 'Current Year'}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {dividend.paymentStatus === 'PROCESSING' ? '⏳ Processing' : 'Available'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.dividendDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Shares Amount ({dividend.declaration?.financialYear}):</Text>
                      <Text style={styles.detailValue}>KES {dividend.sharesAmount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Dividend Rate:</Text>
                      <Text style={styles.detailValue}>{dividend.declaration?.percentageRate || 0}%</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Dividend Amount:</Text>
                      <Text style={styles.dividendAmountValue}>KES {dividend.dividendAmount.toLocaleString()}</Text>
                    </View>
                  </View>
                  
                  {dividend.paymentStatus !== 'PROCESSING' && (
                    <TouchableOpacity 
                      style={styles.requestBtn}
                      onPress={() => requestPayment(dividend.id, dividend.dividendAmount)}
                    >
                      <Text style={styles.requestBtnText}>📱 Request Payment via M-PESA</Text>
                    </TouchableOpacity>
                  )}
                  
                  {dividend.paymentStatus === 'PROCESSING' && (
                    <View style={styles.processingContainer}>
                      <ActivityIndicator size="small" color="#FF9800" />
                      <Text style={styles.processingText}>Payment request submitted. Awaiting processing...</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* No Available Dividends Message */}
          {availableDividends.length === 0 && currentDeclaration && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoIcon}>📭</Text>
              <Text style={styles.infoTitle}>No Dividends Available for {currentDeclaration.financialYear}</Text>
              <Text style={styles.infoText}>
                Dividends have been declared for {currentDeclaration.financialYear} at {currentDeclaration.percentageRate}%,{'\n\n'}
                Your contributions for {currentDeclaration.financialYear}: <Text style={{ fontWeight: 'bold', color: '#2196F3' }}>KES {yearShares.toLocaleString()}</Text>{'\n'}
                Your total shares (all time): KES {totalShares.toLocaleString()}{'\n\n'}
                💡 Dividends are calculated based on contributions made DURING the declared year only.
                {yearShares === 0 ? ' You made no contributions in this year.' : ''}
              </Text>
            </View>
          )}

          {/* No Declaration Message */}
          {!currentDeclaration && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoIcon}>⏳</Text>
              <Text style={styles.infoTitle}>No Active Dividend Declaration</Text>
              <Text style={styles.infoText}>
                There is no dividend declaration available at this time. 
                Dividends are declared annually by management. Please check back later.
              </Text>
            </View>
          )}

          {/* Paid Dividends History */}
          {paidDividends.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📜 Payment History</Text>
              {paidDividends.map((dividend) => (
                <View key={dividend.id} style={[styles.dividendCard, styles.paidCard]}>
                  <View style={styles.dividendHeader}>
                    <Text style={styles.dividendYear}>
                      {dividend.declaration?.financialYear || 'Previous Year'}
                    </Text>
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidBadgeText}>✅ PAID</Text>
                    </View>
                  </View>
                  
                  <View style={styles.dividendDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount Received:</Text>
                      <Text style={styles.paidAmountValue}>KES {dividend.dividendAmount.toLocaleString()}</Text>
                    </View>
                    {dividend.paymentDate && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Paid Date:</Text>
                        <Text style={styles.detailValue}>{new Date(dividend.paymentDate).toLocaleDateString()}</Text>
                      </View>
                    )}
                    {dividend.paymentReference && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Reference:</Text>
                        <Text style={styles.detailValue}>{dividend.paymentReference}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Info Section */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>ℹ️ About Dividends</Text>
            <Text style={styles.infoText}>
              • Dividends are declared annually based on Sacco profits{'\n'}
              • Rate is a percentage of your contributions made during that year{'\n'}
              • Payments are sent via M-PESA or bank transfer{'\n'}
              • Management approves dividends before distribution
            </Text>
          </View>
        </View>
      </ScrollView>

      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },
  scrollContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F5E9' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#388E3C' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#C8E6C9', paddingHorizontal: 20, paddingVertical: 15 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 30, height: 30, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 20, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#1B5E20' },
  dashboardButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  dashboardButtonText: { color: '#388E3C', fontWeight: 'bold' },
  
  contentContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  
  titleSection: { backgroundColor: '#C8E6C9', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  titleText: { fontSize: 22, fontWeight: 'bold', color: '#1B5E20' },
  subtitleText: { fontSize: 14, color: '#388E3C', marginTop: 5 },
  groupSubtitle: { fontSize: 12, color: '#2E7D32', marginTop: 3 },
  
  memberCard: { backgroundColor: '#388E3C', marginBottom: 15, padding: 20, borderRadius: 12, alignItems: 'center' },
  memberName: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 5 },
  memberShares: { fontSize: 14, color: '#E8F5E9' },
  
  declarationCard: { backgroundColor: '#FFFFFF', marginBottom: 15, padding: 15, borderRadius: 12, elevation: 3 },
  declarationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  declarationIcon: { fontSize: 30, marginRight: 12 },
  declarationTitle: { fontSize: 16, fontWeight: 'bold', color: '#1976D2' },
  declarationYear: { fontSize: 14, color: '#666' },
  declarationDetails: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 12 },
  rateText: { fontSize: 14, color: '#333', marginBottom: 4 },
  rateValue: { fontWeight: 'bold', color: '#4CAF50', fontSize: 18 },
  declarationDate: { fontSize: 12, color: '#999' },
  
  totalCard: { backgroundColor: '#2196F3', marginBottom: 15, padding: 20, borderRadius: 12, alignItems: 'center' },
  totalLabel: { color: '#FFFFFF', fontSize: 14, opacity: 0.9 },
  totalAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold', marginTop: 5 },
  
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20', marginBottom: 5 },
  sectionSubtitle: { fontSize: 12, color: '#666', marginBottom: 15 },
  
  dividendCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  paidCard: { backgroundColor: '#F5F5F5', opacity: 0.9 },
  dividendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dividendYear: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { backgroundColor: '#FF9800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, color: '#FFFFFF', fontWeight: 'bold' },
  paidBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  paidBadgeText: { fontSize: 12, color: '#FFFFFF', fontWeight: 'bold' },
  dividendDetails: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 14, color: '#666' },
  detailValue: { fontSize: 14, color: '#333' },
  dividendAmountValue: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  paidAmountValue: { fontSize: 16, fontWeight: 'bold', color: '#388E3C' },
  requestBtn: { backgroundColor: '#4CAF50', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  requestBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  processingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 10 },
  processingText: { fontSize: 12, color: '#FF9800' },
  
  infoContainer: { backgroundColor: '#FFF3E0', marginBottom: 15, padding: 20, borderRadius: 12, alignItems: 'center' },
  infoIcon: { fontSize: 48, marginBottom: 12 },
  infoTitle: { fontSize: 18, fontWeight: 'bold', color: '#FF9800', marginBottom: 8, textAlign: 'center' },
  infoText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  
  infoCard: { backgroundColor: '#E3F2FD', marginBottom: 15, padding: 15, borderRadius: 8 },
});

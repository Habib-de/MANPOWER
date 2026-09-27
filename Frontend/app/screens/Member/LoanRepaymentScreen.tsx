import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemberBottomNav from '../../components/MemberBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

interface MemberData {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
}

export default function LoanRepaymentScreen() {
  const params = useLocalSearchParams();
  const {
    loanId,
    amount,
    outstanding,
    dueDate,
    interestRate,
    status
  } = params;

  const [memberId, setMemberId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      const group = await AsyncStorage.getItem('userGroupId');
      
      if (!id) {
        router.replace('/(auth)');
        return;
      }

      setMemberId(id);
      setGroupId(group);
      
      // Fetch member details to get phone number
      await fetchMemberData(id);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberData = async (id: string) => {
    try {
      const res = await fetch(`${BASE_URL}/members/${id}`);
      if (res.ok) {
        const data: MemberData = await res.json();
        setMemberData(data);
        // Set phone number to member's registered phone
        if (data.phoneNumber) {
          setPhoneNumber(data.phoneNumber);
        }
      }
    } catch (err) {
      console.error('Error fetching member data:', err);
    }
  };

  const handleFullPayment = () => {
    setPaymentAmount(outstanding as string);
  };

  const initiateMpesaPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your M-Pesa phone number');
      return;
    }

    // Validate phone number format for Kenya
    const phoneRegex = /^(07\d{8}|7\d{8}|\+2547\d{8}|2547\d{8})$/;
    const cleanedPhone = phoneNumber.trim();
    
    if (!phoneRegex.test(cleanedPhone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Kenyan phone number (e.g., 0712345678)');
      return;
    }

    const amountValue = parseFloat(paymentAmount);
    const outstandingValue = parseFloat(outstanding as string);

    if (amountValue > outstandingValue) {
      Alert.alert(
        'Amount Exceeds Balance',
        `Your outstanding balance is KES ${outstandingValue.toLocaleString('en-KE')}. 
        Do you want to pay the full amount?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pay Full Amount', onPress: handleFullPayment }
        ]
      );
      return;
    }

    if (!groupId) {
      Alert.alert('Error', 'Group information missing. Please logout and login again.');
      return;
    }

    setIsProcessing(true);

    try {
      // Format phone number to 254
      let formattedPhone = cleanedPhone;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
      }

      // Create a unique contribution ID with loan reference
      const contributionId = `LOAN-REPAY-${loanId}-${Date.now()}`;

      const response = await fetch(
        `${BASE_URL}/payments/initiate-contribution?` +
        `amount=${amountValue}&` +
        `transactionType=Loan_Payment&` +
        `phone=${formattedPhone}&` +
        `memberId=${memberId}&` +
        `groupId=${groupId}&` +
        `contributionId=${contributionId}`,
        { method: 'POST' }
      );

      const result = await response.json();

      if (result.status === 200) {
        Alert.alert(
          '✅ STK Push Sent',
          'Check your phone for M-Pesa prompt. Enter PIN to complete loan repayment.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to loans screen
                router.back();
              }
            }
          ]
        );
      } else {
        Alert.alert('❌ Failed', result.message || 'Payment initiation failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE': return '#FF4500';
      case 'ACTIVE': return '#2196F3';
      case 'APPROVED': return '#4CAF50';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading loan details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brandText}>
            <Text style={styles.brandMan}>MAN</Text>
            <Text style={styles.brandPower}>POWER</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back to Loans</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>💰 Loan Repayment</Text>

          {/* Loan Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Loan #{loanId?.toString().slice(-6)}</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Original Amount:</Text>
              <Text style={styles.detailValue}>
                KES {parseFloat(amount as string).toLocaleString('en-KE')}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Outstanding Balance:</Text>
              <Text style={[styles.detailValue, styles.outstandingAmount]}>
                KES {parseFloat(outstanding as string).toLocaleString('en-KE')}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Interest Rate:</Text>
              <Text style={styles.detailValue}>{interestRate}%</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date:</Text>
              <Text style={[
                styles.detailValue,
                new Date(dueDate as string) < new Date() && styles.overdueText
              ]}>
                {dueDate}
                {new Date(dueDate as string) < new Date() && ' ⚠️ Overdue'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={[styles.detailValue, { color: getStatusColor(status as string) }]}>
                {status}
              </Text>
            </View>
          </View>

          {/* Payment Section */}
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Make Payment</Text>

            {/* Phone Number Input - EDITABLE like Contributions screen */}
            <View style={styles.phoneInputContainer}>
              <TextInput
                placeholder="Enter Phone Number (07...)"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                style={styles.phoneInput}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!isProcessing}
              />
              {memberData?.phoneNumber === phoneNumber && (
                <View style={styles.phoneHint}>
                  <Text style={styles.phoneHintText}>✓ Your registered number</Text>
                </View>
              )}
              {memberData?.phoneNumber && memberData.phoneNumber !== phoneNumber && (
                <View style={styles.phoneHintWarning}>
                  <Text style={styles.phoneHintText}>⚠️ Different from registered number</Text>
                </View>
              )}
            </View>

            <Text style={styles.phoneNote}>
              {memberData?.phoneNumber ? 
                `Registered number: ${memberData.phoneNumber}. You can change it if needed.` : 
                'Enter the phone number you want to use for payment'}
            </Text>

            {/* Amount Input */}
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>KES</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                editable={!isProcessing}
              />
            </View>

            {/* Quick Amount Buttons */}
            <Text style={styles.quickAmountLabel}>Quick Amounts:</Text>
            <View style={styles.quickAmountsRow}>
              {[1000, 2000, 5000, 10000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickAmountBtn}
                  onPress={() => setPaymentAmount(amt.toString())}
                  disabled={isProcessing}
                >
                  <Text style={styles.quickAmountText}>
                    KES {amt.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Full Payment Button */}
            <TouchableOpacity
              style={styles.fullPaymentBtn}
              onPress={handleFullPayment}
              disabled={isProcessing}
            >
              <Text style={styles.fullPaymentText}>
                Pay Full Amount (KES {parseFloat(outstanding as string).toLocaleString('en-KE')})
              </Text>
            </TouchableOpacity>

            {/* Pay Button */}
            <TouchableOpacity
              style={[
                styles.payButton,
                (!paymentAmount || !phoneNumber || isProcessing) && styles.disabledButton
              ]}
              onPress={initiateMpesaPayment}
              disabled={!paymentAmount || !phoneNumber || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.payButtonIcon}>💰</Text>
                  <Text style={styles.payButtonText}>Pay via M-Pesa</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Note */}
            <Text style={styles.note}>
              ⓘ You will receive an STK push on the phone number entered above. Enter your M-Pesa PIN to complete the payment.
            </Text>
          </View>

          {/* Important Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>📋 Loan Repayment Terms</Text>
            <Text style={styles.infoText}>
              • Payments are processed instantly via M-Pesa{'\n'}
              • Your loan balance updates automatically after successful payment{'\n'}
              • You can make partial payments or pay the full amount{'\n'}
              • Overdue loans accrue additional interest - pay early to avoid penalties
            </Text>
          </View>
        </View>
      </ScrollView>

      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F9F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F9F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4CAF50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
    marginRight: 8,
  },
  brandText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  brandMan: {
    color: '#000000',
  },
  brandPower: {
    color: '#1B5E20',
  },
  backButton: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 15,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  outstandingAmount: {
    color: '#D32F2F',
    fontSize: 16,
  },
  overdueText: {
    color: '#FF4500',
    fontWeight: 'bold',
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  // Phone input styles - copied from Contributions screen
  phoneInputContainer: {
    width: '100%',
    marginBottom: 5,
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
    marginBottom: 5,
  },
  phoneHint: {
    backgroundColor: '#E8F5E9',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  phoneHintWarning: {
    backgroundColor: '#FFF3E0',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  phoneHintText: {
    fontSize: 12,
    color: '#2E7D32',
    textAlign: 'center',
  },
  phoneNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#F9F9F9',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 18,
    color: '#333',
  },
  quickAmountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
  },
  quickAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountBtn: {
    backgroundColor: '#F0F7F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  quickAmountText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  fullPaymentBtn: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  fullPaymentText: {
    color: '#E65100',
    fontSize: 14,
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: '#9E9E9E',
    opacity: 0.7,
  },
  payButtonIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    marginRight: 8,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  note: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 15,
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
});
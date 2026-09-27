import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://172.20.10.2:8080/api';

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
  }
};

interface DividendDeclaration {
  id: string;
  financialYear: string;
  percentageRate: number;
  declaredDate: string;
  approvedDate?: string;
  status: string;
}

interface MemberDividend {
  id: string;
  memberId: string;
  memberName: string;
  sharesAmount: number;
  dividendAmount: number;
  paymentStatus: string;
  paymentReference?: string;
}

interface Group {
  id: string;
  groupName: string;
}

export default function AdminDividendsScreen() {
  const [declarations, setDeclarations] = useState<DividendDeclaration[]>([]);
  const [pendingDividends, setPendingDividends] = useState<MemberDividend[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [financialYear, setFinancialYear] = useState('');
  const [percentageRate, setPercentageRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [adminName, setAdminName] = useState('');

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
    const storedAdminId = await AsyncStorage.getItem('userId');
    const storedGroupId = await AsyncStorage.getItem('userGroupId');
    
    console.log('🔍 Debug - storedAdminId:', storedAdminId);
    console.log('🔍 Debug - storedGroupId:', storedGroupId);
    
    setAdminId(storedAdminId);
    setGroupId(storedGroupId);
    
    if (storedGroupId && storedGroupId !== 'null' && storedGroupId !== 'undefined') {
      await fetchGroupName(storedGroupId);
    }
    
    if (storedAdminId) {
      await fetchAdminDetails(storedAdminId);
    }
    
    // ✅ Use storedGroupId directly to avoid React state timing issue
    if (storedGroupId && storedGroupId !== 'null' && storedGroupId !== 'undefined') {
      try {
        // Fetch declarations
        const declarationsRes = await fetch(`${BASE_URL}/dividends/declarations?groupId=${storedGroupId}`);
        if (declarationsRes.ok) {
          const declarationsData = await declarationsRes.json();
          setDeclarations(declarationsData);
        } else {
          console.error('Failed to fetch declarations:', declarationsRes.status);
        }
        
        // Fetch pending payments
        const pendingRes = await fetch(`${BASE_URL}/dividends/pending-payments?groupId=${storedGroupId}`);
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingDividends(pendingData);
        } else {
          console.error('Failed to fetch pending dividends:', pendingRes.status);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    } else {
      console.warn('⚠️ No valid groupId found');
    }
    
    setLoading(false);
  };

  const fetchAdminDetails = async (userId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/members/${userId}`);
      if (res.ok) {
        const member = await res.json();
        setAdminName(`${member.firstName} ${member.lastName}`);
        if (!groupId && member.group?.id) {
          setGroupId(member.group.id);
          await fetchGroupName(member.group.id);
        }
      }
    } catch (error) {
      console.error('Error fetching admin details:', error);
    }
  };

  const createDeclaration = async () => {
    if (!financialYear || !percentageRate) {
      showAlert('Error', 'Please fill all fields');
      return;
    }

    if (!groupId) {
      showAlert('Error', 'Group information not found');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/dividends/declarations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialYear,
          percentageRate: parseFloat(percentageRate),
          declaredDate: new Date().toISOString().split('T')[0],
          groupId: groupId,
          status: 'DRAFT'
        }),
      });

      if (res.ok) {
        showAlert('Success', 'Dividend declaration created for your group');
        setShowCreateModal(false);
        setFinancialYear('');
        setPercentageRate('');
        // Refresh declarations after creating
        if (groupId) {
          const declarationsRes = await fetch(`${BASE_URL}/dividends/declarations?groupId=${groupId}`);
          if (declarationsRes.ok) {
            const declarationsData = await declarationsRes.json();
            setDeclarations(declarationsData);
          }
        }
      } else {
        const errorText = await res.text();
        showAlert('Error', `Failed to create declaration: ${errorText}`);
      }
    } catch (error) {
      showAlert('Error', 'Connection failed');
    }
  };

  const approveDeclaration = async (declarationId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/dividends/declarations/${declarationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: adminId }),
      });

      if (res.ok) {
        showAlert('Success', 'Declaration approved! Dividends have been calculated for all members in your group.');
        // Refresh data after approval
        if (groupId) {
          const declarationsRes = await fetch(`${BASE_URL}/dividends/declarations?groupId=${groupId}`);
          if (declarationsRes.ok) {
            const declarationsData = await declarationsRes.json();
            setDeclarations(declarationsData);
          }
          
          const pendingRes = await fetch(`${BASE_URL}/dividends/pending-payments?groupId=${groupId}`);
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            setPendingDividends(pendingData);
          }
        }
      } else {
        const errorText = await res.text();
        showAlert('Error', `Failed to approve declaration: ${errorText}`);
      }
    } catch (error) {
      showAlert('Error', 'Connection failed');
    }
  };

  const processPayment = async (dividendId: string, paymentReference: string) => {
    try {
      const res = await fetch(`${BASE_URL}/dividends/${dividendId}/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, paymentReference }),
      });

      if (res.ok) {
        showAlert('Success', 'Payment processed successfully');
        // Refresh pending payments after processing
        if (groupId) {
          const pendingRes = await fetch(`${BASE_URL}/dividends/pending-payments?groupId=${groupId}`);
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            setPendingDividends(pendingData);
          }
        }
      } else {
        const errorText = await res.text();
        showAlert('Error', `Failed to process payment: ${errorText}`);
      }
    } catch (error) {
      showAlert('Error', 'Connection failed');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#388E3C" />
        <Text style={styles.loadingText}>Loading dividend management...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.groupNameHeader}>
            {groupName || 'MANPOWER'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.createBtnText}>+ New Dividend Declaration</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📢 Dividend Declarations</Text>
          {declarations.map((dec) => (
            <View key={dec.id} style={styles.declarationCard}>
              <View style={styles.declarationHeader}>
                <Text style={styles.declarationYear}>{dec.financialYear}</Text>
                <View style={[
                  styles.statusBadge,
                  dec.status === 'APPROVED' ? styles.approvedBadge : styles.draftBadge
                ]}>
                  <Text style={styles.statusText}>{dec.status}</Text>
                </View>
              </View>
              <Text style={styles.rateText}>Rate: {dec.percentageRate}%</Text>
              <Text style={styles.dateText}>Declared: {new Date(dec.declaredDate).toLocaleDateString()}</Text>
              {dec.approvedDate && (
                <Text style={styles.dateText}>Approved: {new Date(dec.approvedDate).toLocaleDateString()}</Text>
              )}
              {dec.status === 'DRAFT' && (
                <TouchableOpacity 
                  style={styles.approveBtn}
                  onPress={() => approveDeclaration(dec.id)}
                >
                  <Text style={styles.approveBtnText}>✓ Approve & Calculate Dividends</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {declarations.length === 0 && (
            <Text style={styles.emptyText}>No declarations yet. Create one above.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Pending Dividend Payments</Text>
          {pendingDividends.map((div) => (
            <View key={div.id} style={styles.paymentCard}>
              <Text style={styles.memberName}>{div.memberName}</Text>
              <Text style={styles.paymentAmount}>KES {div.dividendAmount.toLocaleString()}</Text>
              <Text style={styles.sharesText}>Shares: KES {div.sharesAmount.toLocaleString()}</Text>
              <View style={styles.paymentRow}>
                <TextInput
                  placeholder="M-PESA/Bank Ref"
                  style={styles.refInput}
                  onSubmitEditing={(e) => processPayment(div.id, e.nativeEvent.text)}
                />
                <TouchableOpacity 
                  style={styles.payBtn}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      const ref = window.prompt('Enter payment reference:');
                      if (ref) processPayment(div.id, ref);
                    } else {
                      Alert.alert('Process Payment', 'Enter payment reference:', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'OK',
                          onPress: (ref) => {
                            if (ref) processPayment(div.id, ref);
                          }
                        }
                      ]);
                    }
                  }}
                >
                  <Text style={styles.payBtnText}>Mark Paid</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {pendingDividends.length === 0 && (
            <Text style={styles.emptyText}>No pending payments</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Dividend Declaration</Text>
            <TextInput
              placeholder="Financial Year (e.g., 2024)"
              value={financialYear}
              onChangeText={setFinancialYear}
              style={styles.input}
              keyboardType="numeric"
            />
            <TextInput
              placeholder="Percentage Rate (e.g., 5.0)"
              value={percentageRate}
              onChangeText={setPercentageRate}
              style={styles.input}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={createDeclaration}>
              <Text style={styles.submitBtnText}>Create Declaration</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },
  scrollContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F5E9' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#388E3C' },
  
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#90CAF9',
    borderBottomWidth: 1,
    borderBottomColor: '#64B5F6',
    elevation: 3,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 35, height: 35, resizeMode: 'contain', marginRight: 8 },
  groupNameHeader: { fontSize: 14, fontWeight: '600', color: '#1565C0' },
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  backButtonText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },
  
  createBtn: { backgroundColor: '#2196F3', margin: 15, padding: 15, borderRadius: 8, alignItems: 'center' },
  createBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  section: { margin: 15, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20', marginBottom: 15 },
  declarationCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 15, marginBottom: 10, elevation: 2 },
  declarationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  declarationYear: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  approvedBadge: { backgroundColor: '#4CAF50' },
  draftBadge: { backgroundColor: '#FF9800' },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  rateText: { fontSize: 16, color: '#333', marginBottom: 5 },
  dateText: { fontSize: 12, color: '#666' },
  approveBtn: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  approveBtnText: { color: '#FFF', fontWeight: 'bold' },
  paymentCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 15, marginBottom: 10, elevation: 2 },
  memberName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  paymentAmount: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50', marginBottom: 5 },
  sharesText: { fontSize: 12, color: '#666', marginBottom: 10 },
  paymentRow: { flexDirection: 'row', gap: 10 },
  refInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8 },
  payBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, justifyContent: 'center' },
  payBtnText: { color: '#FFF', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { backgroundColor: '#FFF', borderRadius: 10, width: '85%', padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15 },
  submitBtn: { backgroundColor: '#2196F3', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold' },
  cancelText: { textAlign: 'center', color: '#D32F2F', marginTop: 10 },
});
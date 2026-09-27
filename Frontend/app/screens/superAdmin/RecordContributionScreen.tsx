import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

const BASE_URL = 'http://192.168.0.101:8080/api';

export default function RecordContributionScreen(): React.JSX.Element {
  const router = useRouter();

  const [members, setMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [memberId, setMemberId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [transactionType, setTransactionType] = useState('Contribution');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [status, setStatus] = useState('Completed');
  const [description, setDescription] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setCurrentUserId(user.id);
        }

        const memberRes = await fetch(`${BASE_URL}/members`);
        const memberData = await memberRes.json();
        setMembers(memberData);
        if (memberData.length > 0) setMemberId(memberData[0].id);

        const groupRes = await fetch(`${BASE_URL}/groups`);
        const groupData = await groupRes.json();
        setGroups(groupData);
        if (groupData.length > 0) setGroupId(groupData[0].id);
      } catch (err) {
        console.error('Data fetch error:', err);
        Alert.alert('Error', 'Failed to load members or groups.');
      }
    };

    fetchInitialData();
  }, []);

  const handleSubmit = async () => {
    if (!amount || !transactionDate || !description || !memberId || !groupId) {
      Alert.alert('Validation Error', 'Please fill all required fields.');
      return;
    }

    const selectedMember = members.find((m) => m.id === memberId);
    const selectedGroup = groups.find((g) => g.id === groupId);

    if (!selectedMember || !selectedGroup || !currentUserId) {
      Alert.alert('Error', 'Member, Group or User not loaded correctly.');
      return;
    }

    const now = new Date().toISOString();

    const payload = {
      member: selectedMember,
      group: selectedGroup,
      transactionType,
      amount: parseFloat(amount),
      transactionDate,
      paymentMethod,
      status,
      description,
      createdBy: currentUserId,
      modifiedBy: currentUserId,
      createdOn: now,
      modifiedOn: now,
      mansoftTenantId: selectedGroup.mansoftTenantId || 'tenant-001',
    };

    console.log('📤 Contribution Payload:', payload);

    try {
      const res = await fetch(`${BASE_URL}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('📡 API Response Status:', res.status);

      const resText = await res.text(); // in case the response is not JSON
      console.log('📥 Raw Response Text:', resText);

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}: ${resText}`);
      }

      Alert.alert('✅ Success', 'Contribution recorded successfully!');
      setAmount('');
      setTransactionDate('');
      setDescription('');
    } catch (err) {
      console.error('❌ POST error:', err);
      Alert.alert('Error', 'Could not save contribution.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.logoWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.logoTextContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(superadmin)/dashboard')}>
          <Text style={styles.returnHomeText}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Record New Contribution</Text>
        <Text style={styles.subtitle}>Fill the form below to record a new contribution or transaction.</Text>

        <Text style={styles.label}>Member</Text>
        <View style={styles.picker}>
          <Picker selectedValue={memberId} onValueChange={setMemberId}>
            {members.map((m) => (
              <Picker.Item key={m.id} label={`${m.firstName} ${m.lastName}`} value={m.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Group</Text>
        <View style={styles.picker}>
          <Picker selectedValue={groupId} onValueChange={setGroupId}>
            {groups.map((g) => (
              <Picker.Item key={g.id} label={g.groupName} value={g.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Transaction Type</Text>
        <View style={styles.picker}>
          <Picker selectedValue={transactionType} onValueChange={setTransactionType}>
            <Picker.Item label="Contribution" value="Contribution" />
            <Picker.Item label="Expense" value="Expense" />
            <Picker.Item label="Loan Payment" value="Loan Payment" />
          </Picker>
        </View>

        <Text style={styles.label}>Amount</Text>
        <TextInput style={styles.input} keyboardType="numeric" placeholder="Enter amount" value={amount} onChangeText={setAmount} />

        <Text style={styles.label}>Transaction Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} placeholder="2025-07-15" value={transactionDate} onChangeText={setTransactionDate} />

        <Text style={styles.label}>Payment Method</Text>
        <View style={styles.picker}>
          <Picker selectedValue={paymentMethod} onValueChange={setPaymentMethod}>
            <Picker.Item label="M-Pesa" value="M-Pesa" />
            <Picker.Item label="Bank Transfer" value="Bank Transfer" />
            <Picker.Item label="Cash" value="Cash" />
          </Picker>
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.picker}>
          <Picker selectedValue={status} onValueChange={setStatus}>
            <Picker.Item label="Completed" value="Completed" />
            <Picker.Item label="Pending" value="Pending" />
          </Picker>
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Add any notes..."
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Submit Contribution</Text>
        </TouchableOpacity>
      </ScrollView>

      <SuperAdminBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E9' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomColor: '#A5D6A7',
    borderBottomWidth: 1,
  },
  logoWrapper: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  logoTextContainer: { flexDirection: 'row' },
  titleBlack: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  titleRed: { fontSize: 20, fontWeight: 'bold', color: '#D32F2F', marginLeft: 4 },
  returnHomeText: { fontSize: 14, fontWeight: '600', color: '#1565C0' },
  container: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 5, color: '#333' },
  input: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  button: {
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

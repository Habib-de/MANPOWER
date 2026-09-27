import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import MemberBottomNav from '../../components/MemberBottomNav';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.0.101:8080/api';

type DocumentItem = {
  id: string;
  group_id: string;
  documentType: string;
  fileName: string;
  filePath_URL: string;
  uploadDate: string;
  uploadedBy_member_id: string;
  created_by: string;
  modified_by: string;
  created_on: string;
  modified_on: string;
  mansoft_tenant_id: string;
};

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [loading, setLoading] = useState(true);

  const FILTERS = ['All', 'Financial Report', 'Meeting Minutes'];

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);

        const storedMember = await AsyncStorage.getItem('loggedMember');
        if (!storedMember) throw new Error('User not logged in');

        const member = JSON.parse(storedMember);
        const groupId = member.group?.id;

        const res = await fetch(`${BASE_URL}/documents`);
        if (!res.ok) throw new Error('Failed to fetch documents');

        const allDocuments = await res.json();
        const filteredDocs = allDocuments.filter(
          (doc: DocumentItem) => doc.group_id === groupId
        );

        setDocuments(filteredDocs);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to fetch documents.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const openDocument = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Unable to open document.')
    );
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'All' || doc.documentType === filterType;
    return matchesSearch && matchesType;
  });

  const renderItem = ({ item }: { item: DocumentItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDocument(item.filePath_URL)}>
      <Image
        source={require('../../../assets/images/logo.png')}
        style={styles.icon}
      />
      <View style={styles.info}>
        <Text style={styles.fileName}>{item.fileName}</Text>
        <Text style={styles.meta}>📁 {item.documentType}</Text>
        <Text style={styles.meta}>👤 {item.uploadedBy_member_id}</Text>
        <Text style={styles.meta}>🗓️ {item.uploadDate}</Text>
        <Text style={styles.meta}>🛠 {item.created_by}</Text>
        <Text style={styles.meta}>🏷 {item.mansoft_tenant_id}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
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
        <TouchableOpacity onPress={() => router.replace('/(member)/dashboard')}>
          <Text style={styles.returnButton}>🏠 Dashboard</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>📄 Member Documents</Text>

      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search documents..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Fixed Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTERS.map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterButton,
              filterType === type && styles.activeFilterButton,
            ]}
            onPress={() => setFilterType(type)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === type && styles.activeFilterButtonText,
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredDocuments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No documents found.</Text>}
        />
      )}

      {/* Bottom Nav */}
      <MemberBottomNav current="documents" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#C8E6C9',
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
    elevation: 3,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 8 },
  brandText: { fontSize: 18, fontWeight: 'bold' },
  brandMan: { color: '#000000' },
  brandPower: { color: '#D32F2F' },
  returnButton: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },

  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginVertical: 10,
  },

  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderColor: '#C8E6C9',
    borderWidth: 1,
  },

  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  filterButton: {
    backgroundColor: '#A5D6A7',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#FFA726',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  activeFilterButtonText: {
    color: '#FFF',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    alignItems: 'center',
  },
  icon: {
    width: 40,
    height: 40,
    marginRight: 16,
    resizeMode: 'contain',
  },
  info: { flex: 1 },
  fileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 30,
    fontSize: 14,
  },
});

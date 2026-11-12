import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';

export default function GroupContributionsScreen() {
  const { groupId } = useLocalSearchParams();
  const [groupData, setGroupData] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (groupId) {
      fetchGroupData();
    }
  }, [groupId]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      
      // Fetch contributions for this group
      const contributionsRes = await axios.get(
        `http://localhost:8080/api/contributions/group/${groupId}`
      );
      
      const groupContributions = contributionsRes.data;
      
      if (groupContributions.length > 0) {
        // Get group info from first contribution
        const groupInfo = groupContributions[0].group;
        
        // Calculate totals
        const totalAmount = groupContributions.reduce((sum: number, contribution: any) => 
          sum + (contribution.amount || 0), 0
        );

        // Calculate member contributions
        const memberContributions = groupContributions.reduce((acc: any, contribution: any) => {
          const memberId = contribution.member.id;
          const memberName = `${contribution.member.firstName} ${contribution.member.lastName}`;
          
          if (!acc[memberId]) {
            acc[memberId] = {
              memberName,
              totalAmount: 0,
              count: 0,
              contributions: []
            };
          }
          
          acc[memberId].totalAmount += contribution.amount || 0;
          acc[memberId].count += 1;
          acc[memberId].contributions.push(contribution);
          
          return acc;
        }, {});

        setGroupData({
          groupInfo,
          summary: {
            totalAmount,
            totalContributions: groupContributions.length,
            averageAmount: groupContributions.length ? totalAmount / groupContributions.length : 0,
            memberContributions: Object.values(memberContributions)
          }
        });
        
        setContributions(groupContributions);
      } else {
        // If no contributions, fetch group info directly
        const groupsRes = await axios.get('http://localhost:8080/api/groups');
        const groupInfo = groupsRes.data.find((g: any) => g.id === groupId);
        
        setGroupData({
          groupInfo,
          summary: {
            totalAmount: 0,
            totalContributions: 0,
            averageAmount: 0,
            memberContributions: []
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch group data:', error);
      Alert.alert('Error', 'Failed to load group contributions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text>Loading Group Contributions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Not Found</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.container}>
          <Text style={styles.noData}>Group data not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Contributions</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.container}>
        {/* Group Header */}
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{groupData.groupInfo.groupName}</Text>
          <Text style={styles.groupDescription}>
            {groupData.groupInfo.description}
          </Text>
        </View>

        {/* Group Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>GROUP SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryValue}>
                KES {groupData.summary.totalAmount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Contributions</Text>
              <Text style={styles.summaryValue}>
                {groupData.summary.totalContributions}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Average</Text>
              <Text style={styles.summaryValue}>
                KES {Math.round(groupData.summary.averageAmount).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Member Contributions Summary */}
        {groupData.summary.memberContributions.length > 0 && (
          <View style={styles.membersCard}>
            <Text style={styles.sectionTitle}>MEMBER CONTRIBUTIONS</Text>
            {groupData.summary.memberContributions.map((member: any, index: number) => (
              <View key={index} style={styles.memberSummary}>
                <View style={styles.memberHeader}>
                  <Text style={styles.memberName}>{member.memberName}</Text>
                  <Text style={styles.memberTotal}>
                    KES {member.totalAmount.toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.memberDetails}>
                  {member.count} contributions • Avg: KES {Math.round(member.totalAmount / member.count).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* All Contributions */}
        <View style={styles.contributionsCard}>
          <Text style={styles.sectionTitle}>
            ALL CONTRIBUTIONS ({contributions.length})
          </Text>
          
          {contributions.length === 0 ? (
            <Text style={styles.noData}>No contributions found for this group</Text>
          ) : (
            contributions.map((contribution, index) => (
              <View key={contribution.id} style={styles.contributionItem}>
                <Text style={styles.contributionNumber}>#{index + 1}</Text>
                <View style={styles.contributionDetails}>
                  <Text style={styles.amountText}>
                    KES {contribution.amount?.toLocaleString() || '0'}
                  </Text>
                  <Text style={styles.memberText}>
                    By: {contribution.member.firstName} {contribution.member.lastName}
                  </Text>
                  <Text style={styles.description}>
                    {contribution.description || 'No description'}
                  </Text>
                  <View style={styles.metaInfo}>
                    <Text style={styles.date}>
                      Date: {formatDate(contribution.transactionDate)}
                    </Text>
                    <Text style={styles.paymentMethod}>
                      • {contribution.paymentMethod}
                    </Text>
                    <Text style={styles.status}>
                      • {contribution.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    padding: 15,
    borderBottomColor: '#A5D6A7',
    borderBottomWidth: 1,
  },
  backButton: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  container: {
    flex: 1,
    padding: 15,
  },
  groupHeader: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  groupDescription: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },
  membersCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },
  contributionsCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 5,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  memberSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  memberTotal: {
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  memberDetails: {
    fontSize: 12,
    color: '#666',
  },
  contributionItem: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingVertical: 12,
  },
  contributionNumber: {
    fontWeight: 'bold',
    marginRight: 10,
    color: '#666',
    width: 30,
  },
  contributionDetails: {
    flex: 1,
  },
  amountText: {
    fontWeight: '600',
    color: '#333',
    fontSize: 16,
  },
  memberText: {
    color: '#444',
    fontSize: 14,
    marginTop: 2,
  },
  description: {
    color: '#555',
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  metaInfo: {
    flexDirection: 'row',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  date: {
    color: '#888',
    fontSize: 11,
  },
  paymentMethod: {
    color: '#888',
    fontSize: 11,
    marginLeft: 8,
  },
  status: {
    color: '#4CAF50',
    fontSize: 11,
    marginLeft: 8,
    fontWeight: '600',
  },
  noData: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
});
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
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

const BASE_URL = 'http://192.168.0.101:8080/api';

interface User {
  email: string;
  role: string;
  groupId?: string;
  firstName: string;
  lastName: string;
}

export default function ContributionReportScreen() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const userRole = await AsyncStorage.getItem('userRole');
      const userGroupId = await AsyncStorage.getItem('userGroupId');
      const userFirstName = await AsyncStorage.getItem('userFirstName');
      const userLastName = await AsyncStorage.getItem('userLastName');

      if (userEmail && userRole && userFirstName && userLastName) {
        const user: User = {
          email: userEmail,
          role: userRole,
          groupId: userGroupId || undefined,
          firstName: userFirstName,
          lastName: userLastName,
        };
        setCurrentUser(user);
        await fetchReportData(user);
      } else {
        Alert.alert('Error', 'User data not found. Please login again.');
        router.replace('/(auth)');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const fetchReportData = async (user: User) => {
    try {
      let contributionsUrl = `${BASE_URL}/contributions`;
      
      if (user.role === 'GroupAdmin' && user.groupId) {
        contributionsUrl = `${BASE_URL}/contributions/group/${user.groupId}`;
      }

      console.log('Fetching from URL:', contributionsUrl);
      console.log('User role:', user.role);
      console.log('User groupId:', user.groupId);

      const contributionsRes = await axios.get(contributionsUrl);
      const contributions = contributionsRes.data;

      const totalAmount = contributions.reduce((sum: number, contribution: any) => 
        sum + (contribution.amount || 0), 0
      );

      const groupsSummary = contributions.reduce((acc: any, contribution: any) => {
        const groupIdKey = contribution.group?.id;
        const groupName = contribution.group?.groupName;
        
        if (groupIdKey && !acc[groupIdKey]) {
          acc[groupIdKey] = {
            groupName,
            totalAmount: 0,
            count: 0
          };
        }
        
        if (groupIdKey) {
          acc[groupIdKey].totalAmount += contribution.amount || 0;
          acc[groupIdKey].count += 1;
        }
        
        return acc;
      }, {});

      setReportData({
        contributions: contributions,
        summary: {
          totalAmount: totalAmount,
          totalContributions: contributions.length,
          averageAmount: contributions.length ? totalAmount / contributions.length : 0,
          groupsSummary: Object.values(groupsSummary)
        }
      });
    } catch (error) {
      console.error('Failed to fetch report data:', error);
      Alert.alert('Error', 'Failed to load report data');
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

  const getMemberName = (member: any) => {
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown Member';
  };

  const exportToCSV = async () => {
    try {
      setExporting(true);
      setExportModalVisible(false);

      if (!reportData?.contributions) {
        Alert.alert('Error', 'No data to export');
        return;
      }

      let csvContent = '';
      
      csvContent += 'CONTRIBUTION REPORT SUMMARY\n';
      csvContent += `Generated,${new Date().toLocaleDateString()}\n`;
      csvContent += `Total Amount,KES ${reportData.summary.totalAmount.toLocaleString()}\n`;
      csvContent += `Total Contributions,${reportData.summary.totalContributions}\n`;
      csvContent += `Average Contribution,KES ${reportData.summary.averageAmount.toFixed(2)}\n`;
      csvContent += '\n';
      
      csvContent += 'DETAILED CONTRIBUTIONS\n';
      csvContent += 'Date,Member,Group,Amount,Payment Method,Status,Description\n';
      
      reportData.contributions.forEach((contribution: any) => {
        const date = formatDate(contribution.transactionDate);
        const member = `${contribution.member.firstName} ${contribution.member.lastName}`;
        const group = contribution.group.groupName;
        const amount = contribution.amount;
        const paymentMethod = contribution.paymentMethod;
        const status = contribution.status;
        const description = `"${(contribution.description || '').replace(/"/g, '""')}"`;
        
        csvContent += `${date},${member},${group},${amount},${paymentMethod},${status},${description}\n`;
      });

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `contribution-report-${new Date().toISOString().split('T')[0]}.csv`;
        
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        Alert.alert('Success', 'CSV file downloaded');
      } else {
        const fileName = `contribution-report-${new Date().toISOString().split('T')[0]}.csv`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Share Contribution Report',
          UTI: 'public.comma-separated-values-text'
        });

        Alert.alert('Success', 'Report exported as CSV');
      }
    } catch (error) {
      console.error('CSV export failed:', error);
      Alert.alert('Export Failed', 'Could not export the report as CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);
      setExportModalVisible(false);

      if (!reportData?.contributions) {
        Alert.alert('Error', 'No data to export');
        return;
      }

      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <title>Contribution Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
              .header { text-align: center; color: #2E7D32; border-bottom: 2px solid #2E7D32; padding-bottom: 10px; margin-bottom: 20px; }
              .summary { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #2E7D32; }
              .table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
              .table th { background: #2E7D32; color: white; padding: 10px; text-align: left; border: 1px solid #1B5E20; }
              .table td { padding: 8px; border: 1px solid #ddd; }
              .table tr:nth-child(even) { background: #f9f9f9; }
              .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>MANPOWER - Contribution Report</h1>
              <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="summary">
              <h3>Summary</h3>
              <p><strong>Total Amount:</strong> KES ${reportData.summary.totalAmount.toLocaleString()}</p>
              <p><strong>Total Contributions:</strong> ${reportData.summary.totalContributions}</p>
              <p><strong>Average Contribution:</strong> KES ${reportData.summary.averageAmount.toFixed(2)}</p>
            </div>

            <h3>Detailed Contributions</h3>
            <table class="table">
              <thead>
                <tr><th>Date</th><th>Member</th><th>Group</th><th>Amount (KES)</th><th>Payment Method</th><th>Status</th><th>Description</th></tr>
              </thead>
              <tbody>
                ${reportData.contributions.map((contribution: any) => `
                  <tr>
                    <td>${formatDate(contribution.transactionDate)}</td>
                    <td>${contribution.member.firstName} ${contribution.member.lastName}</td>
                    <td>${contribution.group.groupName}</td>
                    <td>${contribution.amount.toLocaleString()}</td>
                    <td>${contribution.paymentMethod}</td>
                    <td>${contribution.status}</td>
                    <td>${contribution.description || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer"><p>Report generated by MANPOWER System</p></div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
          newWindow.focus();
          setTimeout(() => newWindow.print(), 500);
        }
        Alert.alert('Success', 'PDF opened for printing');
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Contribution Report PDF', UTI: 'com.adobe.pdf' });
        Alert.alert('Success', 'Report exported as PDF');
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      Alert.alert('Export Failed', 'Could not generate PDF');
    } finally {
      setExporting(false);
    }
  };

  const ExportMenu = () => (
    <Modal animationType="slide" transparent visible={exportModalVisible} onRequestClose={() => setExportModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.exportMenu}>
          <Text style={styles.exportMenuTitle}>Export Report As</Text>
          <TouchableOpacity style={styles.exportOption} onPress={exportToCSV} disabled={exporting}>
            <Text style={styles.exportOptionText}>📊 CSV File</Text>
            <Text style={styles.exportOptionSubtext}>Excel-compatible format</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportOption} onPress={exportToPDF} disabled={exporting}>
            <Text style={styles.exportOptionText}>📄 PDF Document</Text>
            <Text style={styles.exportOptionSubtext}>Printable format</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportOption, styles.cancelOption]} onPress={() => setExportModalVisible(false)} disabled={exporting}>
            <Text style={styles.cancelOptionText}>Cancel</Text>
          </TouchableOpacity>
          {exporting && (
            <View style={styles.exportingOverlay}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.exportingText}>Exporting...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading || !currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Loading report data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.logoNameWrapper}>
          <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
          <View style={styles.textLogoContainer}>
            <Text style={styles.titleBlack}>MAN</Text>
            <Text style={styles.titleRed}>POWER</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userInfo}>
            {currentUser.firstName} {currentUser.lastName} ({currentUser.role})
          </Text>
          <TouchableOpacity onPress={() => {
            if (currentUser.role === 'SuperAdmin') {
              router.push('/(superadmin)/dashboard');
            } else if (currentUser.role === 'GroupAdmin') {
              router.push('/(groupadmin)/dashboard');
            } else {
              router.push('/(member)/dashboard');
            }
          }}>
            <Text style={styles.homeLink}>🏠 Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container}>
        <Text style={styles.title}>📊 Contribution Report</Text>
        <Text style={styles.subtitle}>
          {currentUser.role === 'GroupAdmin' 
            ? `View all contribution records for your group. Export data to CSV or PDF for offline analysis.`
            : `View contribution records across all groups. Export data to CSV or PDF for reporting.`
          }
        </Text>

        {/* Summary Card */}
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text>Total Amount:</Text>
            <Text style={styles.amount}>
              KES {reportData?.summary?.totalAmount?.toLocaleString() || '0'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Contributions:</Text>
            <Text>{reportData?.summary?.totalContributions || 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Average Contribution:</Text>
            <Text>KES {reportData?.summary?.averageAmount?.toFixed(2) || '0'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Report Generated:</Text>
            <Text>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Groups Summary - Only for Super Admin */}
        {currentUser.role === 'SuperAdmin' && reportData?.summary?.groupsSummary && reportData.summary.groupsSummary.length > 1 && (
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>GROUPS BREAKDOWN</Text>
            {reportData.summary.groupsSummary.map((group: any, index: number) => (
              <View key={index} style={styles.groupSummaryItem}>
                <View style={styles.groupSummaryHeader}>
                  <Text style={styles.groupName}>{group.groupName}</Text>
                  <Text style={styles.groupAmount}>KES {group.totalAmount.toLocaleString()}</Text>
                </View>
                <Text style={styles.groupDetails}>
                  {group.count} contributions • Avg: KES {Math.round(group.totalAmount / group.count).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Contributions List */}
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>
            CONTRIBUTION DETAILS ({reportData?.contributions?.length || 0} records)
            {currentUser.role === 'GroupAdmin' && reportData?.contributions?.[0]?.group?.groupName && 
              ` - ${reportData.contributions[0].group.groupName}`
            }
          </Text>
          
          {reportData?.contributions?.length === 0 ? (
            <Text style={styles.noData}>No contributions found</Text>
          ) : (
            reportData?.contributions?.map((contribution: any, index: number) => (
              <View key={contribution.id} style={styles.contributionItem}>
                <Text style={styles.contributionNumber}>#{index + 1}</Text>
                <View style={styles.contributionDetails}>
                  <Text style={styles.amountText}>
                    KES {contribution.amount?.toLocaleString() || '0'}
                  </Text>
                  <Text style={styles.memberText}>
                    By: {getMemberName(contribution.member)}
                  </Text>
                  {currentUser.role === 'SuperAdmin' && (
                    <Text style={styles.groupText}>
                      Group: {contribution.group?.groupName || 'Unknown'}
                    </Text>
                  )}
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
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Export Button */}
      <TouchableOpacity style={styles.exportFAB} onPress={() => setExportModalVisible(true)} disabled={exporting}>
        {exporting ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.exportFABText}>📊 Export Report</Text>
        )}
      </TouchableOpacity>

      <ExportMenu />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFB74D',
  },
  logoNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  textLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlack: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  titleRed: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginLeft: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  userInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  homeLink: {
    fontSize: 14,
    color: '#D84315',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
    lineHeight: 20,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amount: {
    fontWeight: 'bold',
    color: '#2E7D32',
    fontSize: 16,
  },
  groupSummaryItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  groupSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  groupAmount: {
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  groupDetails: {
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
  groupText: {
    color: '#666',
    fontSize: 12,
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
  noData: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  exportFAB: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 5,
  },
  exportFABText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportMenu: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  exportMenuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2E7D32',
  },
  exportOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  exportOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  exportOptionSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cancelOption: {
    borderBottomWidth: 0,
    marginTop: 10,
    alignItems: 'center',
  },
  cancelOptionText: {
    fontSize: 16,
    color: '#D32F2F',
    fontWeight: '600',
  },
  exportingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  exportingText: {
    marginTop: 10,
    color: '#2E7D32',
    fontWeight: '600',
  },
});
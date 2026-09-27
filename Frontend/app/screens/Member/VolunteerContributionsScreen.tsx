import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../../app/_layout';
import MemberBottomNav from '../../components/MemberBottomNav';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = 'http://192.168.0.101:8080/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========== INTERFACES ==========
interface VolunteerCampaign {
  id: string;
  campaignName: string;
  description: string;
  targetAmount: number | null;
  raisedAmount: number;
  progress: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  createdByName: string;
  createdOn: string;
  contributorCount: number;
  totalContributions: number;
  daysRemaining: number;
  isOpen: boolean;
  isExpired: boolean;
  contributions: VolunteerContribution[];
}

interface VolunteerContribution {
  id: string;
  memberId?: string;
  member?: { 
    id: string; 
    firstName: string; 
    lastName: string;
    email?: string;
  };
  amount: number;
  description: string;
  contributionDate: string;
  status: string;
  paymentMethod?: string;
  createdOn: string;
}

interface MemberCache {
  [key: string]: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

type FilterType = 'all' | 'active' | 'closed' | 'completed';

function VolunteerContributionsScreen() {
  const { setUserRole } = useContext(AuthContext)!;
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [memberId, setMemberId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('');
  const [memberCache, setMemberCache] = useState<MemberCache>({});
  
  // ========== STATE FOR CAMPAIGNS ==========
  const [campaigns, setCampaigns] = useState<VolunteerCampaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<VolunteerCampaign[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  
  // Filter states
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Available months and years
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  
  const ALL_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken', 'userId', 'userEmail', 'userFirstName',
        'userLastName', 'userRole', 'userStatus', 'userTenantId',
        'userGroupId', 'userPhoneNumber', 'userJoinDate', 'userCreatedBy',
        'userModifiedBy', 'userCreatedOn', 'userModifiedOn',
        'memberCache'
      ]);
      setUserRole(null);
      router.replace('/(auth)');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  const fetchMemberData = async () => {
    try {
      const storedId = await AsyncStorage.getItem('userId');
      const storedGroupId = await AsyncStorage.getItem('userGroupId');
      const storedGroupName = await AsyncStorage.getItem('userGroupName');
      const storedFirstName = await AsyncStorage.getItem('userFirstName');
      const storedLastName = await AsyncStorage.getItem('userLastName');

      if (storedId) setMemberId(storedId);
      if (storedGroupId) setGroupId(storedGroupId);
      if (storedGroupName) setGroupName(storedGroupName);

      // Load member cache
      const cacheStr = await AsyncStorage.getItem('memberCache');
      if (cacheStr) {
        setMemberCache(JSON.parse(cacheStr));
      } else {
        // Initialize cache with current user
        if (storedId && storedFirstName && storedLastName) {
          const initialCache: MemberCache = {
            [storedId]: {
              id: storedId,
              firstName: storedFirstName,
              lastName: storedLastName,
            }
          };
          setMemberCache(initialCache);
          await AsyncStorage.setItem('memberCache', JSON.stringify(initialCache));
        }
      }
    } catch (error) {
      console.error('Error fetching member data:', error);
    }
  };

  // ========== Helper function to get member name ==========
  const getMemberName = async (memberId: string) => {
    // Check cache first
    if (memberCache[memberId]) {
      return memberCache[memberId];
    }

    // Check if it's the current user
    const currentUserId = await AsyncStorage.getItem('userId');
    if (currentUserId === memberId) {
      const firstName = await AsyncStorage.getItem('userFirstName');
      const lastName = await AsyncStorage.getItem('userLastName');
      if (firstName && lastName) {
        const member = {
          id: memberId,
          firstName,
          lastName,
        };
        
        // Update cache
        const updatedCache = { ...memberCache, [memberId]: member };
        setMemberCache(updatedCache);
        await AsyncStorage.setItem('memberCache', JSON.stringify(updatedCache));
        
        return member;
      }
    }

    // If not in cache, try to fetch from API
    try {
      const response = await fetch(`${BASE_URL}/members/${memberId}`);
      if (response.ok) {
        const memberData = await response.json();
        const member = {
          id: memberData.id,
          firstName: memberData.firstName || 'Unknown',
          lastName: memberData.lastName || 'Member',
        };
        
        // Update cache
        const updatedCache = { ...memberCache, [memberId]: member };
        setMemberCache(updatedCache);
        await AsyncStorage.setItem('memberCache', JSON.stringify(updatedCache));
        
        return member;
      }
    } catch (error) {
      console.error(`Error fetching member ${memberId}:`, error);
    }

    // Fallback to extracting from description
    return null;
  };

  // ========== Fetch campaigns with member names ==========
  const fetchVolunteerCampaigns = async () => {
    try {
      if (!groupId) {
        console.log('No group ID found');
        setLoading(false);
        return;
      }

      // 1. Fetch all campaigns for the group
      const campaignsResponse = await fetch(`${BASE_URL}/volunteer-campaigns/group/${groupId}`);
      
      if (!campaignsResponse.ok) {
        throw new Error('Failed to fetch campaigns');
      }

      const allCampaigns: VolunteerCampaign[] = await campaignsResponse.json();
      
      // 2. For each campaign, fetch its contributions and enhance with member names
      const campaignsWithContributions = await Promise.all(
        allCampaigns.map(async (campaign) => {
          try {
            const contributionsResponse = await fetch(
              `${BASE_URL}/volunteer-contributions/campaign/${campaign.id}`
            );
            
            if (contributionsResponse.ok) {
              const contributions = await contributionsResponse.json();
              
              // Enhance contributions with member names
              const enhancedContributions = await Promise.all(
                contributions.map(async (c: any) => {
                  // Try to get member name from cache/API
                  const member = await getMemberName(c.memberId);
                  
                  if (member) {
                    return {
                      ...c,
                      member: {
                        id: c.memberId,
                        firstName: member.firstName,
                        lastName: member.lastName,
                      }
                    };
                  }
                  
                  // Fallback: extract from description
                  let firstName = 'Unknown';
                  let lastName = 'Member';
                  
                  if (c.description) {
                    const match = c.description.match(/volunteer_([^\s|]+)/);
                    if (match && match[1]) {
                      const nameParts = match[1].split('_');
                      if (nameParts.length >= 2) {
                        firstName = nameParts[0];
                        lastName = nameParts.slice(1).join(' ');
                      } else {
                        firstName = nameParts[0];
                        lastName = '';
                      }
                    }
                  }
                  
                  return {
                    ...c,
                    member: {
                      id: c.memberId,
                      firstName: firstName,
                      lastName: lastName,
                    }
                  };
                })
              );
              
              // MANUALLY CALCULATE STATS FROM CONTRIBUTIONS
              const totalRaised = enhancedContributions.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
              
              // Get unique contributors
              const uniqueContributors = new Set(
                enhancedContributions.map((c: any) => c.memberId)
              ).size;
              
              const totalContributions = enhancedContributions.length;
              
              // Calculate progress percentage
              const progress = campaign.targetAmount && campaign.targetAmount > 0
                ? (totalRaised / campaign.targetAmount) * 100
                : 0;
              
              return { 
                ...campaign, 
                contributions: enhancedContributions,
                raisedAmount: totalRaised,
                contributorCount: uniqueContributors,
                totalContributions: totalContributions,
                progress: progress
              };
            }
          } catch (error) {
            console.error(`Error fetching contributions for campaign ${campaign.id}:`, error);
          }
          return { ...campaign, contributions: [] };
        })
      );

      // Sort by created date (newest first)
      campaignsWithContributions.sort((a, b) => 
        new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
      );

      setCampaigns(campaignsWithContributions);
      setFilteredCampaigns(campaignsWithContributions);
      
      // Extract available years
      extractAvailableYears(campaignsWithContributions);
      
    } catch (error) {
      console.error('Error fetching volunteer campaigns:', error);
      Alert.alert('Error', 'Failed to load volunteer campaigns.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const extractAvailableYears = (campaigns: VolunteerCampaign[]) => {
    const yearsSet = new Set<string>();
    const currentYear = new Date().getFullYear().toString();
    yearsSet.add(currentYear);
    
    campaigns.forEach(campaign => {
      try {
        const date = new Date(campaign.startDate);
        if (!isNaN(date.getTime())) {
          yearsSet.add(date.getFullYear().toString());
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    });
    
    const yearsArray = Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
    setAvailableYears(yearsArray);
  };

  // ========== Apply filters to campaigns ==========
  const applyFilters = () => {
    let filtered = [...campaigns];

    // Filter by status
    switch (filterType) {
      case 'active':
        filtered = filtered.filter(c => c.status === 'ACTIVE' && !c.isExpired);
        break;
      case 'closed':
        filtered = filtered.filter(c => c.status === 'CLOSED' || c.isExpired);
        break;
      case 'completed':
        filtered = filtered.filter(c => c.status === 'COMPLETED');
        break;
      case 'all':
      default:
        break;
    }

    // Filter by date
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(campaign => {
        const date = new Date(campaign.startDate);
        const month = date.toLocaleString('en-US', { month: 'long' });
        return month === selectedMonth;
      });
    }

    if (selectedYear !== 'all') {
      filtered = filtered.filter(campaign => {
        const date = new Date(campaign.startDate);
        return date.getFullYear().toString() === selectedYear;
      });
    }

    setFilteredCampaigns(filtered);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setFilterType('all');
    setSelectedMonth('all');
    setSelectedYear('all');
    setFilteredCampaigns(campaigns);
    setShowFilterModal(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVolunteerCampaigns();
    resetFilters();
  };

  useEffect(() => {
    fetchMemberData();
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchVolunteerCampaigns();
    }
  }, [groupId]);

  // ========== Helper functions ==========
  const getStatusColor = (status: string, isExpired: boolean) => {
    if (isExpired) return '#FF9800';
    switch (status) {
      case 'ACTIVE':
        return '#4CAF50';
      case 'COMPLETED':
        return '#2196F3';
      case 'CLOSED':
        return '#9E9E9E';
      case 'CANCELLED':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusText = (campaign: VolunteerCampaign) => {
    if (campaign.isExpired) return 'EXPIRED';
    if (campaign.status === 'ACTIVE' && campaign.targetAmount && campaign.raisedAmount >= campaign.targetAmount) {
      return 'TARGET REACHED';
    }
    return campaign.status;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatDateShort = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch (error) {
      return '-';
    }
  };

  const getFilterSummary = () => {
    let summary = '';
    if (filterType !== 'all') {
      summary += `${filterType.charAt(0).toUpperCase() + filterType.slice(1)} campaigns`;
    } else {
      summary += 'All campaigns';
    }
    
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      summary += ` • ${selectedMonth} ${selectedYear}`;
    } else if (selectedMonth !== 'all') {
      summary += ` • Month: ${selectedMonth}`;
    } else if (selectedYear !== 'all') {
      summary += ` • Year: ${selectedYear}`;
    }
    
    return summary;
  };

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaignId(expandedCampaignId === campaignId ? null : campaignId);
  };

  const calculateStats = () => {
    const totalRaised = filteredCampaigns.reduce((sum, c) => sum + c.raisedAmount, 0);
    const activeCount = filteredCampaigns.filter(c => c.status === 'ACTIVE' && !c.isExpired).length;
    const completedCount = filteredCampaigns.filter(c => c.status === 'COMPLETED').length;
    return { totalRaised, activeCount, completedCount };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.loadingText, isDarkMode && styles.darkLoadingText]}>
            Loading volunteer campaigns...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.darkSafeArea]}>
      {/* Header */}
      <View style={[styles.headerContainer, isDarkMode && styles.darkHeaderContainer]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={styles.logo}
            />
            <View style={styles.appTitleContainer}>
              <Text style={[styles.titleBlack, isDarkMode && styles.darkTitleBlack]}>MAN</Text>
              <Text style={styles.titleGreen}>POWER</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(member)/dashboard')}
          >
            <Ionicons name="home" size={22} color={isDarkMode ? "#90CAF9" : "#4CAF50"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={toggleDarkMode}
          >
            <Ionicons 
              name={isDarkMode ? "sunny" : "moon"} 
              size={22} 
              color={isDarkMode ? "#FFD700" : "#4CAF50"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, isDarkMode && styles.darkScrollContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor={isDarkMode ? '#81C784' : '#4CAF50'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* Page Header */}
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, isDarkMode && styles.darkPageTitle]}>
              Volunteer Campaigns
            </Text>
            <Text style={[styles.pageSubtitle, isDarkMode && styles.darkPageSubtitle]}>
              {groupName || 'Group'} • {getFilterSummary()}
            </Text>
          </View>

          {/* Stats Summary Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isDarkMode && styles.darkStatCard]}>
              <Text style={[styles.statValue, isDarkMode && styles.darkStatValue]}>
                {filteredCampaigns.length}
              </Text>
              <Text style={[styles.statLabel, isDarkMode && styles.darkStatLabel]}>
                Total Campaigns
              </Text>
            </View>
            <View style={[styles.statCard, isDarkMode && styles.darkStatCard]}>
              <Text style={[styles.statValue, isDarkMode && styles.darkStatValue]}>
                {stats.activeCount}
              </Text>
              <Text style={[styles.statLabel, isDarkMode && styles.darkStatLabel]}>
                Active
              </Text>
            </View>
            <View style={[styles.statCard, isDarkMode && styles.darkStatCard]}>
              <Text style={[styles.statValue, isDarkMode && styles.darkStatValue]}>
                KES {stats.totalRaised.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, isDarkMode && styles.darkStatLabel]}>
                Total Raised
              </Text>
            </View>
          </View>
          
          {/* Filter Button */}
          <TouchableOpacity 
            style={[styles.filterButton, isDarkMode && styles.darkFilterButton]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={16} color={isDarkMode ? "#FFFFFF" : "#4CAF50"} />
            <Text style={[styles.filterButtonText, isDarkMode && styles.darkFilterButtonText]}>
              Filter Campaigns
            </Text>
            {(filterType !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all') && (
              <View style={styles.activeFilterIndicator} />
            )}
          </TouchableOpacity>

          {/* Campaigns List */}
          {filteredCampaigns.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={[styles.emptyTitle, isDarkMode && styles.darkEmptyTitle]}>
                No Campaigns Found
              </Text>
              <Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
                {filterType !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No volunteer campaigns have been created yet'}
              </Text>
              {(filterType !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all') && (
                <TouchableOpacity onPress={resetFilters}>
                  <Text style={styles.resetFilterText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredCampaigns.map((campaign) => (
              <View key={campaign.id} style={styles.campaignContainer}>
                {/* Campaign Card */}
                <TouchableOpacity
                  style={[styles.campaignCard, isDarkMode && styles.darkCampaignCard]}
                  onPress={() => toggleCampaign(campaign.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.campaignHeader}>
                    <View style={styles.campaignTitleContainer}>
                      <Text style={[styles.campaignName, isDarkMode && styles.darkCampaignName]}>
                        {campaign.campaignName}
                      </Text>
                      <Text style={[styles.campaignDate, isDarkMode && styles.darkCampaignDate]}>
                        {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(campaign.status, campaign.isExpired) + '20' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(campaign.status, campaign.isExpired) }
                      ]}>
                        {getStatusText(campaign)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.campaignDescription, isDarkMode && styles.darkCampaignDescription]} numberOfLines={2}>
                    {campaign.description}
                  </Text>

                  {/* Progress Bar - Updated to show small percentages */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.progressLabel, isDarkMode && styles.darkProgressLabel]}>
                        Progress
                      </Text>
                      <Text style={[styles.progressPercentage, isDarkMode && styles.darkProgressPercentage]}>
                        {campaign.progress < 0.01 
                          ? '< 0.01%' 
                          : campaign.progress < 0.1 
                            ? campaign.progress.toFixed(2) + '%' 
                            : campaign.progress.toFixed(1) + '%'}
                      </Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View 
                        style={[
                          styles.progressBar,
                          { 
                            width: `${Math.min(campaign.progress, 100)}%`,
                            backgroundColor: campaign.progress >= 100 ? '#4CAF50' : '#2196F3'
                          }
                        ]} 
                      />
                    </View>
                    <View style={styles.amountRow}>
                      <Text style={[styles.raisedAmount, isDarkMode && styles.darkRaisedAmount]}>
                        KES {campaign.raisedAmount.toLocaleString()}
                      </Text>
                      <Text style={[styles.targetAmount, isDarkMode && styles.darkTargetAmount]}>
                        {campaign.targetAmount 
                          ? `target: KES ${campaign.targetAmount.toLocaleString()}`
                          : 'no target'}
                      </Text>
                    </View>
                  </View>

                  {/* Campaign Stats Footer */}
                  <View style={styles.campaignFooter}>
                    <View style={styles.footerItem}>
                      <Ionicons name="people-outline" size={14} color={isDarkMode ? "#81C784" : "#4CAF50"} />
                      <Text style={[styles.footerText, isDarkMode && styles.darkFooterText]}>
                        {campaign.contributorCount} contributor{campaign.contributorCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.footerDivider} />
                    <View style={styles.footerItem}>
                      <Ionicons name="time-outline" size={14} color={isDarkMode ? "#FFB74D" : "#FF9800"} />
                      <Text style={[styles.footerText, isDarkMode && styles.darkFooterText]}>
                        {campaign.isExpired 
                          ? 'Expired' 
                          : campaign.status === 'ACTIVE'
                            ? `${campaign.daysRemaining} days left`
                            : 'Closed'}
                      </Text>
                    </View>
                    <View style={styles.footerDivider} />
                    <View style={styles.footerItem}>
                      <Ionicons 
                        name={expandedCampaignId === campaign.id ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color={isDarkMode ? "#81C784" : "#4CAF50"} 
                      />
                      <Text style={[styles.footerText, isDarkMode && styles.darkFooterText]}>
                        {expandedCampaignId === campaign.id ? 'Hide' : 'View'} contributions
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Contributions - Now showing real names */}
                {expandedCampaignId === campaign.id && (
                  <View style={[styles.contributionsContainer, isDarkMode && styles.darkContributionsContainer]}>
                    <View style={styles.contributionsHeader}>
                      <Text style={[styles.contributionsTitle, isDarkMode && styles.darkContributionsTitle]}>
                        Contributions ({campaign.contributions.length})
                      </Text>
                      <Text style={[styles.contributionsTotal, isDarkMode && styles.darkContributionsTotal]}>
                        Total: KES {campaign.contributions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                      </Text>
                    </View>

                    {campaign.contributions.length === 0 ? (
                      <Text style={[styles.noContributionsText, isDarkMode && styles.darkNoContributionsText]}>
                        No contributions yet
                      </Text>
                    ) : (
                      campaign.contributions.map((contribution, index) => (
                        <View key={contribution.id || index} style={styles.contributionRow}>
                          <View style={styles.contributionInfo}>
                            <Text style={[styles.contributionMember, isDarkMode && styles.darkContributionMember]}>
                              {contribution.member?.firstName} {contribution.member?.lastName}
                            </Text>
                            <Text style={[styles.contributionDate, isDarkMode && styles.darkContributionDate]}>
                              {formatDateShort(contribution.contributionDate || contribution.createdOn)}
                            </Text>
                          </View>
                          <View style={styles.contributionAmount}>
                            <Text style={[styles.contributionAmountText, isDarkMode && styles.darkContributionAmountText]}>
                              KES {contribution.amount.toLocaleString()}
                            </Text>
                            {contribution.description ? (
                              <Text style={[styles.contributionDesc, isDarkMode && styles.darkContributionDesc]} numberOfLines={1}>
                                {contribution.description}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            ))
          )}

          {/* Info Box */}
          <View style={[styles.infoBox, isDarkMode && styles.darkInfoBox]}>
            <Ionicons name="information-circle-outline" size={16} color={isDarkMode ? "#81C784" : "#4CAF50"} />
            <Text style={[styles.infoText, isDarkMode && styles.darkInfoText]}>
              • Tap on a campaign to view its contributions{'\n'}
              • Active campaigns are open for contributions{'\n'}
              • Your volunteer contributions help the community and boost loan eligibility
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerBottomText, isDarkMode && styles.darkFooterBottomText]}>
              Powered by: <Text style={styles.footerBrand}>MANSOFT</Text>
            </Text>
            <Text style={[styles.footerSub, isDarkMode && styles.darkFooterSub]}>
              Infinite Possibilities
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.darkModalTitle]}>Filter Campaigns</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? "#FFFFFF" : "#000000"} />
              </TouchableOpacity>
            </View>

            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, isDarkMode && styles.darkFilterLabel]}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptionsRow}>
                  {(['all', 'active', 'closed', 'completed'] as FilterType[]).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterOption,
                        filterType === type && styles.filterOptionSelected,
                        isDarkMode && styles.darkFilterOption,
                      ]}
                      onPress={() => setFilterType(type)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filterType === type && styles.filterOptionTextSelected,
                        isDarkMode && styles.darkFilterOptionText,
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Month Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, isDarkMode && styles.darkFilterLabel]}>Month</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      selectedMonth === 'all' && styles.filterOptionSelected,
                      isDarkMode && styles.darkFilterOption,
                    ]}
                    onPress={() => setSelectedMonth('all')}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      selectedMonth === 'all' && styles.filterOptionTextSelected,
                      isDarkMode && styles.darkFilterOptionText,
                    ]}>All Months</Text>
                  </TouchableOpacity>
                  {ALL_MONTHS.map(month => (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.filterOption,
                        selectedMonth === month && styles.filterOptionSelected,
                        isDarkMode && styles.darkFilterOption,
                      ]}
                      onPress={() => setSelectedMonth(month)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedMonth === month && styles.filterOptionTextSelected,
                        isDarkMode && styles.darkFilterOptionText,
                      ]}>{month.substring(0, 3)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Year Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, isDarkMode && styles.darkFilterLabel]}>Year</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      selectedYear === 'all' && styles.filterOptionSelected,
                      isDarkMode && styles.darkFilterOption,
                    ]}
                    onPress={() => setSelectedYear('all')}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      selectedYear === 'all' && styles.filterOptionTextSelected,
                      isDarkMode && styles.darkFilterOptionText,
                    ]}>All Years</Text>
                  </TouchableOpacity>
                  {availableYears.map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.filterOption,
                        selectedYear === year && styles.filterOptionSelected,
                        isDarkMode && styles.darkFilterOption,
                      ]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedYear === year && styles.filterOptionTextSelected,
                        isDarkMode && styles.darkFilterOptionText,
                      ]}>{year}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.applyButton]}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
            
            {(filterType !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all') && (
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={resetFilters}
              >
                <Text style={styles.resetButtonText}>Reset All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <MemberBottomNav current="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8F5E8' },
  darkSafeArea: { backgroundColor: '#121212' },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#555' 
  },
  darkLoadingText: {
    color: '#B0B0B0'
  },

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#C8E6C9',
    borderBottomWidth: 1,
    borderBottomColor: '#A5D6A7',
    elevation: 3,
    minHeight: 60,
  },
  darkHeaderContainer: {
    backgroundColor: '#1E1E1E',
    borderBottomColor: '#333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  logo: { 
    width: 32, 
    height: 32, 
    resizeMode: 'contain', 
    marginRight: 6 
  },
  appTitleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  titleBlack: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#000' 
  },
  darkTitleBlack: {
    color: '#FFFFFF'
  },
  titleGreen: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#4CAF50', 
    marginLeft: 2 
  },
  headerIconButton: {
    padding: 6,
  },

  scrollContent: { 
    flexGrow: 1, 
    paddingBottom: 140 
  },
  darkScrollContent: { 
    backgroundColor: '#121212' 
  },
  mainContent: { 
    padding: 16 
  },

  // Page Header
  pageHeader: {
    marginBottom: 16,
  },
  pageTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#333',
    marginBottom: 4,
  },
  darkPageTitle: { 
    color: '#FFFFFF' 
  },
  pageSubtitle: { 
    fontSize: 14, 
    color: '#666',
  },
  darkPageSubtitle: { 
    color: '#B0B0B0' 
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    alignItems: 'center',
  },
  darkStatCard: {
    backgroundColor: '#1E1E1E',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  darkStatValue: {
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  darkStatLabel: {
    color: '#B0B0B0',
  },

  // Filter Button
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
  },
  darkFilterButton: {
    backgroundColor: '#333',
    borderColor: '#444',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
    marginLeft: 6,
  },
  darkFilterButtonText: {
    color: '#81C784',
  },
  activeFilterIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginLeft: 6,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  darkEmptyTitle: {
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  darkEmptyText: {
    color: '#B0B0B0',
  },
  resetFilterText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Campaign Container
  campaignContainer: {
    marginBottom: 16,
  },
  campaignCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  darkCampaignCard: {
    backgroundColor: '#1E1E1E',
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  campaignTitleContainer: {
    flex: 1,
  },
  campaignName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  darkCampaignName: {
    color: '#FFFFFF',
  },
  campaignDate: {
    fontSize: 11,
    color: '#666',
  },
  darkCampaignDate: {
    color: '#B0B0B0',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  campaignDescription: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
    lineHeight: 18,
  },
  darkCampaignDescription: {
    color: '#DDD',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
  },
  darkProgressLabel: {
    color: '#B0B0B0',
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  darkProgressPercentage: {
    color: '#64B5F6',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  raisedAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  darkRaisedAmount: {
    color: '#81C784',
  },
  targetAmount: {
    fontSize: 12,
    color: '#666',
  },
  darkTargetAmount: {
    color: '#B0B0B0',
  },
  campaignFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  footerText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  darkFooterText: {
    color: '#B0B0B0',
  },
  footerDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },

  // Contributions Container
  contributionsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginHorizontal: 8,
  },
  darkContributionsContainer: {
    backgroundColor: '#252525',
  },
  contributionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  contributionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  darkContributionsTitle: {
    color: '#DDD',
  },
  contributionsTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  darkContributionsTotal: {
    color: '#81C784',
  },
  noContributionsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  darkNoContributionsText: {
    color: '#B0B0B0',
  },
  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contributionInfo: {
    flex: 1,
  },
  contributionMember: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  darkContributionMember: {
    color: '#DDD',
  },
  contributionDate: {
    fontSize: 10,
    color: '#666',
  },
  darkContributionDate: {
    color: '#B0B0B0',
  },
  contributionAmount: {
    alignItems: 'flex-end',
  },
  contributionAmountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  darkContributionAmountText: {
    color: '#81C784',
  },
  contributionDesc: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  darkContributionDesc: {
    color: '#B0B0B0',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    marginTop: 8,
  },
  darkInfoBox: {
    backgroundColor: '#1B5E20',
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: '#2E7D32',
    lineHeight: 16,
    marginLeft: 8,
  },
  darkInfoText: {
    color: '#81C784',
  },

  // Footer
  footer: { 
    marginTop: 20, 
    alignItems: 'center' 
  },
  footerBottomText: { 
    fontSize: 13, 
    color: '#555' 
  },
  darkFooterBottomText: {
    color: '#B0B0B0',
  },
  footerBrand: { 
    fontWeight: 'bold', 
    color: '#4CAF50' 
  },
  footerSub: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  darkFooterSub: {
    color: '#888',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  darkModalContent: {
    backgroundColor: '#1E1E1E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  darkModalTitle: {
    color: '#FFFFFF',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  darkFilterLabel: {
    color: '#DDD',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    paddingRight: 20,
  },
  filterOption: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 80,
    alignItems: 'center',
  },
  darkFilterOption: {
    backgroundColor: '#333',
    borderColor: '#444',
  },
  filterOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterOptionText: {
    fontSize: 13,
    color: '#666',
  },
  darkFilterOptionText: {
    color: '#BBB',
  },
  filterOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resetButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    color: '#F44336',
    textDecorationLine: 'underline',
  },
});

export default VolunteerContributionsScreen;
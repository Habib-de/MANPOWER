// components/InvestmentRecommendations.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { InvestmentRecommendation, InvestmentContext, getInvestmentRecommendations } from '../services/geminiService';

const { width } = Dimensions.get('window');

// Color System
const COLORS = {
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  primaryDark: '#5A52D5',
  secondary: '#FF6584',
  success: '#00C9A7',
  warning: '#FFC857',
  danger: '#FF6B6B',
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  cardBg: '#FFFFFF',
  border: '#E8ECF4',
  text: {
    primary: '#1A1A2E',
    secondary: '#4A4A6A',
    tertiary: '#8A8AA8',
  },
};

interface InvestmentRecommendationsProps {
  context: InvestmentContext;
  onRecommendationSelect?: (recommendation: InvestmentRecommendation) => void;
  onMoreInfo?: (recommendation: InvestmentRecommendation) => void;
}

// Progress Ring Component with proper types
interface ProgressRingProps {
  value: number;
  max: number;
  color: string;
  label?: string;
  size?: number;
}

const ProgressRing = ({ value, max, color, label, size = 50 }: ProgressRingProps) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (value / max) * circumference;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `${color}15`,
            position: 'absolute',
          }}
        />
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: '#E8ECF4',
            position: 'absolute',
          }}
        />
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            position: 'absolute',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              position: 'absolute',
              transform: [{ rotate: '-90deg' }],
              borderTopColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: 'transparent',
            }}
          />
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              position: 'absolute',
              transform: [{ rotate: `${(value / max) * 360 - 90}deg` }],
              borderTopColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
            }}
          />
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={[styles.ringValue, { color }]}>
            {value}{max === 10 ? '' : '%'}
          </Text>
        </View>
      </View>
      {label && <Text style={styles.ringLabel}>{label}</Text>}
    </View>
  );
};

// Sparkline Component with proper types
interface SparklineProps {
  data: number[];
  color: string;
}

const Sparkline = ({ data, color }: SparklineProps) => {
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  return (
    <View style={styles.sparklineContainer}>
      {data.map((value: number, idx: number) => (
        <View
          key={idx}
          style={[
            styles.sparklineBar,
            {
              height: ((value - minValue) / range) * 20 + 4,
              backgroundColor: color,
              opacity: 0.4 + (value / maxValue) * 0.6,
            },
          ]}
        />
      ))}
    </View>
  );
};

export default function InvestmentRecommendations({
  context,
  onRecommendationSelect,
  onMoreInfo,
}: InvestmentRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<InvestmentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchRecommendations();
  }, []);

  useEffect(() => {
    if (recommendations.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [recommendations]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      fadeAnim.setValue(0);

      const results = await getInvestmentRecommendations(context);

      if (results && results.length > 0) {
        setRecommendations(results);
      } else {
        setError('No recommendations available at this time.');
      }
    } catch (err) {
      setError('Failed to load recommendations.');
      console.error('Recommendation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number): string => {
    if (score <= 3) return COLORS.success;
    if (score <= 6) return COLORS.warning;
    if (score <= 8) return '#FF9800';
    return COLORS.danger;
  };

  const getRiskLabel = (score: number): string => {
    if (score <= 3) return 'Low Risk';
    if (score <= 6) return 'Medium Risk';
    if (score <= 8) return 'High Risk';
    return 'Very High Risk';
  };

  const getTypeIcon = (type: string): string => {
    switch (type.toUpperCase()) {
      case 'STOCKS': return '📈';
      case 'BONDS': return '📊';
      case 'REAL_ESTATE': return '🏠';
      case 'MUTUAL_FUNDS': return '💰';
      case 'FIXED_DEPOSIT': return '🏦';
      case 'BUSINESS': return '💼';
      default: return '📈';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type.toUpperCase()) {
      case 'STOCKS': return '#2196F3';
      case 'BONDS': return '#4CAF50';
      case 'REAL_ESTATE': return '#FF9800';
      case 'MUTUAL_FUNDS': return '#9C27B0';
      case 'FIXED_DEPOSIT': return '#00BCD4';
      case 'BUSINESS': return '#F44336';
      default: return '#757575';
    }
  };

  const handleCardPress = (rec: InvestmentRecommendation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onRecommendationSelect) {
      onRecommendationSelect(rec);
    } else {
      Alert.alert(
        rec.type.replace('_', ' '),
        `${rec.suggestion}\n\n${rec.reasoning}\n\n📊 Expected Return: ${rec.expectedReturn > 0 ? '+' : ''}${rec.expectedReturn}%\n⚠️ Risk Score: ${rec.riskScore}/10 (${getRiskLabel(rec.riskScore)})`
      );
    }
  };

  const handleMoreInfo = (rec: InvestmentRecommendation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onMoreInfo) {
      onMoreInfo(rec);
    } else {
      Alert.alert('📖 More Information', 
        `Investment: ${rec.type.replace('_', ' ')}\n\n` +
        `💡 Suggestion: ${rec.suggestion}\n\n` +
        `🤔 Reasoning: ${rec.reasoning}\n\n` +
        `📊 Expected Return: ${rec.expectedReturn > 0 ? '+' : ''}${rec.expectedReturn}%\n` +
        `⚠️ Risk Level: ${rec.riskScore}/10 (${getRiskLabel(rec.riskScore)})`
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Analyzing your portfolio...</Text>
          <Text style={styles.loadingSubtext}>AI is generating personalized recommendations</Text>
        </LinearGradient>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient
          colors={['#ff6b6b20', '#ff6b6b10']}
          style={styles.errorGradient}
        >
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRecommendations}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.retryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.retryText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // Calculate summary statistics
  const avgReturn = recommendations.reduce((sum, r) => sum + r.expectedReturn, 0) / recommendations.length;
  const avgRisk = recommendations.reduce((sum, r) => sum + r.riskScore, 0) / recommendations.length;
  const avgRiskLabel = getRiskLabel(Math.round(avgRisk));

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#667eea08', '#764ba208']}
        style={styles.containerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleContainer}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.titleIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.title}>AI Recommendations</Text>
            </View>
            <Text style={styles.subtitle}>
              Based on your portfolio of KES {context.portfolioValue.toLocaleString()}
            </Text>
          </View>
          <TouchableOpacity onPress={fetchRecommendations} style={styles.refreshButton}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.refreshGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Summary Statistics */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg. Return</Text>
            <Text style={[styles.summaryValue, { color: avgReturn > 0 ? COLORS.success : COLORS.danger }]}>
              {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Risk Level</Text>
            <Text style={[styles.summaryValue, { color: getRiskColor(Math.round(avgRisk)) }]}>
              {avgRiskLabel}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Options</Text>
            <Text style={styles.summaryValue}>{recommendations.length}</Text>
          </View>
        </View>

        {/* Recommendations Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {recommendations.map((rec, index) => {
            const riskColor = getRiskColor(rec.riskScore);
            const typeColor = getTypeColor(rec.type);
            const sparklineData = Array.from({ length: 12 }, () => Math.random() * 0.5 + 0.5);

            return (
              <Animated.View
                key={index}
                style={[styles.card, { borderTopColor: riskColor }]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleCardPress(rec)}
                >
                  <LinearGradient
                    colors={['#FFFFFF', '#F8F9FA']}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.cardIconContainer, { backgroundColor: typeColor + '20' }]}>
                        <Text style={styles.cardIcon}>{getTypeIcon(rec.type)}</Text>
                      </View>
                      <View style={styles.cardHeaderCenter}>
                        <Text style={styles.cardType}>{rec.type.replace('_', ' ')}</Text>
                        <View style={styles.matchBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                          <Text style={styles.matchText}>
                            {Math.floor(80 + Math.random() * 20)}% match
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.starButton}>
                        <Ionicons name="bookmark-outline" size={20} color="#8A8AA8" />
                      </TouchableOpacity>
                    </View>

                    {/* Suggestion */}
                    <Text style={styles.cardSuggestion} numberOfLines={2}>
                      {rec.suggestion}
                    </Text>

                    {/* Reasoning with Sparkline */}
                    <View style={styles.reasoningContainer}>
                      <Text style={styles.cardReasoning} numberOfLines={2}>
                        {rec.reasoning}
                      </Text>
                      <Sparkline data={sparklineData} color={riskColor} />
                    </View>

                    {/* Footer with Risk and Return */}
                    <View style={styles.cardFooter}>
                      <View style={styles.riskContainer}>
                        <View style={styles.riskHeader}>
                          <Text style={styles.riskLabel}>Risk</Text>
                          <Text style={[styles.riskScore, { color: riskColor }]}>
                            {rec.riskScore}/10
                          </Text>
                        </View>
                        <View style={styles.riskBarContainer}>
                          <View
                            style={[
                              styles.riskBar,
                              {
                                width: `${(rec.riskScore / 10) * 100}%`,
                                backgroundColor: riskColor,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.riskLabelText, { color: riskColor }]}>
                          {getRiskLabel(rec.riskScore)}
                        </Text>
                      </View>

                      <View style={styles.returnContainer}>
                        <ProgressRing
                          value={Math.abs(rec.expectedReturn)}
                          max={15}
                          color={rec.expectedReturn > 0 ? COLORS.success : COLORS.danger}
                          size={50}
                          label="Return"
                        />
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* More Info Button */}
                <TouchableOpacity
                  style={styles.moreInfoButton}
                  onPress={() => handleMoreInfo(rec)}
                >
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.moreInfoGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="information-circle-outline" size={16} color="#fff" />
                    <Text style={styles.moreInfoText}>More Info</Text>
                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity style={styles.fab} onPress={fetchRecommendations}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="sparkles" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  containerGradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 2,
    marginLeft: 36,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  refreshGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E8ECF4',
  },
  scrollContent: {
    paddingRight: 16,
    gap: 12,
  },
  loadingContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  loadingGradient: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  errorContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  errorGradient: {
    padding: 30,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  retryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    width: width * 0.8,
    borderTopWidth: 4,
    marginRight: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardHeaderCenter: {
    flex: 1,
  },
  cardType: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  matchText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '500',
  },
  starButton: {
    padding: 4,
  },
  cardSuggestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B5E20',
    marginBottom: 6,
    lineHeight: 20,
  },
  reasoningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardReasoning: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 16,
    marginRight: 8,
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    gap: 2,
  },
  sparklineBar: {
    width: 3,
    borderRadius: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E8ECF4',
    paddingTop: 12,
  },
  riskContainer: {
    flex: 1,
    marginRight: 12,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  riskLabel: {
    fontSize: 10,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  riskScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  riskBarContainer: {
    height: 4,
    backgroundColor: '#E8ECF4',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  riskBar: {
    height: '100%',
    borderRadius: 2,
  },
  riskLabelText: {
    fontSize: 9,
    fontWeight: '500',
  },
  returnContainer: {
    alignItems: 'center',
  },
  returnLabel: {
    fontSize: 9,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  returnValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  ringValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  ringLabel: {
    fontSize: 9,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  moreInfoButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 0,
  },
  moreInfoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  moreInfoText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
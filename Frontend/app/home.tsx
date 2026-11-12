// app/index.tsx — Public Landing Page
import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
  useWindowDimensions,
  Linking,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from './_layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BRAND_GREEN = '#4CAF50';
const BRAND_DARK_GREEN = '#2E7D32';
const BRAND_ORANGE = '#FB8C00';
const BG = '#F1F8E9';

// =============== TRUST BADGES ===============
const trustBadges = [
  { icon: 'phone-portrait-outline', label: 'M-Pesa Ready' },
  { icon: 'shield-checkmark-outline', label: 'Secure' },
  { icon: 'cloud-done-outline', label: '99.9% Uptime' },
  { icon: 'headset-outline', label: '24/7 Support' },
];

// =============== FEATURES ===============
const features = [
  {
    icon: 'wallet-outline',
    title: 'Contributions',
    description: 'Track monthly or weekly group contributions with M-Pesa STK push and auto-reminders.',
    color: '#4CAF50',
  },
  {
    icon: 'hardware-chip-outline',
    title: 'AI Loan Decisions',
    description: 'Instant, fair loan approvals powered by AI. Risk-based interest rates and repayment terms.',
    color: '#2196F3',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Guarantor System',
    description: 'Members guarantee each other. Guarantors accept or decline requests with full transparency.',
    color: '#9C27B0',
  },
  {
    icon: 'gift-outline',
    title: 'Dividends',
    description: 'Automatic dividend declarations and payouts based on each member\'s contributions.',
    color: '#FB8C00',
  },
  {
    icon: 'calendar-outline',
    title: 'Meetings',
    description: 'Schedule meetings, share in-app video links, and keep everyone in sync.',
    color: '#FF5722',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Chat & Alerts',
    description: 'Group discussions, private member messages, and real-time notifications.',
    color: '#607D8B',
  },
];

// =============== ROLE PREVIEWS ===============
const rolePreviews = [
  {
    title: 'For Members',
    icon: 'person-outline',
    color: '#4CAF50',
    bgLight: '#E8F5E9',
    features: [
      'View all my contributions',
      'Apply for AI-assessed loans',
      'Track dividends earned',
      'Manage guarantor requests',
      'Join scheduled meetings',
      'Chat with group members',
    ],
  },
  {
    title: 'For Group Admins',
    icon: 'people-outline',
    color: '#1976D2',
    bgLight: '#E3F2FD',
    features: [
      'Manage group members',
      'Record contributions & expenses',
      'Approve AI loan requests',
      'Track group expenses',
      'Monitor group health & churn',
      'Declare dividends',
    ],
  },
];

// =============== HOW IT WORKS ===============
const steps = [
  { icon: 'person-add-outline', title: 'Join your group', description: 'Get invited by your group admin or register with an existing group.' },
  { icon: 'wallet-outline', title: 'Contribute', description: 'Make contributions via M-Pesa — automatic STK push, no paperwork.' },
  { icon: 'document-text-outline', title: 'Borrow or earn', description: 'Apply for AI-assessed loans and receive dividend payouts each cycle.' },
  { icon: 'trending-up-outline', title: 'Grow together', description: 'Watch your group\'s savings, investments, and members thrive.' },
];

export default function LandingPage() {
  const { userRole } = useContext(AuthContext)!;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [checkingAuth, setCheckingAuth] = useState(true);

  // Fade-in animation
  const fadeHero = useRef(new Animated.Value(0)).current;
  const fadeContent = useRef(new Animated.Value(0)).current;

  // ============ AUTH CHECK ============
  useEffect(() => {
    const checkAuth = async () => {
      const role = await AsyncStorage.getItem('userRole');
      if (role === 'Member' || role === 'GroupAdmin' || role === 'SuperAdmin') {
        router.replace(
          role === 'Member'
            ? '/(member)/dashboard'
            : role === 'GroupAdmin'
            ? '/(groupadmin)/dashboard'
            : '/(superadmin)/dashboard'
        );
        return;
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // ============ ANIMATIONS ============
  useEffect(() => {
    if (checkingAuth) return;
    Animated.timing(fadeHero, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.timing(fadeContent, { toValue: 1, duration: 900, delay: 200, useNativeDriver: true }).start();
  }, [checkingAuth]);

  const goToLogin = () => router.push('/(auth)');

  const openWhatsApp = () => Linking.openURL('https://wa.me/254741848348');
  const openEmail = () => Linking.openURL('mailto:xabiiib0790@gmail.com');
  const openPhone = () => Linking.openURL('tel:0741848348');

  if (checkingAuth) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={{ width: 80, height: 80, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text style={{ color: BRAND_GREEN, fontWeight: '600' }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* ============ STICKY HEADER ============ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>
            <Text style={styles.man}>MAN</Text>
            <Text style={styles.power}>POWER</Text>
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.loginBtn} onPress={goToLogin}>
            <Ionicons name="log-in-outline" size={16} color={BRAND_GREEN} />
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ============ HERO ============ */}
        <Animated.View style={[styles.hero, { opacity: fadeHero }]}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={12} color={BRAND_DARK_GREEN} />
            <Text style={styles.heroBadgeText}>Smart Group Savings & Lending</Text>
          </View>

          <Text style={styles.heroTitle}>
            Run Your Chama <Text style={{ color: BRAND_GREEN }}>Smarter</Text>
          </Text>

          <Text style={styles.heroSubtitle}>
            MANPOWER helps chamas, SACCOs and investment groups manage
            contributions, AI-powered loans, dividends, and meetings — all in one place.
          </Text>

          <View style={styles.heroCtaRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={goToLogin} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={openWhatsApp} activeOpacity={0.85}>
              <Ionicons name="logo-whatsapp" size={16} color={BRAND_GREEN} />
              <Text style={styles.secondaryBtnText}>Talk to us</Text>
            </TouchableOpacity>
          </View>

          <Image
            source={require('../assets/images/logo.png')}
            style={[styles.heroLogo, { width: isDesktop ? 240 : 160, height: isDesktop ? 240 : 160 }]}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ============ TRUST BADGES ============ */}
        <View style={styles.trustRow}>
          {trustBadges.map((b, i) => (
            <View key={i} style={styles.trustItem}>
              <Ionicons name={b.icon as any} size={16} color={BRAND_GREEN} />
              <Text style={styles.trustText}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* ============ FEATURES ============ */}
        <Animated.View style={[styles.section, { opacity: fadeContent }]}>
          <Text style={styles.sectionLabel}>PLATFORM FEATURES</Text>
<Text style={styles.sectionTitle}>All the tools you need</Text>
<Text style={styles.sectionSubtitle}>
  Contributions, AI loans, dividends and more — in one place.
</Text>

          <View style={styles.grid}>
            {features.map((f, i) => (
              <View key={i} style={[styles.featureCard, { width: isDesktop ? '31.5%' : '48%' }]}>
                <View style={[styles.featureIcon, { backgroundColor: f.color + '20' }]}>
                  <Ionicons name={f.icon as any} size={24} color={f.color} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDescription}>{f.description}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

                {/* ============ ROLE PREVIEWS ============ */}
        <Animated.View style={[styles.section, { opacity: fadeContent }]}>
          <Text style={styles.sectionLabel}>BUILT FOR EVERY ROLE</Text>
          <Text style={styles.sectionTitle}>One platform, two sides</Text>
          <Text style={styles.sectionSubtitle}>
            What members see vs. what group admins see.
          </Text>

          <View style={styles.previewGrid}>
            {rolePreviews.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.previewCard,
                  { width: isDesktop ? '48%' : '100%', borderColor: r.color },
                ]}
              >
                <View style={[styles.previewHeader, { backgroundColor: r.bgLight }]}>
                  <View style={[styles.previewIconCircle, { backgroundColor: r.color }]}>
                    <Ionicons name={r.icon as any} size={22} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.previewTitle, { color: r.color }]}>{r.title}</Text>
                </View>

                <View style={styles.previewFeatures}>
                  {r.features.map((f, idx) => (
                    <View key={idx} style={styles.previewFeatureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={r.color} />
                      <Text style={styles.previewFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.previewButton, { backgroundColor: r.color }]}
                  onPress={goToLogin}
                  activeOpacity={0.85}
                >
                  <Text style={styles.previewButtonText}>Login to your account</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ============ HOW IT WORKS ============ */}
        <Animated.View style={[styles.section, { opacity: fadeContent }]}>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <Text style={styles.sectionTitle}>Start in four easy steps</Text>

          <View style={styles.stepsRow}>
            {steps.map((s, i) => (
                    <View key={i} style={[styles.stepCard, { width: isDesktop ? '23.5%' : '48%' }]}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Ionicons name={s.icon as any} size={22} color={BRAND_GREEN} />
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepDescription}>{s.description}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ============ CTA BANNER ============ */}
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaBannerTitle}>Ready to modernize your chama?</Text>
          <Text style={styles.ctaBannerSubtitle}>
            Login to your account to see your contributions, loans, dividends, and more.
          </Text>
          <TouchableOpacity style={styles.ctaBannerBtn} onPress={goToLogin} activeOpacity={0.85}>
            <Text style={styles.ctaBannerBtnText}>Login Now</Text>
            <Ionicons name="arrow-forward" size={16} color={BRAND_GREEN} />
          </TouchableOpacity>
        </View>

        {/* ============ CONTACT ============ */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactItem} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            <Text style={styles.contactText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactItem} onPress={openEmail}>
            <Ionicons name="mail-outline" size={18} color="#2196F3" />
            <Text style={styles.contactText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactItem} onPress={openPhone}>
            <Ionicons name="call-outline" size={18} color={BRAND_ORANGE} />
            <Text style={styles.contactText}>Call</Text>
          </TouchableOpacity>
        </View>

        {/* ============ FOOTER ============ */}
        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <Image
              source={require('../assets/images/logo.png')}
              style={{ width: 32, height: 32, marginRight: 8 }}
              resizeMode="contain"
            />
            <Text style={styles.brand}>
              <Text style={styles.man}>MAN</Text>
              <Text style={styles.power}>POWER</Text>
            </Text>
          </View>

          <Text style={styles.footerTagline}>Infinite Possibilities</Text>

          <Text style={styles.footerCopyright}>
            © {new Date().getFullYear()} MANPOWER · Powered by{' '}
            <Text style={{ color: BRAND_GREEN, fontWeight: '700' }}>MANSOFT</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  scroll: { paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 34, height: 34, marginRight: 8 },
  brand: { fontSize: 18, fontWeight: 'bold' },
  man: { color: '#000' },
  power: { color: BRAND_GREEN },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BRAND_GREEN,
    backgroundColor: '#FFFFFF',
  },
  loginBtnText: { color: BRAND_GREEN, fontWeight: '700', fontSize: 14 },

  // Hero
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 32, paddingBottom: 16 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    marginBottom: 16,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: BRAND_DARK_GREEN },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#212121', textAlign: 'center', lineHeight: 40 },
  heroSubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    maxWidth: 520,
  },
  heroCtaRow: { flexDirection: 'row', gap: 10, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
    elevation: 3,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
  },
  secondaryBtnText: { color: BRAND_GREEN, fontWeight: '700', fontSize: 15 },
  heroLogo: { marginTop: 28 },

  // Trust row
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  trustText: { fontSize: 11, fontWeight: '600', color: '#444' },

  // Section
  section: { paddingHorizontal: 20, paddingTop: 36 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: BRAND_GREEN, letterSpacing: 1.5, textAlign: 'center' },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#212121',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  sectionSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 18 },

  // Grids
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#212121', marginBottom: 4 },
  featureDescription: { fontSize: 12, color: '#666', lineHeight: 17 },

  // Roles
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  roleIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleTitle: { fontSize: 15, fontWeight: '800', color: '#212121', marginBottom: 6 },
  roleDescription: { fontSize: 12, color: '#555', lineHeight: 18 },

  // Steps
stepsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumberText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stepTitle: { fontSize: 13, fontWeight: '700', color: '#212121', marginTop: 8, textAlign: 'center' },
  stepDescription: { fontSize: 11, color: '#666', textAlign: 'center', marginTop: 4, lineHeight: 15 },

  // CTA
  ctaBanner: {
    marginHorizontal: 16,
    marginTop: 32,
    padding: 22,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: BRAND_GREEN,
    alignItems: 'center',
  },
  ctaBannerTitle: { fontSize: 20, fontWeight: '800', color: BRAND_DARK_GREEN, textAlign: 'center' },
  ctaBannerSubtitle: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  ctaBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: BRAND_GREEN,
  },
  ctaBannerBtnText: { color: BRAND_GREEN, fontWeight: '800', fontSize: 14 },

  // Contact
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 1,
  },
  contactText: { fontSize: 12, fontWeight: '600', color: '#333' },

    // Role Previews
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  previewIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  previewFeatures: {
    padding: 16,
    gap: 10,
  },
  previewFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewFeatureText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    lineHeight: 18,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },


  // Footer
  footer: {
    marginTop: 36,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  footerBrand: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  footerTagline: { fontSize: 12, color: '#888', marginBottom: 8 },
  footerCopyright: { fontSize: 11, color: '#888', textAlign: 'center' },
});
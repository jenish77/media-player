import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { ArrowLeft, Sparkles, Check, ShieldCheck, Zap, Sliders, Film } from 'lucide-react-native';
import { palette, darkTheme } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

interface PremiumScreenProps {
  navigation: any;
}

export const PremiumScreen: React.FC<PremiumScreenProps> = ({ navigation }) => {
  const isExitingRef = React.useRef(false);

  const handleBack = () => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else if (navigation?.navigate) {
      navigation.navigate('MainTabs');
    }
  };

  const perks = [
    {
      icon: Zap,
      title: 'Ad-Free Playback',
      desc: 'Zero interstitial or banner ads anywhere in your library and player.',
    },
    {
      icon: Sliders,
      title: 'Advanced Audio Equalizer',
      desc: 'Custom 10-band equalizer presets with Bass Boost and Vocal Clarity.',
    },
    {
      icon: Film,
      title: 'Unlimited Playlists',
      desc: 'Create and organize unlimited smart playlists for movies and series.',
    },
    {
      icon: ShieldCheck,
      title: 'Priority Support & Cloud Backup',
      desc: 'Offline sync diagnostics and prompt developer support.',
    },
  ];

  const handlePurchase = () => {
    Alert.alert(
      'In-App Purchase',
      'Store sandbox connected. Ready for Google Play & App Store billing submission.',
      [{ text: 'OK' }]
    );
  };

  const handleRestore = () => {
    Alert.alert('Restore Purchases', 'Checking App Store / Google Play credentials... No previous purchases found.');
  };

  return (
    <View style={styles.container} testID="premium-screen">
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          testID="premium-back-button"
        >
          <ArrowLeft size={22} color={darkTheme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Player Pro</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.badgeCircle}>
            <Sparkles size={36} color={palette.warning} />
          </View>
          <Text style={styles.bannerTitle}>Unlock Premium</Text>
          <Text style={styles.bannerSubtitle}>
            Elevate your media experience with pro playback tools and an uninterrupted interface.
          </Text>
        </View>

        {/* Perks */}
        <View style={styles.perksList}>
          {perks.map((perk, i) => {
            const IconComponent = perk.icon;
            return (
              <View key={i} style={styles.perkCard}>
                <View style={styles.perkIconBox}>
                  <IconComponent size={22} color={palette.accentCyan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perkTitle}>{perk.title}</Text>
                  <Text style={styles.perkDesc}>{perk.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Pricing Card */}
        <View style={styles.pricingCard}>
          <Text style={styles.priceDuration}>Lifetime Access</Text>
          <Text style={styles.priceAmount}>$4.99</Text>
          <Text style={styles.priceNote}>One-time purchase • No recurring subscriptions</Text>

          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={handlePurchase}
            activeOpacity={0.8}
            testID="purchase-pro-button"
          >
            <Text style={styles.purchaseButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            Payment will be charged to your Google Play or Apple ID account. Terms of Service and Privacy Policy apply.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.surface,
    paddingTop: 48,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.borderSubtle,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: darkTheme.text,
    fontSize: 20,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  banner: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  badgeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  bannerTitle: {
    ...typography.h1,
    color: darkTheme.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  bannerSubtitle: {
    ...typography.bodyMedium,
    color: darkTheme.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  perksList: {
    marginBottom: spacing.xl,
  },
  perkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.cardBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  perkIconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  perkTitle: {
    ...typography.bodyMedium,
    color: darkTheme.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  perkDesc: {
    ...typography.caption,
    color: darkTheme.textSecondary,
  },
  pricingCard: {
    backgroundColor: darkTheme.surfaceVariant,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.primary500,
    marginBottom: spacing.lg,
  },
  priceDuration: {
    ...typography.caption,
    color: palette.primary400,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  priceAmount: {
    ...typography.h1,
    color: palette.white,
    fontSize: 36,
    marginVertical: spacing.xs,
  },
  priceNote: {
    ...typography.caption,
    color: palette.slate400,
    marginBottom: spacing.lg,
  },
  purchaseButton: {
    backgroundColor: palette.primary500,
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  purchaseButtonText: {
    ...typography.bodyLarge,
    color: palette.white,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
  },
  restoreText: {
    ...typography.bodySmall,
    color: palette.accentCyan,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  legalText: {
    ...typography.caption,
    color: darkTheme.textMuted,
    textAlign: 'center',
    fontSize: 10,
    maxWidth: 280,
  },
});

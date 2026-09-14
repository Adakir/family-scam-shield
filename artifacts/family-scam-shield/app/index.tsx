import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useSubscription } from '@/lib/revenuecat';
import { analyzeMessage, ScamAnalysis, RiskLevel } from '@/lib/scamAnalysis';
import {
  loadRecentChecks,
  loadTrustedContact,
  RecentCheck,
  saveRecentCheck,
  saveTrustedContact,
  TrustedContact,
} from '@/lib/storage';

const SAMPLE_MESSAGE =
  'Your package could not be delivered. Confirm your address within 24 hours: https://bit.ly/3scam';

const levelColors: Record<RiskLevel, { background: string; foreground: string; icon: keyof typeof Feather.glyphMap }> = {
  safe: { background: '#DDEFE6', foreground: '#176B63', icon: 'check-circle' },
  caution: { background: '#F7EBD0', foreground: '#9A6717', icon: 'alert-triangle' },
  danger: { background: '#F6DDD8', foreground: '#B8483D', icon: 'x-circle' },
};

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [analysis, setAnalysis] = useState<ScamAnalysis | null>(null);
  const [recentChecks, setRecentChecks] = useState<RecentCheck[]>([]);
  const [contact, setContact] = useState<TrustedContact>({ name: '', phone: '', enabled: false });
  const [contactDraft, setContactDraft] = useState<TrustedContact>(contact);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const {
    packageToPurchase,
    isSubscribed,
    isLoading: isSubscriptionLoading,
    hasError: hasSubscriptionError,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
  } = useSubscription();

  useEffect(() => {
    Promise.all([loadRecentChecks(), loadTrustedContact()])
      .then(([checks, savedContact]) => {
        setRecentChecks(checks);
        setContact(savedContact);
        setContactDraft(savedContact);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const hasContact = useMemo(
    () => Boolean(contact.enabled && contact.name.trim() && contact.phone.trim()),
    [contact],
  );

  const handleAnalyze = useCallback(async () => {
    Keyboard.dismiss();
    if (!message.trim()) {
      Alert.alert('Paste a message first', 'Add the suspicious text or link you want to check.');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = analyzeMessage(message);
    const check: RecentCheck = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      preview: message.trim().replace(/\s+/g, ' ').slice(0, 74),
      level: result.level,
      createdAt: new Date().toISOString(),
    };
    setAnalysis(result);
    setRecentChecks((current) => [check, ...current].slice(0, 4));
    await saveRecentCheck(check);
  }, [message]);

  const handleSaveContact = useCallback(async () => {
    if (contactDraft.enabled && (!contactDraft.name.trim() || !contactDraft.phone.trim())) {
      Alert.alert('Add a name and phone number', 'We need both before family alerts can be turned on.');
      return;
    }
    setIsSaving(true);
    await saveTrustedContact(contactDraft);
    setContact(contactDraft);
    setIsSaving(false);
    setShowSettings(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [contactDraft]);

  const handleClearHistory = useCallback(async () => {
    await AsyncStorage.removeItem('@family-scam-shield/recent-checks');
    setRecentChecks([]);
  }, []);

  const risk = analysis ? levelColors[analysis.level] : null;
  const premiumPrice = packageToPurchase?.product.priceString ?? 'Monthly plan';

  const openPremiumOrSettings = useCallback(() => {
    if (!isSubscribed) {
      setPurchaseError('');
      setShowPremium(true);
      return;
    }
    setContactDraft(contact);
    setShowSettings(true);
  }, [contact, isSubscribed]);

  const handlePurchase = useCallback(async () => {
    if (!packageToPurchase) {
      setPurchaseError('The monthly plan is not available yet. Please try again shortly.');
      return;
    }
    setPurchaseError('');
    try {
      await purchase(packageToPurchase);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPremium(false);
    } catch (error) {
      if (error instanceof Error && !error.message.toLowerCase().includes('cancel')) {
        setPurchaseError(error.message);
      }
    }
  }, [packageToPurchase, purchase]);

  const handleRestore = useCallback(async () => {
    setPurchaseError('');
    try {
      await restore();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'We could not restore purchases.');
    }
  }, [restore]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <View style={styles.wordmarkRow}>
              <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
                <Feather name="shield" size={17} color={colors.primaryForeground} />
              </View>
              <Text style={[styles.wordmark, { color: colors.foreground }]}>Shield</Text>
            </View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>YOUR SAFETY CHECK</Text>
          </View>
          <Pressable
            testID="open-settings"
            onPress={openPremiumOrSettings}
            style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.card }, pressed && styles.pressed]}
          >
            <Feather name="sliders" size={19} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.foreground }]}>Pause before you click.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Paste a suspicious message or link. We’ll explain what to do in plain language.
          </Text>
        </View>

        <View style={[styles.protectionPill, { backgroundColor: colors.secondary }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.protectionText, { color: colors.secondaryForeground }]}>Protection check is ready</Text>
          <Feather name="lock" size={14} color={colors.secondaryForeground} />
        </View>

        <Pressable
          testID="open-premium"
          onPress={() => setShowPremium(true)}
          style={({ pressed }) => [
            styles.premiumBanner,
            { backgroundColor: isSubscribed ? colors.secondary : colors.foreground },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.premiumIcon, { backgroundColor: isSubscribed ? colors.primary : colors.accent }]}>
            <Feather name={isSubscribed ? 'check' : 'star'} size={17} color={isSubscribed ? colors.primaryForeground : colors.accentForeground} />
          </View>
          <View style={styles.premiumCopy}>
            <Text style={[styles.premiumEyebrow, { color: isSubscribed ? colors.primary : '#A7D6C6' }]}>
              {isSubscribed ? 'PREMIUM ACTIVE' : 'SHIELD PREMIUM'}
            </Text>
            <Text style={[styles.premiumTitle, { color: isSubscribed ? colors.foreground : colors.card }]}>
              {isSubscribed ? 'Family protection is on' : 'Keep someone you trust in the loop'}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={isSubscribed ? colors.mutedForeground : '#DCEDE6'} />
        </Pressable>

        <View style={[styles.checkCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeadingRow}>
            <View>
              <Text style={[styles.cardKicker, { color: colors.primary }]}>CHECK A MESSAGE</Text>
              <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>What did they send you?</Text>
            </View>
            <View style={[styles.pasteIcon, { backgroundColor: colors.accent }]}>
              <Feather name="edit-3" size={18} color={colors.accentForeground} />
            </View>
          </View>
          <TextInput
            testID="message-input"
            multiline
            value={message}
            onChangeText={setMessage}
            placeholder="Paste the text, link, or email here…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.messageInput, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            textAlignVertical="top"
            accessibilityLabel="Suspicious message"
          />
          <View style={styles.inputFooter}>
            <Text style={[styles.privateText, { color: colors.mutedForeground }]}>
              <Feather name="lock" size={12} /> Checked on this device
            </Text>
            <Text style={[styles.characterCount, { color: colors.mutedForeground }]}>{message.length}/2,000</Text>
          </View>
          <Pressable
            testID="analyze-button"
            onPress={handleAnalyze}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Feather name="search" size={18} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Check it</Text>
            <Feather name="arrow-up-right" size={17} color={colors.primaryForeground} />
          </Pressable>
          <Pressable
            testID="sample-button"
            onPress={() => setMessage(SAMPLE_MESSAGE)}
            style={({ pressed }) => [styles.sampleButton, pressed && styles.pressed]}
          >
            <Feather name="zap" size={14} color={colors.accentForeground} />
            <Text style={[styles.sampleText, { color: colors.accentForeground }]}>Try a sample scam</Text>
          </Pressable>
        </View>

        {analysis && risk ? (
          <View style={[styles.resultCard, { backgroundColor: risk.background }]}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultIcon, { backgroundColor: risk.foreground }]}>
                <Feather name={risk.icon} size={21} color={risk.background} />
              </View>
              <View style={styles.resultHeaderCopy}>
                <Text style={[styles.resultLabel, { color: risk.foreground }]}>SHIELD RESULT</Text>
                <Text style={[styles.resultTitle, { color: risk.foreground }]}>{analysis.title}</Text>
              </View>
            </View>
            <Text style={[styles.resultSummary, { color: risk.foreground }]}>{analysis.summary}</Text>
            <View style={[styles.reasonsBox, { backgroundColor: 'rgba(255,255,255,0.55)' }]}>
              {analysis.reasons.map((reason) => (
                <View key={reason} style={styles.reasonRow}>
                  <View style={[styles.reasonBullet, { backgroundColor: risk.foreground }]} />
                  <Text style={[styles.reasonText, { color: risk.foreground }]}>{reason}</Text>
                </View>
              ))}
            </View>
            {analysis.level !== 'safe' && hasContact ? (
              <View style={[styles.alertReady, { borderColor: `${risk.foreground}55` }]}>
                <Feather name="bell" size={15} color={risk.foreground} />
                <Text style={[styles.alertReadyText, { color: risk.foreground }]}>
                  {contact.name} will be notified if you choose to share this result.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionKicker, { color: colors.mutedForeground }]}>YOUR HOUSEHOLD</Text>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trusted contact</Text>
          </View>
          <Pressable testID="edit-contact" onPress={openPremiumOrSettings}>
            <Text style={[styles.textButton, { color: colors.primary }]}>{hasContact ? 'Edit' : isSubscribed ? 'Set up' : 'Premium'}</Text>
          </Pressable>
        </View>
        <Pressable
          testID="trusted-contact-card"
          onPress={openPremiumOrSettings}
          style={({ pressed }) => [styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
        >
          <View style={[styles.contactIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="heart" size={19} color={colors.primary} />
          </View>
          <View style={styles.contactCopy}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>
              {hasContact ? `${contact.name} is your safety person` : 'Add someone you trust'}
            </Text>
            <Text style={[styles.contactSubtitle, { color: colors.mutedForeground }]}>
              {hasContact ? 'Ready to keep an eye out with you' : 'They can help you double-check a warning'}
            </Text>
          </View>
          <Feather name={isSubscribed ? 'chevron-right' : 'lock'} size={17} color={colors.mutedForeground} />
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionKicker, { color: colors.mutedForeground }]}>RECENT CHECKS</Text>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your latest lookbacks</Text>
          </View>
          {recentChecks.length > 0 ? (
            <Pressable testID="clear-history" onPress={handleClearHistory}>
              <Text style={[styles.textButton, { color: colors.primary }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : recentChecks.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: colors.border }]}>
            <Feather name="inbox" size={21} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing checked yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your results will appear here for easy reference.</Text>
          </View>
        ) : (
          <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recentChecks.map((check, index) => {
              const checkColors = levelColors[check.level];
              return (
                <View key={check.id} style={[styles.historyRow, index < recentChecks.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <View style={[styles.historyIcon, { backgroundColor: checkColors.background }]}>
                    <Feather name={checkColors.icon} size={16} color={checkColors.foreground} />
                  </View>
                  <View style={styles.historyCopy}>
                    <Text style={[styles.historyPreview, { color: colors.foreground }]} numberOfLines={1}>{check.preview}</Text>
                    <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>{formatDate(check.createdAt)}</Text>
                  </View>
                  <Text style={[styles.historyStatus, { color: checkColors.foreground }]}>{check.level === 'danger' ? 'Risky' : check.level === 'caution' ? 'Caution' : 'Okay'}</Text>
                </View>
              );
            })}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>

      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(23,59,63,0.32)' }]}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalGrabber} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalKicker, { color: colors.primary }]}>HOUSEHOLD SETTINGS</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Your safety person</Text>
              </View>
              <Pressable testID="close-settings" onPress={() => setShowSettings(false)} style={styles.closeButton}>
                <Feather name="x" size={21} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.modalDescription, { color: colors.mutedForeground }]}>
              Choose someone you trust. We’ll keep their details on this device and show you when a warning is ready to share.
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Name</Text>
            <TextInput
              testID="contact-name"
              value={contactDraft.name}
              onChangeText={(name) => setContactDraft((current) => ({ ...current, name }))}
              placeholder="e.g. Maya"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.card }]}
            />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Phone number</Text>
            <TextInput
              testID="contact-phone"
              value={contactDraft.phone}
              onChangeText={(phone) => setContactDraft((current) => ({ ...current, phone }))}
              placeholder="e.g. (555) 014-2020"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.card }]}
            />
            <View style={[styles.switchRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: colors.foreground }]}>Family alerts</Text>
                <Text style={[styles.switchSubtitle, { color: colors.mutedForeground }]}>Show a reminder to share risky results</Text>
              </View>
              <Switch
                testID="family-alert-toggle"
                value={contactDraft.enabled}
                onValueChange={(enabled) => setContactDraft((current) => ({ ...current, enabled }))}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>
            <Pressable
              testID="save-contact"
              onPress={handleSaveContact}
              disabled={isSaving}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed, isSaving && styles.disabled]}
            >
              {isSaving ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="check" size={18} color={colors.primaryForeground} />}
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{isSaving ? 'Saving…' : 'Save settings'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showPremium} animationType="slide" transparent onRequestClose={() => setShowPremium(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(23,59,63,0.32)' }]}>
          <View style={[styles.premiumSheet, { backgroundColor: colors.foreground, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalGrabber} />
            <View style={styles.premiumSheetHeader}>
              <View style={[styles.premiumLargeIcon, { backgroundColor: colors.accent }]}>
                <Feather name="star" size={22} color={colors.accentForeground} />
              </View>
              <Pressable testID="close-premium" onPress={() => setShowPremium(false)} style={styles.closeButton}>
                <Feather name="x" size={21} color={colors.card} />
              </Pressable>
            </View>
            <Text style={[styles.premiumSheetKicker, { color: '#A7D6C6' }]}>SHIELD PREMIUM</Text>
            <Text style={[styles.premiumSheetTitle, { color: colors.card }]}>Protection is better together.</Text>
            <Text style={[styles.premiumSheetDescription, { color: '#C0D2CC' }]}>
              Add a trusted person to your safety loop and keep risky messages from becoming lonely decisions.
            </Text>
            <View style={[styles.featureList, { borderColor: '#38605B' }]}>
              {['Trusted-contact alerts for risky results', 'A shared moment to pause and verify', 'Cancel anytime from your app store'].map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <View style={[styles.featureCheck, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={12} color={colors.primaryForeground} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.card }]}>{feature}</Text>
                </View>
              ))}
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceText, { color: colors.card }]}>{premiumPrice}</Text>
              <Text style={[styles.priceCaption, { color: '#A7D6C6' }]}> billed monthly</Text>
            </View>
            {hasSubscriptionError ? (
              <Text style={[styles.purchaseError, { color: '#F4B4A8' }]}>The store is still loading. You can try again in a moment.</Text>
            ) : null}
            {purchaseError ? <Text style={[styles.purchaseError, { color: '#F4B4A8' }]}>{purchaseError}</Text> : null}
            <Pressable
              testID="purchase-premium"
              onPress={handlePurchase}
              disabled={isPurchasing || isSubscriptionLoading}
              style={({ pressed }) => [styles.premiumButton, { backgroundColor: colors.accent }, pressed && styles.pressed, (isPurchasing || isSubscriptionLoading) && styles.disabled]}
            >
              {isPurchasing || isSubscriptionLoading ? <ActivityIndicator color={colors.accentForeground} /> : <Feather name="lock" size={17} color={colors.accentForeground} />}
              <Text style={[styles.premiumButtonText, { color: colors.accentForeground }]}>
                {isPurchasing ? 'Opening checkout…' : isSubscriptionLoading ? 'Loading plan…' : `Continue with ${premiumPrice}`}
              </Text>
            </Pressable>
            <Pressable testID="restore-purchases" onPress={handleRestore} disabled={isRestoring} style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}>
              {isRestoring ? <ActivityIndicator color="#C0D2CC" size="small" /> : null}
              <Text style={[styles.restoreText, { color: '#C0D2CC' }]}>{isRestoring ? 'Restoring…' : 'Restore purchases'}</Text>
            </Pressable>
            <Text style={[styles.termsText, { color: '#829F96' }]}>Payment is handled securely by the App Store or Google Play.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.7 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, marginTop: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#173B3F', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  intro: { marginTop: 33 },
  title: { fontSize: 31, lineHeight: 36, fontFamily: 'Inter_700Bold', letterSpacing: -1.2, maxWidth: 300 },
  subtitle: { marginTop: 11, fontSize: 15, lineHeight: 23, fontFamily: 'Inter_400Regular', maxWidth: 335 },
  protectionPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 19 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  protectionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  premiumBanner: { borderRadius: 19, padding: 13, marginTop: 13, flexDirection: 'row', alignItems: 'center' },
  premiumIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  premiumCopy: { flex: 1, marginHorizontal: 10 },
  premiumEyebrow: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.3 },
  premiumTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 3 },
  checkCard: { borderWidth: 1, borderRadius: 24, padding: 17, marginTop: 22, shadowColor: '#173B3F', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  cardKicker: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.35 },
  cardTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4, letterSpacing: -0.35 },
  pasteIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  messageInput: { minHeight: 120, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  privateText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  characterCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  primaryButton: { minHeight: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  sampleButton: { alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 14, paddingBottom: 2 },
  sampleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.6 },
  resultCard: { borderRadius: 22, padding: 17, marginTop: 15 },
  resultHeader: { flexDirection: 'row', alignItems: 'center' },
  resultIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultHeaderCopy: { marginLeft: 11, flex: 1 },
  resultLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.3 },
  resultTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 3, letterSpacing: -0.3 },
  resultSummary: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium', marginTop: 16 },
  reasonsBox: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 15, gap: 9 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reasonBullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  reasonText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  alertReady: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  alertReadyText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 11 },
  sectionKicker: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.45 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginTop: 4, letterSpacing: -0.3 },
  textButton: { fontSize: 13, fontFamily: 'Inter_700Bold', paddingBottom: 2 },
  contactCard: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: 'row', alignItems: 'center' },
  contactIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  contactCopy: { flex: 1, marginLeft: 11, marginRight: 8 },
  contactTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  contactSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  loader: { paddingVertical: 20 },
  emptyCard: { borderWidth: 1, borderRadius: 18, borderStyle: 'dashed', paddingHorizontal: 20, paddingVertical: 19, alignItems: 'center' },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 9 },
  emptyText: { fontSize: 11, lineHeight: 17, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4, maxWidth: 240 },
  historyCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  historyRow: { minHeight: 63, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  historyIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, marginHorizontal: 10 },
  historyPreview: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  historyDate: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 4 },
  historyStatus: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  premiumSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  premiumSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  premiumLargeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  premiumSheetKicker: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, marginTop: 22 },
  premiumSheetTitle: { fontSize: 28, lineHeight: 33, fontFamily: 'Inter_700Bold', letterSpacing: -0.9, marginTop: 6, maxWidth: 320 },
  premiumSheetDescription: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 11 },
  featureList: { borderWidth: 1, borderRadius: 15, padding: 12, gap: 12, marginTop: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  featureCheck: { width: 21, height: 21, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginTop: 20 },
  priceText: { fontSize: 27, fontFamily: 'Inter_700Bold', letterSpacing: -0.8 },
  priceCaption: { fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 4 },
  purchaseError: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 11 },
  premiumButton: { minHeight: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 18 },
  premiumButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  restoreButton: { alignSelf: 'center', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12 },
  restoreText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  termsText: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 3 },
  modalGrabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#C4D0CA', marginBottom: 22 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalKicker: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  modalTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 5, letterSpacing: -0.7 },
  closeButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center' },
  modalDescription: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 12, marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  fieldInput: { height: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 15, marginTop: 1, marginBottom: 20 },
  switchCopy: { flex: 1, marginRight: 15 },
  switchTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  switchSubtitle: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 3 },
});
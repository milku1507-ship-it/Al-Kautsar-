import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useWizard } from '@/context/WizardContext';

const STEPS = [
  { icon: 'person-outline' as const, title: 'Data Diri', desc: 'Tanggal lahir, konteks haid/nifas, pengalaman' },
  { icon: 'calendar-outline' as const, title: 'Kalender Darah', desc: 'Tandai hari darah dan sifat-sifatnya' },
  { icon: 'time-outline' as const, title: 'Kebiasaan & Waktu', desc: 'Adat haid dan waktu transisi' },
  { icon: 'analytics-outline' as const, title: 'Hasil Analisis', desc: 'Status hukum dan panduan ibadah' },
];

export default function CalculatorHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, reset } = useWizard();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  const hasResult = !!state.result;

  function handleStart() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasResult) reset();
    router.push('/wizard/profil');
  }

  function handleViewResult() {
    router.push('/wizard/hasil');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: insets.bottom + bottomPad + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: colors.foreground }]}>Fiqh Darah</Text>
          <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
            Kalkulator analisis fiqh haid & nifas berdasarkan kaidah Mazhab Syafi&apos;i
          </Text>
        </View>

        {hasResult && (
          <TouchableOpacity
            onPress={handleViewResult}
            activeOpacity={0.8}
            style={[styles.resultCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
          >
            <View style={styles.resultCardLeft}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <View>
                <Text style={[styles.resultCardTitle, { color: colors.foreground }]}>Hasil Tersedia</Text>
                <Text style={[styles.resultCardSub, { color: colors.mutedForeground }]}>
                  {state.result?.shortCategory ?? 'Lihat hasil analisis terakhir'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.stepsTitle, { color: colors.foreground }]}>Cara Kerja</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNumBg, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.stepNum, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
                <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.disclaimerCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            Hasil analisis ini bersifat informatif dan merujuk pada kitab Uyunul Masa-il Linnisa (Mazhab Syafi&apos;i). Konsultasikan dengan ulama atau guru agama untuk fatwa yang mengikat.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + bottomPad + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleStart}
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={20} color={colors.primaryForeground} />
          <Text style={[styles.startBtnText, { color: colors.primaryForeground }]}>
            {hasResult ? 'Mulai Analisis Baru' : 'Mulai Analisis'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 16 },
  heroSection: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  logo: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  appTagline: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  resultCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  resultCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  resultCardSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  stepsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNum: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  stepContent: { flex: 1 },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  stepDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    lineHeight: 18,
  },
  disclaimerCard: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  cta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  startBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});

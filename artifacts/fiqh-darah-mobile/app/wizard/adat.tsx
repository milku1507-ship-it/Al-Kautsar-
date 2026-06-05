import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useWizard } from '@/context/WizardContext';
import { StepProgress } from '@/components/StepProgress';
import { HabitRetrospection, UserHabit } from '@/types';

const RETROSPECTION_OPTIONS: { value: HabitRetrospection; label: string; desc: string }[] = [
  { value: 'ingat_semua', label: 'Ingat Semua', desc: 'Ingat durasi dan waktu mulai/berhenti haid' },
  { value: 'ingat_durasi', label: 'Ingat Durasi', desc: 'Hanya ingat berapa hari haid biasanya' },
  { value: 'ingat_waktu', label: 'Ingat Waktu Berhenti', desc: 'Ingat di waktu apa haid berhenti' },
  { value: 'ingat_angka_lupa_urutan', label: 'Ingat Angka, Lupa Urutan', desc: 'Ingat jumlah hari tapi tidak urutan munculnya' },
  { value: 'lupa_semua', label: 'Lupa Semua', desc: 'Tidak ingat durasi maupun waktu haid' },
];

export default function AdatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, setState } = useWizard();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const [retro, setRetro] = useState<HabitRetrospection>(state.habit.retrospection);
  const [duration, setDuration] = useState(String(state.habit.duration ?? ''));
  const [durations, setDurations] = useState(state.habit.durations?.join(', ') ?? '');

  function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const habit: UserHabit = { retrospection: retro };

    if (retro === 'ingat_semua' || retro === 'ingat_durasi') {
      const mainDur = parseInt(duration);
      if (!isNaN(mainDur)) habit.duration = mainDur;

      const durArr = durations.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (durArr.length > 0) habit.durations = durArr;
    }

    setState(s => ({ ...s, habit }));
    router.push('/wizard/waktu');
  }

  const showDuration = retro === 'ingat_semua' || retro === 'ingat_durasi';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>Langkah 3 dari 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepProgress current={3} total={4} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Kebiasaan Haid</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Seberapa banyak Anda mengingat pola haid sebelumnya?
        </Text>

        <View style={styles.section}>
          {RETROSPECTION_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setRetro(opt.value)}
              activeOpacity={0.7}
              style={[
                styles.optionCard,
                {
                  backgroundColor: retro === opt.value ? colors.primary + '12' : colors.card,
                  borderColor: retro === opt.value ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.optionRow}>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: retro === opt.value ? colors.primary : colors.border,
                      backgroundColor: retro === opt.value ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {retro === opt.value && (
                    <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>{opt.label}</Text>
                  <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {showDuration && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.foreground }]}>Durasi Haid (hari)</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Contoh: 7 (untuk 7 hari)
            </Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="7"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.foreground, marginTop: 12 }]}>
              Riwayat Durasi Beberapa Bulan Terakhir (opsional)
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Pisahkan dengan koma, contoh: 7, 7, 6, 8
            </Text>
            <TextInput
              value={durations}
              onChangeText={setDurations}
              placeholder="7, 7, 6"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="numeric"
            />
          </View>
        )}

        {retro === 'lupa_semua' && (
          <View style={[styles.warningBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="warning-outline" size={16} color={colors.primary} />
            <Text style={[styles.warningText, { color: colors.mutedForeground }]}>
              Kategori Mutahayyiroh akan diterapkan — wajib bersikap ihtiyath (berhati-hati) dalam ibadah.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleNext}
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Lanjut</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  content: { padding: 20, gap: 4 },
  heading: { fontSize: 24, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  subheading: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 12 },
  section: { gap: 8, marginBottom: 16 },
  optionCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  optionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  optionLabel: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  optionDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  warningBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  warningText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  nextBtn: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});

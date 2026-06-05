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
import { analyzeLocal } from '@/services/analyzeLocal';
import { calculateHijriAge } from '@/services/hijriUtils';

function ToggleRow({
  label,
  desc,
  value,
  onToggle,
}: {
  label: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[
        styles.toggleCard,
        {
          backgroundColor: value ? colors.primary + '12' : colors.card,
          borderColor: value ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>{desc}</Text>
      </View>
      <View
        style={[
          styles.check,
          { backgroundColor: value ? colors.primary : colors.muted, borderColor: value ? colors.primary : colors.border },
        ]}
      >
        {value && <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />}
      </View>
    </TouchableOpacity>
  );
}

export default function WaktuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, setState } = useWizard();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const [startTime, setStartTime] = useState(state.startTime);
  const [stopTime, setStopTime] = useState(state.stopTime);
  const [isRamadhan, setIsRamadhan] = useState(state.isRamadhan);
  const [hasPerformed, setHasPerformed] = useState(state.hasPerformedPrayer);

  function handleAnalyze() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { years, months, days: ageDays } = state.dateOfBirth
      ? calculateHijriAge(state.dateOfBirth)
      : { years: 0, months: 0, days: 0 };

    const result = analyzeLocal({
      ageYears: years,
      ageMonths: months,
      ageDays,
      context: state.context,
      experience: state.experience,
      records: state.records,
      habit: state.habit,
      startTime: startTime || undefined,
      stopTime: stopTime || undefined,
      laborDate: state.laborDate || undefined,
      isRamadhan,
      hasPerformedPrayerBeforeBleeding: hasPerformed,
    });

    setState(s => ({
      ...s,
      startTime,
      stopTime,
      isRamadhan,
      hasPerformedPrayer: hasPerformed,
      result,
    }));

    router.push('/wizard/hasil');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>Langkah 4 dari 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepProgress current={4} total={4} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Waktu & Kondisi</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Informasi ini digunakan untuk menghitung kewajiban qadho sholat.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Waktu Darah Pertama Keluar (opsional)</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Format 24 jam, contoh: 14:30</Text>
          <TextInput
            value={startTime}
            onChangeText={setStartTime}
            placeholder="14:30"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Waktu Darah Berhenti (opsional)</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Kosongkan jika darah masih keluar</Text>
          <TextInput
            value={stopTime}
            onChangeText={setStopTime}
            placeholder="07:15"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Kondisi Tambahan</Text>
          <ToggleRow
            label="Bulan Ramadhan"
            desc="Pendarahan terjadi di bulan Ramadhan (mempengaruhi kewajiban qadho puasa)"
            value={isRamadhan}
            onToggle={() => setIsRamadhan(v => !v)}
          />
          <ToggleRow
            label="Sudah Sholat Sebelum Darah Keluar"
            desc="Apakah Anda sempat sholat di waktu tersebut sebelum darah mulai keluar?"
            value={hasPerformed}
            onToggle={() => setHasPerformed(v => !v)}
          />
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="bulb-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Informasi waktu digunakan untuk menentukan apakah ada sholat yang harus diqadho saat darah mulai keluar atau berhenti.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleAnalyze}
          style={[styles.analyzeBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="analytics" size={20} color={colors.primaryForeground} />
          <Text style={[styles.analyzeBtnText, { color: colors.primaryForeground }]}>Analisis Sekarang</Text>
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
  section: { gap: 6, marginBottom: 16 },
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
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  toggleDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 17 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  analyzeBtn: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzeBtnText: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useWizard } from '@/context/WizardContext';
import { StepProgress } from '@/components/StepProgress';
import { CalculationContext, ExperienceStatus } from '@/types';

export default function ProfilScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, setState } = useWizard();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const [dob, setDob] = useState(state.dateOfBirth);
  const [ctx, setCtx] = useState<CalculationContext>(state.context);
  const [exp, setExp] = useState<ExperienceStatus>(state.experience);
  const [laborDate, setLaborDate] = useState(state.laborDate);

  function isValidDate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s);
    return !isNaN(d.getTime());
  }

  function handleNext() {
    if (!isValidDate(dob)) {
      Alert.alert('Format Salah', 'Masukkan tanggal lahir dengan format YYYY-MM-DD (contoh: 1999-05-12)');
      return;
    }
    if (ctx === 'nifas' && !isValidDate(laborDate)) {
      Alert.alert('Format Salah', 'Masukkan tanggal melahirkan dengan format YYYY-MM-DD');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState(s => ({ ...s, dateOfBirth: dob, context: ctx, experience: exp, laborDate }));
    router.push('/wizard/kalender');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>Langkah 1 dari 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepProgress current={1} total={4} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Profil Dasar</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Informasi ini digunakan untuk menentukan kategori fiqh yang tepat.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Tanggal Lahir</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Format: YYYY-MM-DD</Text>
          <TextInput
            value={dob}
            onChangeText={setDob}
            placeholder="1999-05-12"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Jenis Pendarahan</Text>
          <View style={styles.toggleGroup}>
            {(['haid', 'nifas'] as CalculationContext[]).map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setCtx(c)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: ctx === c ? colors.primary : colors.card,
                    borderColor: ctx === c ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: ctx === c ? colors.primaryForeground : colors.foreground }]}>
                  {c === 'haid' ? 'Haid' : 'Nifas (Pasca Melahirkan)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {ctx === 'nifas' && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.foreground }]}>Tanggal Melahirkan</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Format: YYYY-MM-DD</Text>
            <TextInput
              value={laborDate}
              onChangeText={setLaborDate}
              placeholder="2025-01-15"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>Status Pengalaman</Text>
          <View style={styles.toggleGroup}>
            {(['mubtadiah', 'mutadah'] as ExperienceStatus[]).map(e => (
              <TouchableOpacity
                key={e}
                onPress={() => setExp(e)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: exp === e ? colors.primary : colors.card,
                    borderColor: exp === e ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: exp === e ? colors.primaryForeground : colors.foreground }]}>
                  {e === 'mubtadiah' ? "Mubtadiah (Pertama kali)" : "Mu'tadah (Pernah haid)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Mu'tadah adalah wanita yang sudah pernah mengalami haid sebelumnya dan mengetahui atau ingat durasi kebiasaannya.
          </Text>
        </View>
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
  toggleGroup: { gap: 8 },
  toggleBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  toggleText: { fontSize: 14, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  footer: {
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

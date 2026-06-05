import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format } from 'date-fns';
import { useColors } from '@/hooks/useColors';
import { useWizard } from '@/context/WizardContext';
import { StepProgress } from '@/components/StepProgress';
import { BloodDayCard } from '@/components/BloodDayCard';
import { DayRecord } from '@/types';

const MAX_DAYS = 25;

function buildDefaultRecord(date: string): DayRecord {
  return {
    date,
    status: 'bersih',
  };
}

function getDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return format(d, 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export default function KalenderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, setState } = useWizard();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  function initRecords(): DayRecord[] {
    if (state.records.length > 0) return state.records;
    return Array.from({ length: 5 }, (_, i) =>
      buildDefaultRecord(addDays(startDate, i).toISOString().split('T')[0])
    );
  }

  const [records, setRecords] = useState<DayRecord[]>(initRecords);

  function updateRecord(index: number, record: DayRecord) {
    setRecords(prev => {
      const next = [...prev];
      next[index] = record;
      return next;
    });
  }

  function addDay() {
    if (records.length >= MAX_DAYS) {
      Alert.alert('Batas Hari', `Maksimal ${MAX_DAYS} hari dapat dimasukkan.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lastDate = new Date(records[records.length - 1].date);
    const nextDate = addDays(lastDate, 1);
    setRecords(prev => [...prev, buildDefaultRecord(nextDate.toISOString().split('T')[0])]);
  }

  function removeLastDay() {
    if (records.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecords(prev => prev.slice(0, -1));
  }

  function handleNext() {
    const hasBlood = records.some(r => r.status === 'darah');
    if (!hasBlood) {
      Alert.alert('Perlu Data Darah', 'Tandai setidaknya satu hari sebagai hari darah untuk melanjutkan analisis.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState(s => ({ ...s, records }));
    if (state.experience === 'mutadah') {
      router.push('/wizard/adat');
    } else {
      router.push('/wizard/waktu');
    }
  }

  const bloodCount = records.filter(r => r.status === 'darah').length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>Langkah 2 dari 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepProgress current={2} total={4} />

      <View style={styles.listHeader}>
        <View>
          <Text style={[styles.heading, { color: colors.foreground }]}>Kalender Darah</Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            {bloodCount > 0
              ? `${bloodCount} hari darah dari ${records.length} hari total`
              : `${records.length} hari terdaftar — tandai hari darah`}
          </Text>
        </View>
        <View style={styles.dayControls}>
          <TouchableOpacity
            onPress={removeLastDay}
            style={[styles.dayControlBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            disabled={records.length <= 1}
          >
            <Ionicons name="remove" size={18} color={records.length <= 1 ? colors.mutedForeground : colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={addDay}
            style={[styles.dayControlBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={records}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => (
          <BloodDayCard
            dayNumber={index + 1}
            dateLabel={getDateLabel(item.date)}
            record={item}
            onChange={rec => updateRecord(index, rec)}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      />

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
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  heading: { fontSize: 20, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  subheading: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  dayControls: { flexDirection: 'row', gap: 8 },
  dayControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 20, paddingTop: 4 },
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

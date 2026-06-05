import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BloodColor, BloodTexture, BloodAroma, DayRecord } from '@/types';
import { useColors } from '@/hooks/useColors';

interface BloodDayCardProps {
  dayNumber: number;
  dateLabel: string;
  record: DayRecord;
  onChange: (record: DayRecord) => void;
}

const COLORS: { value: BloodColor; label: string; hex: string }[] = [
  { value: 'hitam', label: 'Hitam', hex: '#1a1a2e' },
  { value: 'merah', label: 'Merah', hex: '#b91c1c' },
  { value: 'coklat', label: 'Coklat', hex: '#92400e' },
  { value: 'kuning', label: 'Kuning', hex: '#b45309' },
  { value: 'keruh', label: 'Keruh', hex: '#78716c' },
];

const TEXTURES: { value: BloodTexture; label: string }[] = [
  { value: 'kental', label: 'Kental' },
  { value: 'cair', label: 'Cair' },
];

const AROMAS: { value: BloodAroma; label: string }[] = [
  { value: 'busuk', label: 'Busuk' },
  { value: 'tidak_busuk', label: 'Tidak Busuk' },
];

export function BloodDayCard({ dayNumber, dateLabel, record, onChange }: BloodDayCardProps) {
  const colors = useColors();
  const isBlood = record.status === 'darah';
  const [expanded, setExpanded] = useState(isBlood);

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newStatus = isBlood ? 'bersih' : 'darah';
    const updated: DayRecord = {
      ...record,
      status: newStatus,
      color: newStatus === 'darah' ? (record.color ?? 'merah') : undefined,
      texture: newStatus === 'darah' ? (record.texture ?? 'cair') : undefined,
      aroma: newStatus === 'darah' ? (record.aroma ?? 'tidak_busuk') : undefined,
      durationHours: newStatus === 'darah' ? (record.durationHours ?? 24) : undefined,
    };
    onChange(updated);
    setExpanded(newStatus === 'darah');
  }

  function setColor(color: BloodColor) {
    onChange({ ...record, color });
  }

  function setTexture(texture: BloodTexture) {
    onChange({ ...record, texture });
  }

  function setAroma(aroma: BloodAroma) {
    onChange({ ...record, aroma });
  }

  function adjustHours(delta: number) {
    const current = record.durationHours ?? 24;
    const next = Math.max(0, Math.min(24, current + delta));
    onChange({ ...record, durationHours: next });
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isBlood ? colors.primary : colors.border,
          borderWidth: isBlood ? 1.5 : 1,
        },
      ]}
    >
      <TouchableOpacity onPress={toggle} style={styles.header} activeOpacity={0.7}>
        <View style={styles.dayInfo}>
          <View
            style={[
              styles.daySwatch,
              { backgroundColor: isBlood ? colors.primary : colors.muted },
            ]}
          >
            <Text
              style={[
                styles.dayNum,
                { color: isBlood ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {dayNumber}
            </Text>
          </View>
          <View>
            <Text style={[styles.dayLabel, { color: colors.foreground }]}>Hari {dayNumber}</Text>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>{dateLabel}</Text>
          </View>
        </View>
        <View style={styles.toggleRow}>
          <Text
            style={[
              styles.statusText,
              { color: isBlood ? colors.primary : colors.mutedForeground },
            ]}
          >
            {isBlood ? 'Darah' : 'Bersih'}
          </Text>
          <Ionicons
            name={isBlood ? 'water' : 'water-outline'}
            size={20}
            color={isBlood ? colors.primary : colors.mutedForeground}
          />
        </View>
      </TouchableOpacity>

      {isBlood && (
        <View style={[styles.details, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Warna Darah</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setColor(c.value)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: record.color === c.value ? c.hex : colors.muted,
                    borderColor: record.color === c.value ? c.hex : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: record.color === c.value ? '#fff' : colors.foreground },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Tekstur</Text>
          <View style={styles.pillRow}>
            {TEXTURES.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setTexture(t.value)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: record.texture === t.value ? colors.primary : colors.muted,
                    borderColor: record.texture === t.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: record.texture === t.value ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Aroma</Text>
          <View style={styles.pillRow}>
            {AROMAS.map(a => (
              <TouchableOpacity
                key={a.value}
                onPress={() => setAroma(a.value)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: record.aroma === a.value ? colors.primary : colors.muted,
                    borderColor: record.aroma === a.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: record.aroma === a.value ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Durasi (jam)</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              onPress={() => adjustHours(-1)}
              style={[styles.counterBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            >
              <Ionicons name="remove" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.counterValue, { color: colors.foreground }]}>
              {record.durationHours ?? 24} jam
            </Text>
            <TouchableOpacity
              onPress={() => adjustHours(1)}
              style={[styles.counterBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            >
              <Ionicons name="add" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  daySwatch: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  dateLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  details: {
    padding: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    minWidth: 60,
    textAlign: 'center',
  },
});

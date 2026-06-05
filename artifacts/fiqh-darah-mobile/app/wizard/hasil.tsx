import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useWizard } from '@/context/WizardContext';

const STATUS_COLORS: Record<string, string> = {
  Haid: '#b91c1c',
  Nifas: '#9333ea',
  Suci: '#059669',
  Istihadloh: '#d97706',
  Ihtiyath: '#0284c7',
};

function groupTimeline(timeline: { day: number; date: string; status: string; reason: string }[]) {
  if (timeline.length === 0) return [];
  const groups: { startDay: number; endDay: number; status: string; reason: string }[] = [];
  let cur = { ...timeline[0], startDay: timeline[0].day, endDay: timeline[0].day };
  for (let i = 1; i < timeline.length; i++) {
    const item = timeline[i];
    if (item.status === cur.status) {
      cur.endDay = item.day;
    } else {
      groups.push({ startDay: cur.startDay, endDay: cur.endDay, status: cur.status, reason: cur.reason });
      cur = { ...item, startDay: item.day, endDay: item.day };
    }
  }
  groups.push({ startDay: cur.startDay, endDay: cur.endDay, status: cur.status, reason: cur.reason });
  return groups;
}

export default function HasilScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, reset } = useWizard();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const result = state.result;

  if (!result) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.noResultText, { color: colors.mutedForeground }]}>
            Hasil tidak ditemukan
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/')}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Mulai Ulang</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const grouped = groupTimeline(result.statusTimeline);

  function getStatusColor(status: string): string {
    return STATUS_COLORS[status] ?? colors.mutedForeground;
  }

  function handleReset() {
    reset();
    router.replace('/(tabs)/');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Hasil Analisis</Text>
        <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
          <Ionicons name="refresh" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.categoryCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.categorySmall, { color: colors.primaryForeground + 'bb' }]}>
            Status Darah
          </Text>
          <Text style={[styles.categoryMain, { color: colors.primaryForeground }]}>
            {result.shortCategory}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Ringkasan Analisis</Text>
          </View>
          <Text style={[styles.analysisText, { color: colors.foreground }]}>{result.analysis}</Text>
        </View>

        {grouped.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Lini Masa Status</Text>
            </View>
            {grouped.map((g, i) => (
              <View key={i} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: getStatusColor(g.status) }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.timelineRow}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(g.status) + '20' }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(g.status) }]}>
                        {g.status}
                      </Text>
                    </View>
                    <Text style={[styles.timelineDays, { color: colors.mutedForeground }]}>
                      {g.startDay === g.endDay ? `Hari ${g.startDay}` : `Hari ${g.startDay}–${g.endDay}`}
                    </Text>
                  </View>
                  <Text style={[styles.timelineReason, { color: colors.mutedForeground }]}>
                    {g.reason}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {(result.specialNotes?.length ?? 0) > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Panduan Tindakan</Text>
            </View>
            {result.specialNotes!.map((note, i) => (
              <View key={i} style={styles.noteItem}>
                <Text style={[styles.noteBullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.noteText, { color: colors.foreground }]}>{note}</Text>
              </View>
            ))}
          </View>
        )}

        {result.purificationInstructions.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="water-outline" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Instruksi Bersuci</Text>
            </View>
            {result.purificationInstructions.map((inst, i) => (
              <View key={i} style={styles.noteItem}>
                <Text style={[styles.noteBullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.noteText, { color: colors.foreground }]}>{inst}</Text>
              </View>
            ))}
          </View>
        )}

        {result.qadhoObligations.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Kewajiban Qadho</Text>
            </View>
            {result.qadhoObligations.map((q, i) => (
              <View key={i} style={styles.noteItem}>
                <Text style={[styles.noteBullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.noteText, { color: colors.foreground }]}>{q}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.legalCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="book-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            {result.legalBasis}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleReset}
          style={[styles.resetBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color={colors.foreground} />
          <Text style={[styles.resetBtnText, { color: colors.foreground }]}>Mulai Analisis Baru</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 12 },
  categoryCard: {
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  categorySmall: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  categoryMain: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    lineHeight: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  analysisText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    flexShrink: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  timelineDays: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  timelineReason: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    marginTop: 3,
  },
  noteItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  noteBullet: {
    fontSize: 18,
    lineHeight: 22,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  legalCard: {
    flexDirection: 'row',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  legalText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  resetBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetBtnText: { fontSize: 14, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  noResultText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 99 },
  retryBtnText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});

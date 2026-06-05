import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Article } from '@/types';

interface ArticleCardProps {
  article: Article;
  onPress: () => void;
}

export function ArticleCard({ article, onPress }: ArticleCardProps) {
  const colors = useColors();

  function formatDate(ts: any): string {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {article.category ? (
        <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '18' }]}>
          <Text style={[styles.categoryText, { color: colors.primary }]}>{article.category}</Text>
        </View>
      ) : null}
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {article.title}
      </Text>
      {article.summary ? (
        <Text style={[styles.summary, { color: colors.mutedForeground }]} numberOfLines={2}>
          {article.summary}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(article.createdAt)}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    gap: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  summary: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  date: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});

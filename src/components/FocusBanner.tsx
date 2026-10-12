import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDuration } from '@/lib/date';
import { mmss, remainingMs } from '@/lib/focus';
import { useTicker } from '@/lib/useNow';
import { useStore } from '@/store';
import { colors } from '@/theme';

/** Dải nhỏ phía trên thanh tab: phiên tập trung đang chạy, hoặc phiên vừa xong chờ tự đánh giá. */
export function FocusBanner() {
  const { focus, focusResult, tasks, subjectOf, pauseFocus, resumeFocus, clearFocusResult } = useStore();
  const running = !!focus && focus.endAt !== null;
  const now = useTicker(running, 1000);

  if (!focus && !focusResult) return null;

  const open = () => router.push('/focus');

  if (!focus && focusResult) {
    return (
      <Pressable onPress={open} accessibilityLabel="Mở kết quả phiên tập trung" style={bar(colors.success)}>
        <Text style={{ fontSize: 18 }}>🎉</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
            Xong {formatDuration(focusResult.minutes)}
            {focusResult.taskTitle ? ` · ${focusResult.taskTitle}` : ''}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Chạm để tự đánh giá buổi học</Text>
        </View>
        <Pressable hitSlop={10} onPress={clearFocusResult} accessibilityLabel="Đóng">
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </Pressable>
    );
  }

  const f = focus!;
  const task = f.taskId ? tasks.find((t) => t.id === f.taskId) : undefined;
  const label = task?.title ?? subjectOf(f.subjectId)?.name ?? 'Phiên tập trung';
  const left = remainingMs(f, now);
  const pct = 1 - left / (f.minutes * 60000);

  return (
    <Pressable onPress={open} accessibilityLabel="Mở phiên tập trung" style={[bar(colors.accent), { overflow: 'hidden' }]}>
      <View style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${Math.round(pct * 100)}%`, backgroundColor: colors.accent }} />
      <Ionicons name="timer" size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{running ? 'Đang tập trung' : 'Tạm dừng'}</Text>
      </View>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'] }}>
        {mmss(left)}
      </Text>
      <Pressable
        hitSlop={10}
        onPress={running ? pauseFocus : resumeFocus}
        accessibilityLabel={running ? 'Tạm dừng' : 'Tiếp tục'}
      >
        <Ionicons name={running ? 'pause-circle' : 'play-circle'} size={30} color={colors.accent} />
      </Pressable>
    </Pressable>
  );
}

const bar = (border: string) => ({
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  marginBottom: 8,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: border,
  backgroundColor: 'rgba(30,30,63,0.98)',
  elevation: 14,
});

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { endTime, formatDuration } from '@/lib/date';
import { useStore } from '@/store';
import { colors, radius } from '@/theme';
import { Task } from '@/types';

export function TaskRow({
  task,
  onPress,
  onStart,
  showTopic = true,
}: {
  task: Task;
  onPress?: () => void;
  onStart?: () => void;
  /** hiện chủ đề kiến thức, chạm để mở trên bản đồ */
  showTopic?: boolean;
}) {
  const { toggleTask, subjectOf, topics } = useStore();
  const subject = subjectOf(task.subjectId);
  const topic = showTopic && task.topicId ? topics.find((t) => t.id === task.topicId) : undefined;
  const accent = subject?.color ?? colors.muted;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        opacity: task.done ? 0.55 : 1,
      }}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            color: colors.text,
            fontWeight: '700',
            fontSize: 15,
            textDecorationLine: task.done ? 'line-through' : 'none',
          }}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {task.start}–{endTime(task.start, task.duration)} · {formatDuration(task.duration)}
          {subject ? `  ${subject.emoji} ${subject.name}` : ''}
          {task.ai ? '  ✨' : ''}
        </Text>
        {topic ? (
          <Pressable
            hitSlop={6}
            onPress={() => router.navigate({ pathname: '/map', params: { topic: topic.id } })}
            accessibilityLabel={`Xem chủ đề ${topic.name} trên bản đồ`}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: colors.surface2,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="git-network-outline" size={11} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
              {topic.name}
            </Text>
          </Pressable>
        ) : null}
        {task.note ? (
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
            {task.note}
          </Text>
        ) : null}
      </View>
      {onStart && !task.done ? (
        <Pressable hitSlop={10} onPress={onStart} accessibilityLabel="Học ngay">
          <Ionicons name="play-circle" size={30} color={colors.accent} />
        </Pressable>
      ) : null}
      <Pressable
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        onPress={() => {
          if (!task.done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          toggleTask(task.id);
        }}
      >
        <Ionicons
          name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={30}
          color={task.done ? colors.success : colors.muted}
        />
      </Pressable>
    </Pressable>
  );
}

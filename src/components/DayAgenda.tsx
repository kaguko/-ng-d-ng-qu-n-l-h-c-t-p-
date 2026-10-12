import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AgendaRow, buildAgenda, Period, PERIOD_LABEL } from '@/lib/agenda';
import { endTime, formatDuration, toMinutes } from '@/lib/date';
import { useStore } from '@/store';
import { colors, radius } from '@/theme';
import { Task } from '@/types';
import { ProgressRing } from './ProgressRing';

const TIME_W = 48;
const RAIL_W = 22;

const PERIOD_ICON: Record<Period, keyof typeof Ionicons.glyphMap> = {
  morning: 'sunny-outline',
  afternoon: 'partly-sunny-outline',
  evening: 'moon-outline',
};

/** Lịch một ngày dạng dòng thời gian: tóm tắt ngày, chia Sáng/Chiều/Tối, khoảng trống và vạch "bây giờ". */
export function DayAgenda({
  tasks,
  isToday,
  isPast,
  now,
  onTask,
  onSlot,
}: {
  tasks: Task[];
  isToday: boolean;
  /** ngày đã qua: buổi chưa xong được đánh dấu "Đã lỡ" */
  isPast: boolean;
  /** "HH:mm" hiện tại */
  now: string;
  onTask: (t: Task) => void;
  onSlot: (start: string) => void;
}) {
  const rows = useMemo(() => buildAgenda(tasks, isToday ? toMinutes(now) : undefined), [tasks, isToday, now]);

  return (
    <View style={{ gap: 14 }}>
      <DaySummary tasks={tasks} />
      <View>
        {rows.map((r, i) => (
          <Row key={rowKey(r, i)} row={r} isToday={isToday} isPast={isPast} nowMin={toMinutes(now)} onTask={onTask} onSlot={onSlot} />
        ))}
      </View>
    </View>
  );
}

const rowKey = (r: AgendaRow, i: number) => (r.kind === 'task' ? r.task.id : `${r.kind}-${i}`);

function DaySummary({ tasks }: { tasks: Task[] }) {
  const { subjectOf } = useStore();
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.reduce((s, t) => s + t.duration, 0);
  const left = tasks.filter((t) => !t.done).reduce((s, t) => s + t.duration, 0);

  // phút theo môn, để vẽ thanh màu xếp chồng
  const bySubject = new Map<string | null, number>();
  tasks.forEach((t) => bySubject.set(t.subjectId, (bySubject.get(t.subjectId) ?? 0) + t.duration));
  const segments = [...bySubject.entries()]
    .map(([id, minutes]) => ({ id, minutes, subject: subjectOf(id) }))
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
      }}
    >
      <ProgressRing size={64} stroke={7} progress={tasks.length ? done / tasks.length : 0} center={`${done}/${tasks.length}`} />
      <View style={{ flex: 1, gap: 8 }}>
        <View>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
            {tasks.length} buổi · {formatDuration(total)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {done === tasks.length ? 'Đã xong cả ngày 🎉' : `Còn ${tasks.length - done} buổi · ${formatDuration(left)}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
          {segments.map((s) => (
            <View key={s.id ?? 'none'} style={{ flex: s.minutes, backgroundColor: s.subject?.color ?? colors.muted }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2 }}>
          {segments.map((s) => (
            <Text key={s.id ?? 'none'} style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
              <Text style={{ color: s.subject?.color ?? colors.muted }}>● </Text>
              {s.subject ? s.subject.name : 'Khác'} {formatDuration(s.minutes)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Cột trục dọc: đường nối liền giữa các dòng, có thể kèm một nút tròn. */
function Rail({ children, dashed, color = colors.border }: { children?: React.ReactNode; dashed?: boolean; color?: string }) {
  return (
    <View style={{ width: RAIL_W, alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 0,
          borderLeftWidth: 2,
          borderColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
        }}
      />
      {children}
    </View>
  );
}

function Row({
  row,
  isToday,
  isPast,
  nowMin,
  onTask,
  onSlot,
}: {
  row: AgendaRow;
  isToday: boolean;
  isPast: boolean;
  nowMin: number;
  onTask: (t: Task) => void;
  onSlot: (start: string) => void;
}) {
  if (row.kind === 'period') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 8 }}>
        <View style={{ width: TIME_W, alignItems: 'flex-end' }}>
          <Ionicons name={PERIOD_ICON[row.period]} size={16} color={colors.accent} />
        </View>
        <View style={{ width: RAIL_W }} />
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {PERIOD_LABEL[row.period]}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {row.count} buổi · {formatDuration(row.minutes)}
        </Text>
      </View>
    );
  }

  if (row.kind === 'now') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 26, gap: 8 }}>
        <Text style={{ width: TIME_W, textAlign: 'right', color: colors.pink, fontSize: 11, fontWeight: '800' }}>{row.time}</Text>
        <Rail color={colors.border}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.pink, marginTop: 8 }} />
        </Rail>
        <View style={{ flex: 1, height: 2, backgroundColor: colors.pink, borderRadius: 1 }} />
        <Text style={{ color: colors.pink, fontSize: 11, fontWeight: '700' }}>Bây giờ</Text>
      </View>
    );
  }

  if (row.kind === 'gap') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 }}>
        <View style={{ width: TIME_W }} />
        <Rail dashed />
        <Pressable
          onPress={() => onSlot(row.from)}
          accessibilityLabel={`Thêm buổi học lúc ${row.from}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontStyle: 'italic' }}>Trống {formatDuration(row.minutes)}</Text>
          <Ionicons name="add-circle-outline" size={16} color={colors.muted} />
        </Pressable>
      </View>
    );
  }

  const t = row.task;
  const missed = !t.done && (isPast || (isToday && toMinutes(t.start) + t.duration <= nowMin));
  return <TaskItem task={t} overlap={row.overlap} current={row.current} missed={missed} canStart={isToday} onPress={() => onTask(t)} />;
}

function TaskItem({
  task,
  overlap,
  current,
  missed,
  canStart,
  onPress,
}: {
  task: Task;
  overlap: boolean;
  current: boolean;
  missed: boolean;
  canStart: boolean;
  onPress: () => void;
}) {
  const { subjectOf, topics, toggleTask } = useStore();
  const subject = subjectOf(task.subjectId);
  const color = subject?.color ?? colors.muted;
  const topic = task.topicId ? topics.find((t) => t.id === task.topicId) : undefined;

  const toggle = () => {
    if (!task.done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toggleTask(task.id);
  };

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ width: TIME_W, alignItems: 'flex-end', paddingTop: 10 }}>
        <Text style={{ color: current ? colors.accent : missed ? colors.warn : colors.text, fontWeight: '800', fontSize: 13 }}>{task.start}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{task.duration}&apos;</Text>
      </View>

      <Rail>
        <Pressable
          onPress={toggle}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={task.done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
          style={{
            marginTop: 11,
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: color,
            backgroundColor: task.done ? color : colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {task.done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
        </Pressable>
      </Rail>

      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: current ? colors.surface2 : colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: current ? colors.accent : colors.border,
          borderLeftWidth: 4,
          borderLeftColor: color,
          paddingVertical: 10,
          paddingHorizontal: 12,
          opacity: task.done ? 0.55 : 1,
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{ color: colors.text, fontWeight: '700', fontSize: 14, textDecorationLine: task.done ? 'line-through' : 'none' }}
          >
            {task.title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
            đến {endTime(task.start, task.duration)}
            {subject ? ` · ${subject.emoji} ${subject.name}` : ''}
            {task.ai ? ' · ✨' : ''}
          </Text>
          {(topic || overlap || current || missed) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
              {current && <Badge icon="radio-button-on" label="Đang diễn ra" color={colors.accent} />}
              {missed && <Badge icon="time-outline" label="Đã lỡ" color={colors.warn} />}
              {overlap && <Badge icon="warning-outline" label="Trùng giờ" color={colors.warn} />}
              {topic && (
                <Badge
                  icon="git-network-outline"
                  label={topic.name}
                  color={colors.accent}
                  onPress={() => router.navigate({ pathname: '/map', params: { topic: topic.id } })}
                />
              )}
            </View>
          )}
        </View>
        {canStart && !task.done ? (
          <Pressable
            hitSlop={10}
            onPress={() => router.push({ pathname: '/focus', params: { taskId: task.id } })}
            accessibilityLabel="Học ngay"
          >
            <Ionicons name="play-circle" size={30} color={colors.accent} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

function Badge({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      hitSlop={6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: color + '66',
        backgroundColor: color + '1A',
        maxWidth: 200,
      }}
    >
      <Ionicons name={icon} size={10} color={color} />
      <Text style={{ color, fontSize: 10.5, fontWeight: '700' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

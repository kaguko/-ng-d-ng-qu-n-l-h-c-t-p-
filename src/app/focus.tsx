import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { Button, Card, Chip, Screen, Title } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { formatDuration, todayISO } from '@/lib/date';
import { elapsedMinutes, mmss, remainingMs } from '@/lib/focus';
import { useTicker } from '@/lib/useNow';
import { useStore } from '@/store';
import { colors } from '@/theme';
import { Task } from '@/types';

const PRESETS = [15, 25, 45, 60];
const KEEP_AWAKE_TAG = 'lumo-focus';

const RATINGS = [
  { value: 1, emoji: '😵', label: 'Rất tệ' },
  { value: 2, emoji: '😕', label: 'Phân tâm' },
  { value: 3, emoji: '😐', label: 'Tạm ổn' },
  { value: 4, emoji: '🙂', label: 'Tốt' },
  { value: 5, emoji: '🤩', label: 'Cực tập trung' },
];

export default function Focus() {
  const { taskId: paramTask } = useLocalSearchParams<{ taskId?: string }>();
  const { tasks, focus, focusResult, clearFocusResult } = useStore();
  // Ưu tiên phiên đang chạy, rồi phiên vừa xong, cuối cùng là buổi học được truyền vào.
  const taskId = focus ? focus.taskId : focusResult ? focusResult.taskId : paramTask || undefined;
  // kết quả đã xem ở đây thì không cần nhắc lại trên thanh nổi
  useEffect(() => () => clearFocusResult(), [clearFocusResult]);
  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;
  // key: đổi buổi học liên kết thì cấu hình (số phút, môn) khởi tạo lại
  return <FocusScreen key={task?.id ?? 'free'} task={task} />;
}

function FocusScreen({ task }: { task?: Task }) {
  const { subjects, logs, settings, focus, focusResult, startFocus, pauseFocus, resumeFocus, stopFocus, discardFocus } = useStore();

  const initial = task ? Math.min(180, Math.max(5, task.duration)) : 25;
  const [minutes, setMinutes] = useState(initial);
  const [subjectId, setSubjectId] = useState<string | null>(task?.subjectId ?? null);

  const running = !!focus && focus.endAt !== null;
  const now = useTicker(running);
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [running]);

  const total = (focus?.minutes ?? minutes) * 60000;
  const left = focus ? remainingMs(focus, now) : minutes * 60000;
  const presets = PRESETS.includes(initial) ? PRESETS : [...PRESETS, initial].sort((a, b) => a - b);

  const today = todayISO();
  const todayMin = logs.filter((l) => l.date === today).reduce((s, l) => s + l.minutes, 0);

  const start = () => startFocus({ minutes, subjectId: task ? task.subjectId : subjectId, taskId: task?.id });
  const stop = () => {
    if (!focus) return;
    if (elapsedMinutes(focus, Date.now()) < 1) {
      confirmAction('Huỷ phiên?', 'Chưa đủ 1 phút nên phiên này sẽ không được ghi lại.', discardFocus, 'Huỷ phiên', 'Học tiếp');
    } else stopFocus();
  };

  return (
    <Screen padBottom={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Thu nhỏ">
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Title sub={focus ? 'Cứ rời màn hình, đồng hồ vẫn chạy.' : 'Một việc một lúc. Điện thoại cứ để yên.'}>Tập trung</Title>
        </View>
      </View>

      {task ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.accent }}>
          <Ionicons name="book-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{focus ? 'Đang học' : 'Sẽ học'}</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>
              {task.title}
            </Text>
          </View>
          {!focus && (
            <Pressable hitSlop={10} onPress={() => router.setParams({ taskId: '' })} accessibilityLabel="Bỏ liên kết">
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          )}
        </Card>
      ) : null}

      <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
        <ProgressRing
          size={240}
          stroke={16}
          progress={focus && total ? 1 - left / total : 0}
          center={mmss(left)}
          caption={running ? 'đang tập trung…' : focus ? 'tạm dừng' : 'sẵn sàng'}
        />
        {focusResult && !focus ? (
          <Text style={{ color: colors.success, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
            🎉 Đã ghi {formatDuration(focusResult.minutes)} tập trung
            {focusResult.completedTask ? ' và hoàn thành buổi học!' : '!'}
          </Text>
        ) : null}
      </Card>

      {focusResult?.logId && !focus ? <RatingCard key={focusResult.logId} logId={focusResult.logId} /> : null}

      {!focus && (
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {presets.map((m) => (
            <Chip key={m} label={`${m}'`} active={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </View>
      )}

      {!focus && subjects.length > 0 && !task && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <Chip label="Chung" active={subjectId === null} onPress={() => setSubjectId(null)} />
          {subjects.map((s) => (
            <Chip key={s.id} label={`${s.emoji} ${s.name}`} color={s.color} active={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
          ))}
        </View>
      )}

      <View style={{ gap: 10 }}>
        {!focus ? (
          <Button label={focusResult ? 'Bắt đầu phiên mới' : 'Bắt đầu'} icon="play" onPress={start} />
        ) : running ? (
          <Button label="Tạm dừng" icon="pause" variant="ghost" onPress={pauseFocus} />
        ) : (
          <Button label="Tiếp tục" icon="play" onPress={resumeFocus} />
        )}
        {focus && <Button label="Kết thúc & lưu" icon="stop" variant="ghost" onPress={stop} />}
      </View>

      <Text style={{ color: colors.muted, textAlign: 'center' }}>
        Hôm nay: {formatDuration(todayMin)} / {formatDuration(settings.dailyGoalMin)}
      </Text>
    </Screen>
  );
}

function RatingCard({ logId }: { logId: string }) {
  const { setLogRating } = useStore();
  const [rating, setRating] = useState<number | null>(null);
  return (
    <Card>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Buổi vừa rồi bạn tập trung thế nào?</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {RATINGS.map((r) => (
          <Pressable
            key={r.value}
            accessibilityLabel={r.label}
            accessibilityState={{ selected: rating === r.value }}
            onPress={() => {
              setRating(r.value);
              setLogRating(logId, r.value);
            }}
            style={{
              alignItems: 'center',
              gap: 4,
              paddingVertical: 8,
              paddingHorizontal: 6,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: rating === r.value ? colors.accent : 'transparent',
              backgroundColor: rating === r.value ? colors.surface2 : 'transparent',
              minWidth: 56,
            }}
          >
            <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
            <Text style={{ color: rating === r.value ? colors.text : colors.muted, fontSize: 10 }}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
      {rating ? <Text style={{ color: colors.success, fontSize: 12 }}>Đã lưu. Điểm này góp vào biểu đồ chất lượng học.</Text> : null}
    </Card>
  );
}

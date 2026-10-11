import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { Button, Card, Chip, Screen, Title } from '@/components/ui';
import { formatDuration, todayISO } from '@/lib/date';
import { useStore } from '@/store';
import { colors } from '@/theme';
import { Task } from '@/types';

const PRESETS = [15, 25, 45, 60];
const KEEP_AWAKE_TAG = 'lumo-focus';

type Phase = 'idle' | 'running' | 'paused';

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function Focus() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { tasks } = useStore();
  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;
  // key buộc phiên đếm giờ khởi tạo lại khi đổi buổi học được liên kết
  return <FocusSession key={task?.id ?? 'free'} task={task} />;
}

function FocusSession({ task }: { task?: Task }) {
  const { subjects, logs, addLog, updateTask, settings } = useStore();
  const initial = task ? Math.min(180, Math.max(5, task.duration)) : 25;
  const [minutes, setMinutes] = useState(initial);
  const [subjectId, setSubjectId] = useState<string | null>(task?.subjectId ?? null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(initial * 60000);
  const [justDone, setJustDone] = useState<{ minutes: number; completed: boolean } | null>(null);

  const endAt = useRef(0);
  const totalMs = minutes * 60000;
  const presets = PRESETS.includes(initial) ? PRESETS : [...PRESETS, initial].sort((a, b) => a - b);

  const elapsedMinutes = useCallback(() => Math.floor((totalMs - remaining) / 60000), [totalMs, remaining]);

  // Nhịp đếm dựa trên mốc thời gian nên vẫn đúng khi app bị đưa xuống nền.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const left = endAt.current - Date.now();
      if (left <= 0) {
        clearInterval(id);
        setRemaining(0);
        setPhase('idle');
        addLog(minutes, subjectId);
        if (task && !task.done) updateTask(task.id, { done: true });
        setJustDone({ minutes, completed: !!task });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, minutes, subjectId, addLog, task, updateTask]);

  useEffect(() => {
    if (phase === 'running') activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [phase]);

  const pick = (m: number) => {
    if (phase !== 'idle') return;
    setMinutes(m);
    setRemaining(m * 60000);
    setJustDone(null);
  };

  const start = () => {
    endAt.current = Date.now() + remaining;
    setJustDone(null);
    setPhase('running');
  };
  const pause = () => {
    setRemaining(Math.max(0, endAt.current - Date.now()));
    setPhase('paused');
  };
  const finishEarly = () => {
    const done = elapsedMinutes();
    if (done >= 1) addLog(done, subjectId);
    setPhase('idle');
    setRemaining(totalMs);
    setJustDone(done >= 1 ? { minutes: done, completed: false } : null);
  };

  const today = todayISO();
  const todayMin = logs.filter((l) => l.date === today).reduce((s, l) => s + l.minutes, 0);

  return (
    <Screen>
      <Title sub="Một việc một lúc. Điện thoại cứ để yên.">Tập trung</Title>

      {task ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.accent }}>
          <Ionicons name="book-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Đang học</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>
              {task.title}
            </Text>
          </View>
          {phase === 'idle' && (
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
          progress={totalMs ? 1 - remaining / totalMs : 0}
          center={mmss(remaining)}
          caption={phase === 'running' ? 'đang tập trung…' : phase === 'paused' ? 'tạm dừng' : 'sẵn sàng'}
        />
        {justDone ? (
          <Text style={{ color: colors.success, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
            🎉 Đã ghi {formatDuration(justDone.minutes)} tập trung
            {justDone.completed ? ' và hoàn thành buổi học!' : '!'}
          </Text>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {presets.map((m) => (
          <Chip key={m} label={`${m}'`} active={minutes === m} onPress={() => pick(m)} />
        ))}
      </View>

      {phase === 'idle' && subjects.length > 0 && !task && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <Chip label="Chung" active={subjectId === null} onPress={() => setSubjectId(null)} />
          {subjects.map((s) => (
            <Chip
              key={s.id}
              label={`${s.emoji} ${s.name}`}
              color={s.color}
              active={subjectId === s.id}
              onPress={() => setSubjectId(s.id)}
            />
          ))}
        </View>
      )}

      <View style={{ gap: 10 }}>
        {phase === 'running' ? (
          <Button label="Tạm dừng" icon="pause" variant="ghost" onPress={pause} />
        ) : (
          <Button label={phase === 'paused' ? 'Tiếp tục' : 'Bắt đầu'} icon="play" onPress={start} />
        )}
        {phase !== 'idle' && <Button label="Kết thúc & lưu" icon="stop" variant="ghost" onPress={finishEarly} />}
      </View>

      <Text style={{ color: colors.muted, textAlign: 'center' }}>
        Hôm nay: {formatDuration(todayMin)} / {formatDuration(settings.dailyGoalMin)}
      </Text>
    </Screen>
  );
}

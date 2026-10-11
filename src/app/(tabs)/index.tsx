import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { TaskEditor } from '@/components/TaskEditor';
import { TaskRow } from '@/components/TaskRow';
import { Button, Card, Empty, ErrorBox, Screen, SectionTitle } from '@/components/ui';
import { addDays, formatDuration, formatLong, nowHHmm, toMinutes, todayISO, weekdayShort } from '@/lib/date';
import { GeminiError, rescheduleOverdue } from '@/lib/gemini';
import { qualityScore } from '@/lib/stats';
import { placeItems } from '@/lib/scheduler';
import { useStore } from '@/store';
import { colors } from '@/theme';
import { Task } from '@/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function Today() {
  const { tasks, logs, settings, streak, apiKey, updateTasks } = useStore();
  const today = todayISO();
  const [editing, setEditing] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const todays = useMemo(
    () => tasks.filter((t) => t.date === today).sort((a, b) => a.start.localeCompare(b.start)),
    [tasks, today],
  );
  const done = todays.filter((t) => t.done).length;

  const now = nowHHmm();
  const overdue = tasks.filter(
    (t) => !t.done && (t.date < today || (t.date === today && toMinutes(t.start) + t.duration < toMinutes(now))),
  );

  const focusToday = logs.filter((l) => l.date === today).reduce((s, l) => s + l.minutes, 0);
  const quality = useMemo(
    () => qualityScore({ tasks, logs, today, dailyGoalMin: settings.dailyGoalMin }),
    [tasks, logs, today, settings.dailyGoalMin],
  );

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i - 6);
        return { date, minutes: logs.filter((l) => l.date === date).reduce((s, l) => s + l.minutes, 0) };
      }),
    [logs, today],
  );
  const weekMax = Math.max(settings.dailyGoalMin, ...week.map((w) => w.minutes));

  const reschedule = async () => {
    setError('');
    setNotice('');
    if (!apiKey) {
      setError('Hãy nhập API key Gemini trong tab Cài đặt trước.');
      return;
    }
    setBusy(true);
    try {
      const overdueIds = new Set(overdue.map((o) => o.id));
      const untilDate = addDays(today, 6);
      // Mục tiêu tập trung không phải trần cứng: xếp lại cho phép tối thiểu 4 giờ học/ngày.
      const hoursPerDay = Math.max(4, Math.ceil(settings.dailyGoalMin / 60));
      const upcoming = tasks
        .filter((t) => !overdueIds.has(t.id) && t.date >= today && t.date <= untilDate)
        .map((t) => ({ date: t.date, start: t.start, duration: t.duration }));
      const suggested = await rescheduleOverdue({
        apiKey,
        model: settings.model,
        today,
        nowTime: now,
        untilDate,
        overdue: overdue.map((o) => ({ id: o.id, title: o.title, duration: o.duration, originalDate: o.date })),
        upcoming,
        hoursPerDay,
      });
      const byId = new Map(overdue.map((o) => [o.id, o]));
      const { placed } = placeItems(
        suggested.map((r) => ({ id: r.id, date: r.date, start: r.start, duration: byId.get(r.id)!.duration })),
        {
          startDate: today,
          endDate: untilDate,
          windowStart: '06:00',
          windowEnd: '22:30',
          maxMinutesPerDay: hoursPerDay * 60,
          existing: upcoming,
          earliest: { date: today, minute: toMinutes(now) + 5 },
        },
      );
      if (!placed.length) throw new GeminiError('Không còn chỗ trống trong 7 ngày tới để xếp lại.');
      updateTasks(placed.map((r) => ({ id: r.id, patch: { date: r.date, start: r.start } })));
      setNotice(`Đã xếp lại ${placed.length}/${overdue.length} buổi học bị lỡ.`);
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Có lỗi xảy ra, thử lại nhé.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.muted, fontSize: 14 }}>{formatLong(today)}</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{greeting()} 👋</Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.surface2,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontSize: 16 }}>🔥</Text>
          <Text style={{ color: colors.warn, fontWeight: '800', fontSize: 16 }}>{streak}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => router.push('/focus')} style={{ flex: 1 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
            <Ionicons name="timer" size={26} color={colors.accent} />
            <View>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Tập trung</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Bấm giờ ngay</Text>
            </View>
          </Card>
        </Pressable>
        <Pressable onPress={() => router.navigate('/stats')} style={{ flex: 1 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
            <Ionicons name="stats-chart" size={26} color={colors.primary} />
            <View>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{quality.hasData ? `${quality.score} điểm` : 'Thống kê'}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{quality.hasData ? quality.label : 'Chất lượng học'}</Text>
            </View>
          </Card>
        </Pressable>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <ProgressRing
          size={118}
          progress={todays.length ? done / todays.length : 0}
          center={`${done}/${todays.length}`}
          caption="buổi học"
        />
        <View style={{ flex: 1, gap: 10 }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Thời gian tập trung hôm nay</Text>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{formatDuration(focusToday)}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' }}>
            <View
              style={{
                height: 8,
                width: `${Math.min(100, (focusToday / settings.dailyGoalMin) * 100)}%`,
                backgroundColor: colors.accent,
              }}
            />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Mục tiêu {formatDuration(settings.dailyGoalMin)}/ngày</Text>
        </View>
      </Card>

      {(overdue.length > 0 || error || notice) && (
        <Card style={{ borderColor: overdue.length ? colors.warn : colors.border }}>
          {overdue.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={22} color={colors.warn} />
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                  Bạn có {overdue.length} buổi học bị lỡ
                </Text>
              </View>
              <Button label="AI xếp lại lịch giúp tôi" icon="sparkles" onPress={reschedule} loading={busy} />
            </>
          )}
          {error ? <ErrorBox message={error} /> : null}
          {notice ? <Text style={{ color: colors.success, fontWeight: '600' }}>{notice}</Text> : null}
        </Card>
      )}

      <Pressable onPress={() => router.push('/coach')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 28 }}>🧠</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Hỏi Lumo</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Nhận lời khuyên dựa trên lịch và tiến độ của bạn</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      </Pressable>

      <SectionTitle>Lịch hôm nay</SectionTitle>
      {todays.length === 0 ? (
        <Card>
          <Empty icon="sparkles-outline" text="Hôm nay chưa có buổi học nào. Để AI lập lịch học hiệu quả cho bạn nhé!" />
          <Button label="Lập lịch bằng AI" icon="sparkles" onPress={() => router.push('/planner')} />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {todays.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onPress={() => setEditing(t)}
              onStart={() => router.navigate({ pathname: '/focus', params: { taskId: t.id } })}
            />
          ))}
        </View>
      )}

      <SectionTitle>7 ngày qua</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110 }}>
          {week.map((w) => (
            <View key={w.date} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <View style={{ height: 80, justifyContent: 'flex-end' }}>
                <View
                  style={{
                    width: 18,
                    height: Math.max(4, (w.minutes / weekMax) * 80),
                    borderRadius: 6,
                    backgroundColor: w.date === today ? colors.accent : colors.primary,
                    opacity: w.minutes ? 1 : 0.25,
                  }}
                />
              </View>
              <Text style={{ color: w.date === today ? colors.text : colors.muted, fontSize: 11, fontWeight: '600' }}>
                {weekdayShort(w.date)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <TaskEditor visible={!!editing} task={editing} defaultDate={today} onClose={() => setEditing(null)} />
    </Screen>
  );
}

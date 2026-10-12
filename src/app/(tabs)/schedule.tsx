import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskEditor } from '@/components/TaskEditor';
import { DayAgenda } from '@/components/DayAgenda';
import { Button, Chip, Empty, Title, useBannerInset } from '@/components/ui';
import { WeekGrid } from '@/components/WeekGrid';
import { addDays, formatDuration, formatLong, formatShort, fromISO, startOfWeek, weekdayShort } from '@/lib/date';
import { useNow } from '@/lib/useNow';
import { useStore } from '@/store';
import { colors, gradients } from '@/theme';
import { Task } from '@/types';

type Mode = 'day' | 'week';

export default function Schedule() {
  const { tasks, subjects, subjectOf } = useStore();
  const bannerInset = useBannerInset();
  const { today, now } = useNow();
  const [mode, setMode] = useState<Mode>('week');
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<{ date: string; start: string } | null>(null);

  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, i - 3)), [today]);
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.date === selected).sort((a, b) => a.start.localeCompare(b.start)),
    [tasks, selected],
  );
  const total = dayTasks.reduce((s, t) => s + t.duration, 0);

  const weekStart = startOfWeek(selected);
  const weekEnd = addDays(weekStart, 6);
  const weekTasks = tasks.filter((t) => t.date >= weekStart && t.date <= weekEnd);
  const weekTotal = weekTasks.reduce((s, t) => s + t.duration, 0);
  const weekDone = weekTasks.filter((t) => t.done).length;

  const openEditor = (t: Task | null, at: { date: string; start: string } | null = null) => {
    setEditing(t);
    setSlot(at);
    setOpen(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ padding: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {mode === 'day' ? (
            <Title sub={selected === today ? 'Hôm nay' : selected === addDays(today, 1) ? 'Ngày mai' : `${dayTasks.length} buổi · ${formatDuration(total)}`}>
              {formatLong(selected)}
            </Title>
          ) : (
            <Title sub={`${weekTasks.length} buổi · ${formatDuration(weekTotal)}${weekTasks.length ? ` · ${weekDone} xong` : ''}`}>
              {`${formatShort(weekStart)} – ${formatShort(weekEnd)}`}
            </Title>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          <Chip label="Ngày" active={mode === 'day'} onPress={() => setMode('day')} />
          <Chip label="Tuần" active={mode === 'week'} onPress={() => setMode('week')} />
        </View>
      </View>

      {mode === 'day' ? (
        <>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {days.map((d) => {
                const isSel = d === selected;
                const mine = tasks.filter((t) => t.date === d);
                // tối đa 3 chấm màu theo môn (không trùng); xong hết thì đổi sang dấu ✓
                const dots = [...new Set(mine.map((t) => subjectOf(t.subjectId)?.color ?? colors.muted))].slice(0, 3);
                const allDone = mine.length > 0 && mine.every((t) => t.done);
                return (
                  <Pressable key={d} onPress={() => setSelected(d)}>
                    {isSel ? (
                      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dayStyle}>
                        <DayInner d={d} dots={dots} allDone={allDone} sel />
                      </LinearGradient>
                    ) : (
                      <View style={[dayStyle, { backgroundColor: colors.surface, borderWidth: 1, borderColor: d === today ? colors.accent : colors.border }]}>
                        <DayInner d={d} dots={dots} allDone={allDone} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: 150 + bannerInset }} showsVerticalScrollIndicator={false}>
            {dayTasks.length === 0 ? (
              <View style={{ gap: 12 }}>
                <Empty icon="calendar-clear-outline" text="Không có buổi học nào trong ngày này." />
                <Button label="Thêm buổi học" icon="add" variant="ghost" onPress={() => openEditor(null)} />
              </View>
            ) : (
              <DayAgenda
                tasks={dayTasks}
                isToday={selected === today}
                isPast={selected < today}
                now={now}
                onTask={(t) => openEditor(t)}
                onSlot={(start) => openEditor(null, { date: selected, start })}
              />
            )}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 }}>
            <Pressable onPress={() => setSelected(addDays(weekStart, -7))} hitSlop={10} accessibilityLabel="Tuần trước">
              <Ionicons name="chevron-back-circle-outline" size={28} color={colors.muted} />
            </Pressable>
            <Chip label="Tuần này" active={weekStart === startOfWeek(today)} onPress={() => setSelected(today)} />
            <Pressable onPress={() => setSelected(addDays(weekStart, 7))} hitSlop={10} accessibilityLabel="Tuần sau">
              <Ionicons name="chevron-forward-circle-outline" size={28} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 + bannerInset }} showsVerticalScrollIndicator={false}>
            <WeekGrid
              weekStart={weekStart}
              tasks={tasks}
              subjects={subjects}
              today={today}
              now={now}
              onTask={(t) => openEditor(t)}
              onSlot={(date, start) => openEditor(null, { date, start })}
              onDay={(d) => {
                setSelected(d);
                setMode('day');
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 10 }}>
              Chạm ô trống để thêm buổi vào giờ đó · chạm tên ngày hoặc khối trùng giờ để xem dòng thời gian của ngày.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
              {subjects.map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{s.name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <Pressable onPress={() => openEditor(null)} style={{ position: 'absolute', right: 20, bottom: 100 + bannerInset }} accessibilityLabel="Thêm buổi học">
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>

      <TaskEditor
        visible={open}
        task={editing}
        defaultDate={slot?.date ?? selected}
        defaultStart={slot?.start}
        onClose={() => setOpen(false)}
      />
    </SafeAreaView>
  );
}

const dayStyle = { width: 50, paddingVertical: 10, borderRadius: 16, alignItems: 'center' as const, gap: 4 };

function DayInner({ d, dots, allDone, sel }: { d: string; dots: string[]; allDone: boolean; sel?: boolean }) {
  return (
    <>
      <Text style={{ color: sel ? '#fff' : colors.muted, fontSize: 11, fontWeight: '600' }}>{weekdayShort(d)}</Text>
      <Text style={{ color: sel ? '#fff' : colors.text, fontSize: 18, fontWeight: '800' }}>{fromISO(d).getDate()}</Text>
      <View style={{ flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' }}>
        {allDone ? (
          <Ionicons name="checkmark" size={10} color={sel ? '#fff' : colors.success} />
        ) : (
          dots.map((c) => (
            <View key={c} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: sel ? '#fff' : c }} />
          ))
        )}
      </View>
    </>
  );
}

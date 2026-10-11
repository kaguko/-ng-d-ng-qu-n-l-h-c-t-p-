import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskEditor } from '@/components/TaskEditor';
import { TaskRow } from '@/components/TaskRow';
import { Empty, Title } from '@/components/ui';
import { addDays, formatDuration, formatLong, fromISO, todayISO, weekdayShort } from '@/lib/date';
import { useStore } from '@/store';
import { colors, gradients } from '@/theme';
import { Task } from '@/types';

export default function Schedule() {
  const { tasks } = useStore();
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, i - 3)), [today]);
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.date === selected).sort((a, b) => a.start.localeCompare(b.start)),
    [tasks, selected],
  );
  const total = dayTasks.reduce((s, t) => s + t.duration, 0);

  const openEditor = (t: Task | null) => {
    setEditing(t);
    setOpen(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ padding: 20, paddingBottom: 12 }}>
        <Title sub={`${dayTasks.length} buổi · ${formatDuration(total)}`}>{formatLong(selected)}</Title>
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {days.map((d) => {
            const isSel = d === selected;
            const count = tasks.filter((t) => t.date === d).length;
            return (
              <Pressable key={d} onPress={() => setSelected(d)}>
                {isSel ? (
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={dayStyle}
                  >
                    <DayInner d={d} count={count} sel />
                  </LinearGradient>
                ) : (
                  <View style={[dayStyle, { backgroundColor: colors.surface, borderWidth: 1, borderColor: d === today ? colors.accent : colors.border }]}>
                    <DayInner d={d} count={count} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {dayTasks.length === 0 ? (
          <Empty icon="calendar-clear-outline" text="Không có buổi học nào trong ngày này." />
        ) : (
          dayTasks.map((t) => <TaskRow key={t.id} task={t} onPress={() => openEditor(t)} />)
        )}
      </ScrollView>

      <Pressable onPress={() => openEditor(null)} style={{ position: 'absolute', right: 20, bottom: 24 }}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>

      <TaskEditor visible={open} task={editing} defaultDate={selected} onClose={() => setOpen(false)} />
    </SafeAreaView>
  );
}

const dayStyle = { width: 50, paddingVertical: 10, borderRadius: 16, alignItems: 'center' as const, gap: 4 };

function DayInner({ d, count, sel }: { d: string; count: number; sel?: boolean }) {
  return (
    <>
      <Text style={{ color: sel ? '#fff' : colors.muted, fontSize: 11, fontWeight: '600' }}>{weekdayShort(d)}</Text>
      <Text style={{ color: sel ? '#fff' : colors.text, fontSize: 18, fontWeight: '800' }}>{fromISO(d).getDate()}</Text>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: count ? (sel ? '#fff' : colors.accent) : 'transparent',
        }}
      />
    </>
  );
}

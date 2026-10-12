import React, { useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { addDays, fromISO, fromMinutes, toMinutes, weekdayShort } from '@/lib/date';
import { colors } from '@/theme';
import { Subject, Task } from '@/types';

const HOUR_H = 46;
const GUTTER = 30;
const HEAD_H = 46;

type Placed = { task: Task; lane: number; lanes: number };

/** Chia các buổi trùng giờ trong cùng một ngày thành các làn đứng cạnh nhau. */
function layoutLanes(tasks: Task[]): Placed[] {
  const sorted = [...tasks].sort((a, b) => a.start.localeCompare(b.start) || b.duration - a.duration);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    cluster.forEach((p) => (p.lanes = laneEnds.length));
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const t of sorted) {
    const s = toMinutes(t.start);
    const e = s + t.duration;
    if (s >= clusterEnd) {
      flush();
      clusterEnd = e;
    } else clusterEnd = Math.max(clusterEnd, e);
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = e;
    cluster.push({ task: t, lane, lanes: 1 });
  }
  flush();
  return out;
}

export function WeekGrid({
  weekStart,
  tasks,
  subjects,
  today,
  now,
  onTask,
  onDay,
  onSlot,
}: {
  weekStart: string;
  tasks: Task[];
  subjects: Subject[];
  today: string;
  /** "HH:mm" hiện tại, cho vạch giờ */
  now: string;
  onTask: (t: Task) => void;
  onDay: (date: string) => void;
  /** chạm vào ô trống: ngày và giờ bắt đầu (làm tròn 30 phút) */
  onSlot?: (date: string, start: string) => void;
}) {
  const { width } = useWindowDimensions();
  const colW = (width - 40 - GUTTER) / 7;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekTasks = useMemo(() => tasks.filter((t) => t.date >= days[0] && t.date <= days[6]), [tasks, days]);
  const startH = Math.max(0, Math.min(7, ...weekTasks.map((t) => Math.floor(toMinutes(t.start) / 60))));
  const endH = Math.min(24, Math.max(22, ...weekTasks.map((t) => Math.ceil((toMinutes(t.start) + t.duration) / 60))));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const bodyH = (endH - startH) * HOUR_H;
  const subj = (id: string | null) => subjects.find((s) => s.id === id);

  const nowMin = toMinutes(now);
  const nowTop = ((nowMin - startH * 60) / 60) * HOUR_H;
  const todayIdx = days.indexOf(today);

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', height: HEAD_H, paddingLeft: GUTTER }}>
        {days.map((d) => {
          const isToday = d === today;
          return (
            <Pressable key={d} onPress={() => onDay(d)} style={{ width: colW, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Text style={{ color: isToday ? colors.accent : colors.muted, fontSize: 10, fontWeight: '700' }}>{weekdayShort(d)}</Text>
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isToday ? colors.primary : 'transparent',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{fromISO(d).getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: bodyH + 8, borderTopWidth: 1, borderTopColor: colors.border }}>
        {hours.map((h) => (
          <View key={h} style={{ position: 'absolute', top: (h - startH) * HOUR_H + 4, left: 0, right: 0 }}>
            <Text style={{ position: 'absolute', left: 4, top: -6, color: colors.muted, fontSize: 9 }}>{String(h).padStart(2, '0')}</Text>
            <View style={{ marginLeft: GUTTER, height: 1, backgroundColor: colors.border, opacity: 0.5 }} />
          </View>
        ))}

        {days.map((d, i) => (
          <Pressable
            key={d}
            accessibilityLabel={`Thêm buổi học ngày ${fromISO(d).getDate()}`}
            onPress={(e) => {
              if (!onSlot) return;
              const min = startH * 60 + (e.nativeEvent.locationY / HOUR_H) * 60;
              onSlot(d, fromMinutes(Math.min(23 * 60 + 30, Math.max(0, Math.floor(min / 30) * 30))));
            }}
            style={{
              position: 'absolute',
              left: GUTTER + i * colW,
              top: 4,
              width: colW,
              height: bodyH,
              backgroundColor: d === today ? 'rgba(124,92,255,0.07)' : 'transparent',
              borderLeftWidth: 1,
              borderLeftColor: colors.border,
              opacity: 1,
            }}
          >
            {layoutLanes(weekTasks.filter((t) => t.date === d)).map(({ task, lane, lanes }) => {
              const s = subj(task.subjectId);
              const color = s?.color ?? colors.muted;
              const top = ((toMinutes(task.start) - startH * 60) / 60) * HOUR_H;
              const h = Math.max(20, (task.duration / 60) * HOUR_H - 2);
              const w = (colW - 2) / lanes;
              const maxLines = Math.max(1, Math.floor((h - 4) / 11));
              return (
                <Pressable
                  key={task.id}
                  onPress={() => onTask(task)}
                  style={{
                    position: 'absolute',
                    top: top + 1,
                    left: 1 + lane * w,
                    width: w - 1,
                    height: h,
                    borderRadius: 6,
                    backgroundColor: color + '40',
                    borderLeftWidth: 3,
                    borderLeftColor: color,
                    paddingHorizontal: 2,
                    paddingVertical: 1,
                    overflow: 'hidden',
                    opacity: task.done ? 0.5 : 1,
                  }}
                >
                  <Text
                    numberOfLines={maxLines}
                    style={{ color: colors.text, fontSize: 9, lineHeight: 11, fontWeight: '700', textDecorationLine: task.done ? 'line-through' : 'none' }}
                  >
                    {task.done ? '✓ ' : ''}
                    {task.title}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        ))}

        {todayIdx >= 0 && nowTop >= 0 && nowTop <= bodyH && (
          <View pointerEvents="none" style={{ position: 'absolute', top: nowTop + 4, left: GUTTER, right: 0, height: 2, backgroundColor: colors.pink }}>
            <View style={{ position: 'absolute', left: todayIdx * colW - 3, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink }} />
          </View>
        )}
      </View>
    </View>
  );
}

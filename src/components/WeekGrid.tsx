import React, { useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { layoutLanes, timeScale } from '@/lib/agenda';
import { addDays, fromISO, fromMinutes, toMinutes, weekdayShort } from '@/lib/date';
import { colors } from '@/theme';
import { Subject, Task } from '@/types';

const HOUR_H = 54;
const GUTTER = 28;
const HEAD_H = 58;
/** chiều cao dải gộp các giờ trống liên tiếp */
const COLLAPSED_H = 22;
/**
 * Cột ngày trên điện thoại chỉ rộng ~45px, chia làn sẽ bẻ chữ từng ký tự. Vì vậy buổi trùng giờ
 * không xếp cạnh nhau mà gom thành một khối "N buổi · trùng giờ"; chạm để xem chi tiết ngày.
 */
const MAX_LANES = 1;

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
  const scale = useMemo(() => timeScale(weekTasks, HOUR_H, COLLAPSED_H), [weekTasks]);
  const { segments, yOf, minOf } = scale;
  const bodyH = scale.height;
  const subj = (id: string | null) => subjects.find((s) => s.id === id);
  // vạch giờ: đầu mỗi giờ hiển thị đầy đủ, cộng mốc cuối khung
  const hourLines = segments.filter((s) => !s.collapsed).map((s) => ({ h: s.fromH, top: s.top }));
  const last = segments[segments.length - 1];
  if (last && !last.collapsed) hourLines.push({ h: last.toH, top: last.top + last.height });

  const load = days.map((d) => weekTasks.filter((t) => t.date === d).reduce((s, t) => s + t.duration, 0));
  const maxLoad = Math.max(60, ...load);

  const nowMin = toMinutes(now);
  const nowTop = yOf(nowMin);
  const todayIdx = days.indexOf(today);

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', height: HEAD_H, paddingLeft: GUTTER }}>
        {days.map((d, i) => {
          const isToday = d === today;
          const dayTasks = weekTasks.filter((t) => t.date === d);
          const done = dayTasks.filter((t) => t.done).length;
          return (
            <Pressable
              key={d}
              onPress={() => onDay(d)}
              accessibilityLabel={`Xem ngày ${fromISO(d).getDate()}, ${dayTasks.length} buổi`}
              style={{ width: colW, alignItems: 'center', justifyContent: 'center', gap: 3 }}
            >
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
              {/* tải học trong ngày: dài theo số phút, phần đã xong tô đậm */}
              <View style={{ width: colW - 14, height: 3, borderRadius: 2, backgroundColor: colors.surface2, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.round((load[i] / maxLoad) * 100)}%`,
                    height: 3,
                    backgroundColor: dayTasks.length && done === dayTasks.length ? colors.success : colors.accent,
                    opacity: load[i] ? 1 : 0,
                  }}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: bodyH + 8, borderTopWidth: 1, borderTopColor: colors.border }}>
        {hourLines.map(({ h, top }) => (
          <View key={h} style={{ position: 'absolute', top: top + 4, left: 0, right: 0, zIndex: 2 }}>
            <Text style={{ position: 'absolute', left: 4, top: -6, color: colors.muted, fontSize: 9 }}>{String(h).padStart(2, '0')}</Text>
            <View style={{ marginLeft: GUTTER, height: 1, backgroundColor: colors.border, opacity: 0.45 }} />
          </View>
        ))}

        {segments
          .filter((s) => s.collapsed)
          .map((s) => (
            <View
              key={`gap-${s.fromH}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: s.top + 4,
                left: 0,
                right: 0,
                height: s.height,
                backgroundColor: colors.bg,
                opacity: 0.85,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {String(s.fromH).padStart(2, '0')}–{String(s.toH).padStart(2, '0')} · trống
              </Text>
            </View>
          ))}

        {days.map((d, i) => {
          const { placed, overflow } = layoutLanes(
            weekTasks.filter((t) => t.date === d),
            MAX_LANES,
          );
          return (
            <Pressable
              key={d}
              accessibilityLabel={`Thêm buổi học ngày ${fromISO(d).getDate()}`}
              onPress={(e) => {
                if (!onSlot) return;
                const min = minOf(e.nativeEvent.locationY);
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
              }}
            >
              {placed.map(({ task, lane, lanes }) => {
                const color = subj(task.subjectId)?.color ?? colors.muted;
                const top = yOf(toMinutes(task.start));
                const s0 = toMinutes(task.start);
                const h = Math.max(22, yOf(s0 + task.duration) - yOf(s0) - 2);
                const w = (colW - 3) / lanes;
                const showTime = h >= 34 && lanes === 1;
                const titleLines = Math.max(1, Math.floor((h - (showTime ? 15 : 4)) / 11));
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => onTask(task)}
                    accessibilityLabel={`${task.start} ${task.title}`}
                    style={{
                      position: 'absolute',
                      top: top + 1,
                      left: 1.5 + lane * w,
                      width: w - 1.5,
                      height: h,
                      borderRadius: 6,
                      backgroundColor: color + (task.done ? '26' : '4D'),
                      borderLeftWidth: 3,
                      borderLeftColor: color,
                      paddingHorizontal: 3,
                      paddingVertical: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {showTime && (
                      <Text style={{ color: colors.text, opacity: 0.75, fontSize: 8.5, fontWeight: '700' }} numberOfLines={1}>
                        {task.done ? '✓ ' : ''}
                        {task.start}
                      </Text>
                    )}
                    <Text
                      numberOfLines={titleLines}
                      style={{
                        color: colors.text,
                        opacity: task.done ? 0.6 : 1,
                        fontSize: 9.5,
                        lineHeight: 11,
                        fontWeight: '700',
                        textDecorationLine: task.done ? 'line-through' : 'none',
                      }}
                    >
                      {!showTime && task.done ? '✓ ' : ''}
                      {task.title}
                    </Text>
                  </Pressable>
                );
              })}

              {overflow.map((o) => {
                const w = (colW - 3) / o.lanes;
                return (
                  <Pressable
                    key={`more-${o.start}`}
                    onPress={() => onDay(d)}
                    accessibilityLabel={`${o.tasks.length} buổi trùng giờ, mở ngày`}
                    style={{
                      position: 'absolute',
                      top: yOf(o.start) + 1,
                      left: 1.5 + o.lane * w,
                      width: w - 1.5,
                      height: Math.max(22, yOf(o.end) - yOf(o.start) - 2),
                      borderRadius: 6,
                      borderWidth: 1.5,
                      borderColor: colors.warn,
                      backgroundColor: colors.surface2,
                      overflow: 'hidden',
                      paddingHorizontal: 3,
                      paddingVertical: 2,
                    }}
                  >
                    {/* sọc màu các môn trong cụm */}
                    <View style={{ flexDirection: 'row', gap: 2, marginBottom: 2 }}>
                      {o.tasks.slice(0, 4).map((t) => (
                        <View key={t.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: subj(t.subjectId)?.color ?? colors.muted }} />
                      ))}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 9.5, fontWeight: '800' }} numberOfLines={1}>
                      {o.tasks.length} buổi
                    </Text>
                    <Text style={{ color: colors.warn, fontSize: 8.5, fontWeight: '700' }} numberOfLines={1}>
                      trùng giờ
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 8.5 }} numberOfLines={1}>
                      {fromMinutes(o.start)}
                    </Text>
                  </Pressable>
                );
              })}
            </Pressable>
          );
        })}

        {todayIdx >= 0 && nowTop >= 0 && nowTop <= bodyH && (
          <View pointerEvents="none" style={{ position: 'absolute', top: nowTop + 4, left: GUTTER, right: 0, height: 2, backgroundColor: colors.pink, zIndex: 3 }}>
            <View style={{ position: 'absolute', left: todayIdx * colW - 3, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink }} />
          </View>
        )}
      </View>
    </View>
  );
}

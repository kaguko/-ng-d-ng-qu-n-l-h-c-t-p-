import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BarChart, Donut, fmtMin, Heatmap, HeatLegend, LineChart, Meter, Slice, StatTile } from '@/components/charts';
import { ProgressRing } from '@/components/ProgressRing';
import { Card, Chip, Empty, Screen, SectionTitle, Title } from '@/components/ui';
import { formatDuration, formatShort, todayISO, weekdayShort } from '@/lib/date';
import {
  completion,
  focusByDay,
  heatmap,
  heatmapDates,
  minutesBySubject,
  qualityScore,
  ratingByDay,
} from '@/lib/stats';
import { useStore } from '@/store';
import { colors } from '@/theme';

const MAX_SLICES = 7;

export default function Stats() {
  const { tasks, logs, subjects, settings, streak } = useStore();
  const today = todayISO();
  const goal = settings.dailyGoalMin;

  const [bar, setBar] = useState<string | null>(null);
  const [cell, setCell] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30>(7);
  const [slice, setSlice] = useState<string | null>(null);
  const [dot, setDot] = useState<string | null>(null);

  const quality = useMemo(() => qualityScore({ tasks, logs, today, dailyGoalMin: goal }), [tasks, logs, today, goal]);
  const days = useMemo(() => focusByDay(logs, today, 14), [logs, today]);
  const heat = useMemo(() => heatmap(logs, today, 12), [logs, today]);
  const heatDates = useMemo(() => heatmapDates(today, 12), [today]);
  const ratings = useMemo(() => ratingByDay(logs, today, 14), [logs, today]);
  const c7 = useMemo(() => completion(tasks, today, 7), [tasks, today]);

  const week = days.slice(-7);
  const weekMin = week.reduce((s, d) => s + d.minutes, 0);
  const ratedLogs = logs.filter((l) => l.rating && l.date >= days[7].date);
  const avgRating = ratedLogs.length ? ratedLogs.reduce((s, l) => s + l.rating!, 0) / ratedLogs.length : null;

  const slices = useMemo<Slice[]>(() => {
    const m = minutesBySubject(logs, today, range);
    const rows = [...m.entries()]
      .map(([id, value]) => {
        const s = subjects.find((x) => x.id === id);
        return { key: id ?? 'none', label: s ? `${s.emoji} ${s.name}` : 'Chung', value, color: s?.color ?? '#6B6E99' };
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    if (rows.length <= MAX_SLICES + 1) return rows;
    const rest = rows.slice(MAX_SLICES);
    return [...rows.slice(0, MAX_SLICES), { key: 'other', label: 'Khác', value: rest.reduce((s, r) => s + r.value, 0), color: '#6B6E99' }];
  }, [logs, subjects, today, range]);
  const sliceTotal = slices.reduce((s, x) => s + x.value, 0);

  const mastery = subjects
    .map((s) => {
      const mine = tasks.filter((t) => t.subjectId === s.id);
      return { s, total: mine.length, done: mine.filter((t) => t.done).length };
    })
    .filter((m) => m.total > 0);

  const selBar = days.find((d) => d.date === bar);
  const selCell = cell ? { date: cell, minutes: heat.flatMap((c, wi) => c.map((m, r) => ({ d: heatDates[wi][r], m }))).find((x) => x.d === cell)?.m ?? 0 } : null;
  const selSlice = slices.find((s) => s.key === slice);
  const selDot = ratings.find((r) => r.date === dot);

  const hasAny = logs.length > 0 || tasks.length > 0;

  return (
    <Screen>
      <Title sub="Chất lượng học của bạn trong 7 ngày gần nhất">Thống kê</Title>

      {!hasAny ? (
        <Card>
          <Empty icon="stats-chart-outline" text="Chưa có dữ liệu. Hãy lập lịch và hoàn thành vài buổi tập trung để xem biểu đồ." />
        </Card>
      ) : null}

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <ProgressRing size={128} stroke={12} progress={quality.score / 100} center={quality.hasData ? String(quality.score) : '–'} caption="/ 100 điểm" />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Điểm chất lượng học</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{quality.label}</Text>
          {quality.parts.map((p) => (
            <View key={p.key} style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{p.label}</Text>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>
                  {p.value === null ? '–' : `${Math.round(p.value * 100)}%`}
                </Text>
              </View>
              <Meter value={p.value ?? 0} height={6} />
            </View>
          ))}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile label="Tập trung 7 ngày" value={formatDuration(weekMin)} sub={`TB ${fmtMin(Math.round(weekMin / 7))}/ngày`} />
        <StatTile label="Hoàn thành" value={c7.rate === null ? '–' : `${Math.round(c7.rate * 100)}%`} sub={`${c7.done}/${c7.planned} buổi`} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile label="Chuỗi ngày học" value={`${streak} 🔥`} sub="ngày liên tiếp" />
        <StatTile label="Tự đánh giá" value={avgRating === null ? '–' : `${avgRating.toFixed(1)}/5`} sub={ratedLogs.length ? `${ratedLogs.length} buổi` : 'chưa có'} />
      </View>

      <SectionTitle>Phút tập trung · 14 ngày</SectionTitle>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700', minHeight: 20 }}>
          {selBar ? `${weekdayShort(selBar.date)} ${formatShort(selBar.date)} · ${formatDuration(selBar.minutes)}` : 'Chạm vào cột để xem chi tiết'}
        </Text>
        <BarChart
          data={days.map((d) => ({ key: d.date, label: weekdayShort(d.date), value: d.minutes }))}
          goal={goal}
          selectedKey={bar}
          onSelect={(b) => setBar(b.key === bar ? null : b.key)}
        />
      </Card>

      <SectionTitle>Độ đều đặn · 12 tuần</SectionTitle>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700', minHeight: 20 }}>
          {selCell ? `${formatShort(selCell.date)} · ${selCell.minutes ? formatDuration(selCell.minutes) : 'không học'}` : 'Mỗi ô là một ngày, càng sáng càng học nhiều'}
        </Text>
        <Heatmap weeks={heat} dates={heatDates} goal={goal} selectedDate={cell} onSelect={(c) => setCell(c.date === cell ? null : c.date)} />
        <HeatLegend />
      </Card>

      <SectionTitle
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip label="7 ngày" active={range === 7} onPress={() => setRange(7)} />
            <Chip label="30 ngày" active={range === 30} onPress={() => setRange(30)} />
          </View>
        }
      >
        Thời gian theo môn
      </SectionTitle>
      <Card>
        {slices.length === 0 ? (
          <Empty icon="pie-chart-outline" text="Chưa có phút tập trung nào trong khoảng này." />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Donut
              slices={slices}
              size={140}
              selectedKey={slice}
              onSelect={(s) => setSlice(s.key === slice ? null : s.key)}
              centerTop={selSlice ? fmtMin(selSlice.value) : fmtMin(sliceTotal)}
              centerBottom={selSlice ? `${Math.round((selSlice.value / sliceTotal) * 100)}%` : 'tổng'}
            />
            <View style={{ flex: 1, gap: 8 }}>
              {slices.map((s) => (
                <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
                  <Text style={{ color: colors.text, fontSize: 12, flex: 1, fontWeight: s.key === slice ? '800' : '400' }} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtMin(s.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>

      <SectionTitle>Xu hướng tập trung (tự đánh giá)</SectionTitle>
      <Card>
        {ratings.filter((r) => r.rating !== null).length >= 2 ? (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', minHeight: 20 }}>
              {selDot && selDot.rating !== null ? `${formatShort(selDot.date)} · ${selDot.rating.toFixed(1)}/5` : 'Điểm trung bình mỗi ngày (1–5)'}
            </Text>
            <LineChart
              data={ratings.map((r) => ({ key: r.date, label: formatShort(r.date), value: r.rating }))}
              min={1}
              max={5}
              ticks={[1, 3, 5]}
              selectedKey={dot}
              onSelect={(p) => setDot(p.key === dot ? null : p.key)}
            />
          </>
        ) : (
          <Empty icon="happy-outline" text="Sau mỗi buổi tập trung, hãy tự đánh giá 1–5 sao. Cần ít nhất 2 ngày có đánh giá để vẽ xu hướng." />
        )}
      </Card>

      <SectionTitle>Tiến độ theo môn</SectionTitle>
      <Card>
        {mastery.length === 0 ? (
          <Empty icon="school-outline" text="Chưa có buổi học nào gắn với môn học." />
        ) : (
          mastery.map(({ s, total, done }) => (
            <View key={s.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                  {s.emoji} {s.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {done}/{total} buổi · {Math.round((done / total) * 100)}%
                </Text>
              </View>
              <Meter value={done / total} color={s.color} />
            </View>
          ))
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>
          Điểm = hoàn thành 40% + đều đặn 30% + đạt mục tiêu phút/ngày 20% + tự đánh giá 10%. Phần nào chưa có dữ liệu sẽ được bỏ qua.
        </Text>
      </View>
    </Screen>
  );
}

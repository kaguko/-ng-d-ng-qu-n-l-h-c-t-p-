import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Chip, ErrorBox, Field, Screen, SectionTitle, Stepper, Title } from '@/components/ui';
import {
  addDays,
  daysBetween,
  endTime,
  formatDuration,
  formatLong,
  formatShort,
  fromMinutes,
  nowHHmm,
  toMinutes,
  todayISO,
} from '@/lib/date';
import { GeminiError, generatePlan, PlanItem } from '@/lib/gemini';
import { placeItems } from '@/lib/scheduler';
import { useStore } from '@/store';
import { colors } from '@/theme';

const LEVELS = ['Mới bắt đầu', 'Trung bình', 'Khá', 'Nâng cao'];
const MAX_DAYS = 21;

export default function Planner() {
  const { subjects, tasks, settings, apiKey, addSubject, addTasks } = useStore();
  const today = todayISO();

  const [goal, setGoal] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 6));
  const [hours, setHours] = useState(2);
  const [winStart, setWinStart] = useState('18:00');
  const [winEnd, setWinEnd] = useState('22:00');
  const [level, setLevel] = useState(LEVELS[1]);
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [planNote, setPlanNote] = useState('');

  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const addNew = () => {
    const name = newSubject.trim();
    if (!name) return;
    const s = addSubject(name);
    setPicked((p) => (p.includes(s.id) ? p : [...p, s.id]));
    setNewSubject('');
  };

  const span = daysBetween(start, end) + 1;
  const spanOk = span >= 1 && span <= MAX_DAYS;
  const windowOk = toMinutes(winEnd) - toMinutes(winStart) >= 30;
  const canGo = goal.trim().length > 2 && spanOk && windowOk;

  const generate = async () => {
    setError('');
    if (!apiKey) {
      setError('Chưa có API key Gemini. Vào tab Cài đặt để nhập key của bạn.');
      return;
    }
    setBusy(true);
    try {
      const existing = tasks
        .filter((t) => t.date >= start && t.date <= end)
        .map((t) => ({ date: t.date, start: t.start, duration: t.duration }));
      const items = await generatePlan({
        apiKey,
        model: settings.model,
        goal: goal.trim(),
        subjects: subjects.filter((s) => picked.includes(s.id)).map((s) => s.name),
        startDate: start,
        endDate: end,
        hoursPerDay: hours,
        windowStart: winStart,
        windowEnd: winEnd,
        level,
        notes: notes.trim(),
        existing,
        now: { date: today, time: nowHHmm() },
      });
      // Lưới an toàn: ép lịch của AI thoả khung giờ, không trùng, không quá số giờ/ngày.
      const { placed, dropped, moved } = placeItems(items, {
        startDate: start,
        endDate: end,
        windowStart: winStart,
        windowEnd: winEnd,
        maxMinutesPerDay: Math.round(hours * 60),
        existing,
        earliest: { date: today, minute: toMinutes(nowHHmm()) + 10 },
      });
      if (!placed.length) throw new GeminiError('Không xếp được buổi nào vào khung giờ bạn chọn. Thử mở rộng ngày hoặc giờ rảnh.');
      const changes: string[] = [];
      if (moved) changes.push(`đã tự chỉnh giờ ${moved} buổi cho khỏi trùng`);
      if (dropped.length) changes.push(`bỏ ${dropped.length} buổi vì không còn chỗ trống`);
      setPlanNote(changes.length ? `Lumo ${changes.join(', ')}.` : '');
      setPlan(placed);
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Có lỗi xảy ra, thử lại nhé.');
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!plan) return;
    const created = new Map<string, string>();
    const resolve = (name: string): string | null => {
      const key = name.trim().toLowerCase();
      if (!key) return null;
      const found = subjects.find((s) => s.name.toLowerCase() === key);
      if (found) return found.id;
      if (!created.has(key)) created.set(key, addSubject(name).id);
      return created.get(key)!;
    };
    addTasks(
      plan.map((p) => ({
        title: p.title,
        subjectId: resolve(p.subject),
        date: p.date,
        start: p.start,
        duration: p.duration,
        note: p.note || undefined,
        ai: true,
      })),
    );
    setPlan(null);
    setGoal('');
    router.navigate('/schedule');
  };

  if (plan) {
    const byDay = plan.reduce<Record<string, PlanItem[]>>((acc, p) => {
      (acc[p.date] ||= []).push(p);
      return acc;
    }, {});
    const totalMin = plan.reduce((s, p) => s + p.duration, 0);
    return (
      <Screen>
        <Title sub={`${plan.length} buổi · ${formatDuration(totalMin)} · ${Object.keys(byDay).length} ngày`}>
          Lịch gợi ý ✨
        </Title>
        {planNote ? <Text style={{ color: colors.warn, fontSize: 13 }}>{planNote}</Text> : null}
        {Object.entries(byDay).map(([date, items]) => (
          <Card key={date}>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>{formatLong(date)}</Text>
            {items.map((p, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{p.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {p.start}–{endTime(p.start, p.duration)} · {formatDuration(p.duration)}
                  {p.subject ? ` · ${p.subject}` : ''}
                </Text>
                {p.note ? <Text style={{ color: colors.muted, fontSize: 12 }}>{p.note}</Text> : null}
              </View>
            ))}
          </Card>
        ))}
        <Button label="Thêm tất cả vào lịch" icon="checkmark-circle" onPress={accept} />
        <Button label="Tạo lại" icon="refresh" variant="ghost" onPress={() => { setPlan(null); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub="Mô tả mục tiêu, Gemini sẽ chia thành các buổi học vừa sức.">Lập lịch bằng AI</Title>

      {!apiKey && (
        <Pressable onPress={() => router.navigate('/settings')}>
          <Card style={{ borderColor: colors.warn, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="key-outline" size={22} color={colors.warn} />
            <Text style={{ color: colors.text, flex: 1 }}>Nhập API key Gemini trong Cài đặt để bắt đầu.</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </Pressable>
      )}

      <Field
        label="Mục tiêu"
        value={goal}
        onChangeText={setGoal}
        multiline
        placeholder="VD: Thi giữa kỳ Giải tích 1 vào 20/11, cần ôn chương 1–4 và làm đề cũ"
      />

      <View style={{ gap: 8 }}>
        <SectionTitle>Môn / chủ đề</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {subjects.map((s) => (
            <Chip
              key={s.id}
              label={`${s.emoji} ${s.name}`}
              color={s.color}
              active={picked.includes(s.id)}
              onPress={() => togglePick(s.id)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder="Thêm môn mới…"
              onSubmitEditing={addNew}
              returnKeyType="done"
            />
          </View>
          <Button label="Thêm" variant="ghost" onPress={addNew} disabled={!newSubject.trim()} />
        </View>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stepper
            label="Từ ngày"
            value={formatShort(start)}
            onDec={() => setStart(addDays(start, -1) < today ? today : addDays(start, -1))}
            onInc={() => setStart(addDays(start, 1))}
          />
          <Stepper
            label="Đến ngày"
            value={formatShort(end)}
            onDec={() => setEnd(addDays(end, -1))}
            onInc={() => setEnd(addDays(end, 1))}
          />
        </View>
        {!spanOk && (
          <Text style={{ color: colors.danger, fontSize: 12 }}>
            Khoảng thời gian phải từ 1 đến {MAX_DAYS} ngày (đang là {span}).
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stepper
            label="Giờ học / ngày"
            value={`${hours} giờ`}
            onDec={() => setHours(Math.max(0.5, hours - 0.5))}
            onInc={() => setHours(Math.min(8, hours + 0.5))}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stepper
            label="Rảnh từ"
            value={winStart}
            onDec={() => setWinStart(fromMinutes(Math.max(0, toMinutes(winStart) - 30)))}
            onInc={() => setWinStart(fromMinutes(Math.min(1380, toMinutes(winStart) + 30)))}
          />
          <Stepper
            label="Đến"
            value={winEnd}
            onDec={() => setWinEnd(fromMinutes(Math.max(0, toMinutes(winEnd) - 30)))}
            onInc={() => setWinEnd(fromMinutes(Math.min(1410, toMinutes(winEnd) + 30)))}
          />
        </View>
        {!windowOk && <Text style={{ color: colors.danger, fontSize: 12 }}>Khung giờ rảnh cần ít nhất 30 phút.</Text>}
      </Card>

      <View style={{ gap: 8 }}>
        <SectionTitle>Trình độ hiện tại</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LEVELS.map((l) => (
            <Chip key={l} label={l} active={level === l} onPress={() => setLevel(l)} />
          ))}
        </View>
      </View>

      <Field
        label="Ghi chú (tuỳ chọn)"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="VD: Tránh chủ nhật, mình học tốt nhất vào buổi sáng…"
      />

      {error ? <ErrorBox message={error} /> : null}
      <Button label="Tạo lịch học" icon="sparkles" onPress={generate} loading={busy} disabled={!canGo} />
    </Screen>
  );
}

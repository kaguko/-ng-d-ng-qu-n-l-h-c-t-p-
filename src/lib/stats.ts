import { addDays } from './date';
import type { FocusLog, Task } from '../types';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type DayPoint = { date: string; minutes: number };

export function focusByDay(logs: FocusLog[], today: string, days: number): DayPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return { date, minutes: sum(logs.filter((l) => l.date === date).map((l) => l.minutes)) };
  });
}

/** Ma trận heatmap: cột = tuần (cũ -> mới), hàng = thứ (T2 -> CN). Ô ngoài khoảng là null. */
export function heatmap(logs: FocusLog[], today: string, weeks: number): (number | null)[][] {
  const [y, m, d] = today.split('-').map(Number);
  const mondayIndex = (new Date(y, m - 1, d).getDay() + 6) % 7; // T2 = 0
  const lastMonday = addDays(today, -mondayIndex);
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.minutes);

  return Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(lastMonday, (w - (weeks - 1)) * 7);
    return Array.from({ length: 7 }, (_, dow) => {
      const date = addDays(monday, dow);
      return date > today ? null : (byDate.get(date) ?? 0);
    });
  });
}

/** Ngày tương ứng từng ô của heatmap (cùng kích thước với kết quả của heatmap()). */
export function heatmapDates(today: string, weeks: number): string[][] {
  const [y, m, d] = today.split('-').map(Number);
  const mondayIndex = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const lastMonday = addDays(today, -mondayIndex);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, dow) => addDays(lastMonday, (w - (weeks - 1)) * 7 + dow)),
  );
}

export type Completion = { planned: number; done: number; rate: number | null };

/** Tỉ lệ hoàn thành các buổi học đã đến hạn trong `days` ngày gần nhất (tính cả hôm nay). */
export function completion(tasks: Task[], today: string, days: number): Completion {
  const from = addDays(today, -(days - 1));
  const due = tasks.filter((t) => t.date >= from && t.date <= today);
  const done = due.filter((t) => t.done).length;
  return { planned: due.length, done, rate: due.length ? done / due.length : null };
}

export function ratingByDay(logs: FocusLog[], today: string, days: number): { date: string; rating: number | null }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    const rated = logs.filter((l) => l.date === date && l.rating);
    return { date, rating: rated.length ? sum(rated.map((l) => l.rating!)) / rated.length : null };
  });
}

export function minutesBySubject(logs: FocusLog[], today: string, days: number): Map<string | null, number> {
  const from = addDays(today, -(days - 1));
  const out = new Map<string | null, number>();
  for (const l of logs) {
    if (l.date < from || l.date > today) continue;
    out.set(l.subjectId, (out.get(l.subjectId) ?? 0) + l.minutes);
  }
  return out;
}

export type QualityPart = { key: 'completion' | 'consistency' | 'goal' | 'rating'; label: string; value: number | null; weight: number };

export type Quality = {
  /** 0..100 */
  score: number;
  label: string;
  hasData: boolean;
  parts: QualityPart[];
};

const WEIGHTS = { completion: 0.4, consistency: 0.3, goal: 0.2, rating: 0.1 };

export function qualityLabel(score: number): string {
  if (score >= 80) return 'Xuất sắc';
  if (score >= 60) return 'Tốt';
  if (score >= 40) return 'Khá';
  return 'Cần cố gắng';
}

/**
 * Điểm chất lượng học 7 ngày gần nhất, gộp bốn thành phần:
 * hoàn thành (40%), đều đặn (30%), đạt mục tiêu phút/ngày (20%), tự đánh giá tập trung (10%).
 * Thành phần chưa có dữ liệu (null) bị bỏ qua và trọng số được chia lại cho phần còn lại.
 */
export function qualityScore(opts: { tasks: Task[]; logs: FocusLog[]; today: string; dailyGoalMin: number }): Quality {
  const { tasks, logs, today, dailyGoalMin } = opts;
  const from = addDays(today, -6);
  const days = focusByDay(logs, today, 7);
  const c = completion(tasks, today, 7);

  const activeDates = new Set<string>();
  days.forEach((d) => d.minutes > 0 && activeDates.add(d.date));
  tasks.forEach((t) => t.done && t.date >= from && t.date <= today && activeDates.add(t.date));

  const rated = logs.filter((l) => l.rating && l.date >= from && l.date <= today);
  const totalMin = sum(days.map((d) => d.minutes));

  const parts: QualityPart[] = [
    { key: 'completion', label: 'Hoàn thành', value: c.rate, weight: WEIGHTS.completion },
    { key: 'consistency', label: 'Đều đặn', value: activeDates.size / 7, weight: WEIGHTS.consistency },
    { key: 'goal', label: 'Đạt mục tiêu', value: dailyGoalMin > 0 ? Math.min(1, totalMin / 7 / dailyGoalMin) : null, weight: WEIGHTS.goal },
    {
      key: 'rating',
      label: 'Tập trung',
      value: rated.length ? sum(rated.map((l) => l.rating!)) / rated.length / 5 : null,
      weight: WEIGHTS.rating,
    },
  ];

  const hasData = totalMin > 0 || c.planned > 0 || activeDates.size > 0;
  const used = parts.filter((p) => p.value !== null);
  const wTotal = sum(used.map((p) => p.weight));
  const score = hasData && wTotal > 0 ? Math.round((sum(used.map((p) => p.value! * p.weight)) / wTotal) * 100) : 0;
  return { score, label: hasData ? qualityLabel(score) : 'Chưa có dữ liệu', hasData, parts };
}

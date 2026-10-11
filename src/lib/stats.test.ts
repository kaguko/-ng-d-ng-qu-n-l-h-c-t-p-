import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completion, focusByDay, heatmap, minutesBySubject, qualityScore, ratingByDay } from './stats';
import type { FocusLog, Task } from '../types';

// 2026-10-14 là thứ Tư
const today = '2026-10-14';
const log = (date: string, minutes: number, rating?: number, subjectId: string | null = null): FocusLog => ({
  id: date + minutes,
  date,
  minutes,
  subjectId,
  rating,
});
const task = (date: string, done: boolean): Task => ({
  id: date + done,
  title: 't',
  subjectId: null,
  date,
  start: '19:00',
  duration: 30,
  done,
});

test('focusByDay gộp phút theo ngày và đủ số ngày', () => {
  const out = focusByDay([log(today, 20), log(today, 25), log('2026-10-13', 10)], today, 3);
  assert.deepEqual(out.map((d) => d.minutes), [0, 10, 45]);
  assert.equal(out[2].date, today);
});

test('heatmap: thứ Hai đầu hàng, ngày tương lai là null', () => {
  const h = heatmap([log('2026-10-12', 60), log(today, 30)], today, 2);
  assert.equal(h.length, 2);
  assert.equal(h[1][0], 60); // T2 12/10
  assert.equal(h[1][2], 30); // T4 14/10 (hôm nay)
  assert.equal(h[1][3], null); // T5 chưa tới
  assert.equal(h[0][0], 0); // tuần trước, không có dữ liệu
});

test('completion chỉ tính buổi đã đến hạn', () => {
  const c = completion([task('2026-10-13', true), task('2026-10-14', false), task('2026-10-20', false)], today, 7);
  assert.deepEqual(c, { planned: 2, done: 1, rate: 0.5 });
  assert.equal(completion([], today, 7).rate, null);
});

test('ratingByDay trung bình theo ngày, null nếu không có', () => {
  const r = ratingByDay([log(today, 10, 4), log(today, 10, 2)], today, 2);
  assert.equal(r[1].rating, 3);
  assert.equal(r[0].rating, null);
});

test('minutesBySubject chỉ tính trong khoảng', () => {
  const m = minutesBySubject([log(today, 30, undefined, 'a'), log('2026-09-01', 99, undefined, 'a')], today, 7);
  assert.equal(m.get('a'), 30);
});

test('qualityScore: không dữ liệu', () => {
  const q = qualityScore({ tasks: [], logs: [], today, dailyGoalMin: 120 });
  assert.equal(q.hasData, false);
  assert.equal(q.score, 0);
});

test('qualityScore: học đủ mọi ngày, hoàn thành hết, đạt mục tiêu, 5 sao -> 100', () => {
  const logs = Array.from({ length: 7 }, (_, i) => log(`2026-10-${String(8 + i).padStart(2, '0')}`, 120, 5));
  const tasks = logs.map((l) => task(l.date, true));
  const q = qualityScore({ tasks, logs, today, dailyGoalMin: 120 });
  assert.equal(q.score, 100);
  assert.equal(q.label, 'Xuất sắc');
});

test('qualityScore: bỏ thành phần thiếu dữ liệu và chia lại trọng số', () => {
  // chỉ có 1 buổi hoàn thành hôm nay, không có log, không có rating
  const q = qualityScore({ tasks: [task(today, true)], logs: [], today, dailyGoalMin: 120 });
  const parts = Object.fromEntries(q.parts.map((p) => [p.key, p.value]));
  assert.equal(parts.rating, null);
  assert.equal(parts.completion, 1);
  // completion 1*0.4 + consistency 1/7*0.3 + goal 0*0.2, chia cho 0.9
  assert.equal(q.score, Math.round(((0.4 + 0.3 / 7) / 0.9) * 100));
});

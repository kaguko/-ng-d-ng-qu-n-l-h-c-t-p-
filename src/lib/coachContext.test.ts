import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCoachContext } from './coachContext';

const task = (id: string, date: string, start: string, done = false) => ({
  id,
  title: `Việc ${id}`,
  subjectId: null,
  date,
  start,
  duration: 45,
  done,
});

const base = { today: '2026-10-12', now: '20:00', subjects: [], dailyGoalMin: 120, streak: 3 };

test('liệt kê buổi bị lỡ và lịch sắp tới', () => {
  const out = buildCoachContext({
    ...base,
    tasks: [task('a', '2026-10-10', '19:00'), task('b', '2026-10-13', '19:00'), task('c', '2026-10-12', '18:00', true)],
    logs: [{ id: '1', date: '2026-10-12', minutes: 50, subjectId: null }],
  });
  assert.match(out, /Buổi học bị lỡ \(1\)/);
  assert.match(out, /Việc a/);
  assert.match(out, /Lịch 7 ngày tới \(2 buổi\)/);
  assert.match(out, /tổng 50 phút/);
  assert.match(out, /Chuỗi ngày học liên tiếp: 3/);
});

test('không có dữ liệu thì vẫn trả về văn bản hợp lệ', () => {
  const out = buildCoachContext({ ...base, tasks: [], logs: [] });
  assert.match(out, /không có/);
  assert.match(out, /chưa có buổi nào/);
});

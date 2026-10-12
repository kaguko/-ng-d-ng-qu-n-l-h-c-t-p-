import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAgenda, hourRange, layoutLanes, timeScale } from './agenda';
import type { Task } from '../types';

let n = 0;
const task = (start: string, duration: number, extra: Partial<Task> = {}): Task => ({
  id: `t${++n}`,
  title: `Buổi ${start}`,
  subjectId: null,
  date: '2026-10-12',
  start,
  duration,
  done: false,
  ...extra,
});

const kinds = (rows: ReturnType<typeof buildAgenda>) =>
  rows.map((r) => (r.kind === 'task' ? `task ${r.task.start}${r.overlap ? '!' : ''}${r.current ? '*' : ''}` : r.kind === 'period' ? `[${r.period} ${r.count}]` : r.kind === 'gap' ? `gap ${r.minutes}` : `now ${r.time}`));

test('agenda chia theo buổi, chèn khoảng trống dài và đánh dấu trùng giờ', () => {
  const rows = buildAgenda([task('19:00', 50), task('08:00', 45), task('19:30', 30), task('20:30', 30), task('13:00', 60)]);
  assert.deepEqual(kinds(rows), [
    '[morning 1]',
    'task 08:00',
    '[afternoon 1]',
    'task 13:00',
    '[evening 3]',
    'task 19:00!',
    'task 19:30!',
    'task 20:30',
  ]);
});

test('khoảng trống từ 60 phút trở lên trong cùng buổi được hiện', () => {
  const rows = buildAgenda([task('18:00', 30), task('20:00', 30)]);
  assert.deepEqual(kinds(rows), ['[evening 2]', 'task 18:00', 'gap 90', 'task 20:00']);
});

test('vạch "bây giờ" nằm đúng chỗ; buổi đang diễn ra được đánh dấu thay cho vạch', () => {
  const tasks = [task('08:00', 60), task('14:00', 60)];
  assert.deepEqual(kinds(buildAgenda(tasks, 10 * 60)), ['[morning 1]', 'task 08:00', 'now 10:00', '[afternoon 1]', 'task 14:00']);
  assert.deepEqual(kinds(buildAgenda(tasks, 8 * 60 + 30)), ['[morning 1]', 'task 08:00*', '[afternoon 1]', 'task 14:00']);
  assert.deepEqual(kinds(buildAgenda(tasks, 7 * 60)), ['now 07:00', '[morning 1]', 'task 08:00', '[afternoon 1]', 'task 14:00']);
  assert.deepEqual(kinds(buildAgenda(tasks, 23 * 60)), ['[morning 1]', 'task 08:00', '[afternoon 1]', 'task 14:00', 'now 23:00']);
  assert.deepEqual(buildAgenda([], 600), []);
});

test('vạch "bây giờ" trong khoảng trống đứng sau dòng Trống', () => {
  const rows = buildAgenda([task('18:00', 30), task('21:00', 30)], 19 * 60);
  assert.deepEqual(kinds(rows), ['[evening 2]', 'task 18:00', 'gap 150', 'now 19:00', 'task 21:00']);
});

test('layoutLanes: hai buổi trùng giờ đứng cạnh nhau', () => {
  const { placed, overflow } = layoutLanes([task('19:00', 60), task('19:30', 60), task('21:00', 30)]);
  assert.deepEqual(
    placed.map((p) => [p.task.start, p.lane, p.lanes]),
    [
      ['19:00', 0, 2],
      ['19:30', 1, 2],
      ['21:00', 0, 1],
    ],
  );
  assert.equal(overflow.length, 0);
});

test('layoutLanes: quá nhiều buổi trùng thì gom phần dư vào ô "+N"', () => {
  const { placed, overflow } = layoutLanes([task('19:00', 60), task('19:10', 60), task('19:20', 60), task('19:40', 30)], 2);
  assert.deepEqual(
    placed.map((p) => [p.task.start, p.lane, p.lanes]),
    [['19:00', 0, 2]],
  );
  assert.equal(overflow.length, 1);
  assert.equal(overflow[0].tasks.length, 3);
  assert.equal(overflow[0].lane, 1);
  assert.equal(overflow[0].start, 19 * 60 + 10);
});

test('hourRange ôm sát các buổi, tối thiểu 6 giờ', () => {
  assert.deepEqual(hourRange([]), { startH: 8, endH: 20 });
  assert.deepEqual(hourRange([task('19:00', 50), task('20:05', 50)]), { startH: 17, endH: 23 });
  assert.deepEqual(hourRange([task('08:00', 45), task('20:00', 60)]), { startH: 7, endH: 22 });
  assert.deepEqual(hourRange([task('23:00', 60)]), { startH: 18, endH: 24 });
});

test('timeScale gộp chuỗi giờ trống từ 2 giờ trở lên thành dải mỏng', () => {
  const sc = timeScale([task('08:00', 45), task('19:00', 50), task('20:05', 50)], 50, 20);
  assert.deepEqual(
    sc.segments.map((s) => [s.fromH, s.toH, s.collapsed]),
    [
      [7, 8, false],
      [8, 9, false],
      [9, 19, true],
      [19, 20, false],
      [20, 21, false],
      [21, 22, false],
    ],
  );
  assert.equal(sc.height, 5 * 50 + 20);
  assert.equal(sc.yOf(8 * 60), 50);
  assert.equal(sc.yOf(19 * 60), 120);
  assert.equal(sc.yOf(19 * 60 + 30), 145);
  // chạm vào dải gộp -> đầu dải; chạm vào giờ thường -> đúng phút
  assert.equal(sc.minOf(110), 9 * 60);
  assert.equal(sc.minOf(145), 19 * 60 + 30);
});

test('timeScale không gộp khi tuần trống hoặc chỉ trống một giờ', () => {
  assert.ok(timeScale([], 50, 20).segments.every((s) => !s.collapsed));
  const sc = timeScale([task('18:00', 60), task('20:00', 60)], 50, 20);
  assert.ok(sc.segments.every((s) => !s.collapsed));
});

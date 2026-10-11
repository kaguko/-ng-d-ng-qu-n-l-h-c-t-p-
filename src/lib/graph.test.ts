import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isUnlocked, layoutGraph, sanitizeTopics, topicProgress } from './graph';
import type { Task, Topic } from '../types';

const topic = (id: string, requires: string[] = []): Topic => ({ id, name: id.toUpperCase(), subjectId: null, requires });
const task = (id: string, topicId: string, done: boolean): Task => ({
  id,
  title: id,
  subjectId: null,
  date: '2026-10-12',
  start: '19:00',
  duration: 30,
  done,
  topicId,
});

test('bỏ cạnh tạo chu trình, trỏ vào chính nó hoặc không tồn tại', () => {
  const out = sanitizeTopics([topic('a', ['b', 'a', 'zzz']), topic('b', ['a'])]);
  assert.deepEqual(out.find((t) => t.id === 'a')!.requires, ['b']);
  // cạnh a -> b (b cần a) bị bỏ vì sẽ tạo vòng
  assert.deepEqual(out.find((t) => t.id === 'b')!.requires, []);
});

test('xếp tầng: chủ đề tiên quyết nằm trên', () => {
  const g = layoutGraph([topic('c', ['a', 'b']), topic('a'), topic('b', ['a'])]);
  const layer = Object.fromEntries(g.nodes.map((n) => [n.topic.id, n.layer]));
  assert.deepEqual(layer, { a: 0, b: 1, c: 2 });
  assert.equal(g.edges.length, 3);
  const y = Object.fromEntries(g.nodes.map((n) => [n.topic.id, n.y]));
  assert.ok(y.a < y.b && y.b < y.c);
});

test('các nút cùng tầng không chồng lên nhau và nằm trong khung', () => {
  const g = layoutGraph([topic('r'), topic('x', ['r']), topic('y', ['r']), topic('z', ['r'])]);
  const row = g.nodes.filter((n) => n.layer === 1).sort((p, q) => p.x - q.x);
  assert.equal(row.length, 3);
  for (let i = 1; i < row.length; i++) assert.ok(row[i].x >= row[i - 1].x + 140);
  assert.ok(row[0].x >= 0 && row[2].x + 140 <= g.width);
});

test('đồ thị rỗng không lỗi', () => {
  const g = layoutGraph([], 300);
  assert.equal(g.nodes.length, 0);
  assert.equal(g.width, 300);
});

test('tiến độ chủ đề và trạng thái', () => {
  const tasks = [task('1', 'a', true), task('2', 'a', false), task('3', 'b', true)];
  assert.equal(topicProgress('a', tasks).status, 'learning');
  assert.equal(topicProgress('a', tasks).pct, 0.5);
  assert.equal(topicProgress('b', tasks).status, 'mastered');
  assert.equal(topicProgress('c', tasks).status, 'new');
});

test('mở khoá khi mọi tiên quyết đã nắm', () => {
  const all = [topic('a'), topic('b', ['a'])];
  assert.equal(isUnlocked(all[1], all, [task('1', 'a', false)]), false);
  assert.equal(isUnlocked(all[1], all, [task('1', 'a', true)]), true);
});

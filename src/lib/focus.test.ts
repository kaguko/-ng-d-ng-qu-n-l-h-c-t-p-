import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedMinutes, isFinished, mmss, remainingMs } from './focus';
import type { FocusSession } from '../types';

const base: FocusSession = { minutes: 25, endAt: null, remainingMs: 25 * 60000, startedAt: 0, subjectId: null };

test('phiên đang chạy tính thời gian còn lại theo mốc kết thúc', () => {
  const f = { ...base, endAt: 10 * 60000 };
  assert.equal(remainingMs(f, 4 * 60000), 6 * 60000);
  assert.equal(remainingMs(f, 99 * 60000), 0);
  assert.equal(isFinished(f, 10 * 60000), true);
  assert.equal(isFinished(f, 9 * 60000), false);
});

test('mốc hiện tại cũ hơn lúc bắt đầu không làm thời gian còn lại vượt độ dài phiên', () => {
  const f = { ...base, endAt: 1000 + 25 * 60000, startedAt: 1000 };
  assert.equal(remainingMs(f, 0), 25 * 60000);
});

test('phiên tạm dừng giữ nguyên thời gian còn lại và không bao giờ "xong"', () => {
  const f = { ...base, remainingMs: 7 * 60000 };
  assert.equal(remainingMs(f, 1e12), 7 * 60000);
  assert.equal(elapsedMinutes(f, 1e12), 18);
  assert.equal(isFinished(f, 1e12), false);
});

test('mmss làm tròn lên theo giây', () => {
  assert.equal(mmss(25 * 60000), '25:00');
  assert.equal(mmss(1), '00:01');
  assert.equal(mmss(-5), '00:00');
});

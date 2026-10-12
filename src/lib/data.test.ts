import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_DATA, exportBackup, parseBackup, sanitizeData } from './data';

const PALETTE = ['#111111', '#222222'];

test('sanitizeData giữ dữ liệu hợp lệ và bỏ bản ghi hỏng', () => {
  const d = sanitizeData(
    {
      subjects: [{ id: 's1', name: 'Toán', color: '#ABCDEF', emoji: '🧮' }, { id: 's1', name: 'Trùng' }, { name: 'Thiếu id' }],
      tasks: [
        { id: 't1', title: 'Ôn', subjectId: 's1', date: '2026-10-12', start: '19:00', duration: 45, done: true, topicId: 'x' },
        { id: 't2', title: 'Sai ngày', date: '12/10', start: '19:00', duration: 45 },
        { id: 't3', title: 'Môn treo', subjectId: 'ghost', date: '2026-10-12', start: '07:00', duration: 9999 },
      ],
      logs: [
        { id: 'l1', date: '2026-10-12', minutes: 25, subjectId: 's1', rating: 9, taskId: 't2' },
        { id: 'l2', date: '2026-10-12', minutes: 0 },
      ],
      settings: { dailyGoalMin: 5, reminders: 'yes' },
    },
    PALETTE,
  );
  assert.deepEqual(d.subjects, [{ id: 's1', name: 'Toán', color: '#111111', emoji: '🧮' }]);
  assert.deepEqual(d.tasks.map((t) => t.id), ['t1', 't3']);
  assert.equal(d.tasks[0].topicId, undefined);
  assert.equal(d.tasks[1].subjectId, null);
  assert.equal(d.tasks[1].duration, 600);
  assert.equal(d.logs.length, 1);
  assert.equal(d.logs[0].rating, 5);
  assert.equal(d.logs[0].taskId, undefined);
  assert.equal(d.settings.dailyGoalMin, 15);
  assert.equal(d.settings.reminders, false);
});

test('sanitizeData với rác trả về dữ liệu rỗng', () => {
  assert.deepEqual(sanitizeData(null), EMPTY_DATA);
  assert.deepEqual(sanitizeData('abc'), EMPTY_DATA);
});

test('sanitizeData giữ phiên tập trung và gỡ liên kết buổi học không tồn tại', () => {
  const d = sanitizeData({ focus: { minutes: 25, remainingMs: 99999999, endAt: null, startedAt: 1, subjectId: null, taskId: 'nope' } });
  assert.ok(d.focus);
  assert.equal(d.focus.remainingMs, 25 * 60000);
  assert.equal(d.focus.taskId, undefined);
});

test('sao lưu rồi khôi phục cho lại đúng dữ liệu, bỏ phiên tập trung', () => {
  const data = sanitizeData(
    {
      subjects: [{ id: 's1', name: 'Lý', color: '#111111', emoji: '🧪' }],
      topics: [{ id: 'a', name: 'Động học', subjectId: 's1', requires: [] }],
      tasks: [{ id: 't1', title: 'Bài 1', subjectId: 's1', date: '2026-10-12', start: '08:00', duration: 30, done: false, topicId: 'a' }],
      focus: { minutes: 25, remainingMs: 1000, endAt: null, startedAt: 1, subjectId: null },
    },
    PALETTE,
  );
  const res = parseBackup(exportBackup(data), PALETTE);
  assert.ok(res.ok);
  assert.deepEqual(res.data, { ...data, focus: null });
});

test('exportBackup không bao giờ chứa API key dù nhận cả store', () => {
  const store = { ...EMPTY_DATA, apiKey: 'AIzaSECRET', setApiKey: () => {} };
  assert.ok(!exportBackup(store).includes('AIzaSECRET'));
});

test('parseBackup từ chối nội dung không phải sao lưu Lumo', () => {
  assert.equal(parseBackup('xin chào').ok, false);
  assert.equal(parseBackup('{"tasks":[]}').ok, false);
  assert.equal(parseBackup('{"app":"lumo","version":99}').ok, false);
  assert.equal(parseBackup('{"app":"lumo","version":1}').ok, false);
});

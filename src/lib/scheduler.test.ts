import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeItems, PlaceOptions } from './scheduler';

const base: PlaceOptions = {
  startDate: '2026-10-12',
  endDate: '2026-10-14',
  windowStart: '18:00',
  windowEnd: '22:00',
  maxMinutesPerDay: 180,
  existing: [],
};
const item = (date: string, start: string, duration: number) => ({ date, start, duration });

test('giữ nguyên lịch đã hợp lệ', () => {
  const r = placeItems([item('2026-10-12', '18:00', 60), item('2026-10-12', '19:10', 60)], base);
  assert.equal(r.moved, 0);
  assert.equal(r.dropped.length, 0);
  assert.deepEqual(r.placed.map((p) => p.start), ['18:00', '19:10']);
});

test('đẩy buổi trùng nhau ra sau và chừa 10 phút nghỉ', () => {
  const r = placeItems([item('2026-10-12', '18:00', 60), item('2026-10-12', '18:30', 45)], base);
  assert.deepEqual(r.placed.map((p) => p.start), ['18:00', '19:10']);
  assert.equal(r.moved, 1);
});

test('không xếp đè lên giờ đã bận', () => {
  const r = placeItems([item('2026-10-12', '18:00', 60)], {
    ...base,
    existing: [item('2026-10-12', '18:00', 90)],
  });
  assert.equal(r.placed[0].start, '19:40');
});

test('kéo buổi nằm ngoài khung giờ về trong khung', () => {
  const r = placeItems([item('2026-10-12', '06:00', 45)], base);
  assert.equal(r.placed[0].start, '18:00');
});

test('vượt giờ học mỗi ngày thì dời sang ngày sau', () => {
  const r = placeItems(
    [item('2026-10-12', '18:00', 90), item('2026-10-12', '20:00', 90), item('2026-10-12', '21:00', 60)],
    { ...base, maxMinutesPerDay: 180 },
  );
  assert.deepEqual(r.placed.map((p) => p.date), ['2026-10-12', '2026-10-12', '2026-10-13']);
});

test('hết chỗ trong khoảng ngày thì loại bỏ', () => {
  const r = placeItems(
    [item('2026-10-14', '18:00', 120), item('2026-10-14', '20:00', 120)],
    { ...base, startDate: '2026-10-14', endDate: '2026-10-14', maxMinutesPerDay: 240 },
  );
  assert.equal(r.placed.length, 1);
  assert.equal(r.dropped.length, 1);
});

test('không xếp trước mốc earliest của hôm nay', () => {
  const r = placeItems([item('2026-10-12', '08:00', 30)], {
    ...base,
    windowStart: '06:00',
    windowEnd: '22:30',
    earliest: { date: '2026-10-12', minute: 20 * 60 },
  });
  assert.equal(r.placed[0].date, '2026-10-12');
  assert.equal(r.placed[0].start, '20:00');
});

test('buổi quá dài so với khung giờ bị loại', () => {
  const r = placeItems([item('2026-10-12', '18:00', 300)], { ...base, maxMinutesPerDay: 600 });
  assert.equal(r.dropped.length, 1);
});

import { addDays, daysBetween, fromMinutes, toMinutes } from './date';

export type Placeable = { date: string; start: string; duration: number };

export type PlaceOptions = {
  startDate: string;
  endDate: string;
  /** khung giờ cho phép, "HH:mm" */
  windowStart: string;
  windowEnd: string;
  /** tổng phút học tối đa mỗi ngày (tính cả buổi đã có) */
  maxMinutesPerDay: number;
  /** các khoảng đã bận, không được xếp trùng */
  existing: Placeable[];
  /** nghỉ tối thiểu giữa hai buổi liền kề (phút) */
  gap?: number;
  /** không xếp trước mốc này (dùng khi xếp lại trong ngày hôm nay) */
  earliest?: { date: string; minute: number };
};

export type PlaceResult<T> = {
  placed: T[];
  dropped: T[];
  /** số buổi bị dời khỏi vị trí gốc */
  moved: number;
};

type Interval = { s: number; e: number };

/**
 * Lưới an toàn sau khi AI trả lịch: giữ thứ tự và ý đồ của AI nhưng ép lịch
 * thoả khung giờ, không trùng giờ, nghỉ giữa buổi và không vượt số giờ mỗi ngày.
 * Buổi không xếp được ở ngày gốc sẽ được dời sang các ngày sau; hết chỗ thì bị loại.
 */
export function placeItems<T extends Placeable>(items: T[], opts: PlaceOptions): PlaceResult<T> {
  const gap = opts.gap ?? 10;
  const winS = toMinutes(opts.windowStart);
  const winE = toMinutes(opts.windowEnd);

  const busy = new Map<string, Interval[]>();
  const used = new Map<string, number>();
  const push = (date: string, iv: Interval, minutes: number) => {
    (busy.get(date) ?? busy.set(date, []).get(date)!).push(iv);
    used.set(date, (used.get(date) ?? 0) + minutes);
  };
  for (const e of opts.existing) {
    const s = toMinutes(e.start);
    push(e.date, { s, e: s + e.duration }, e.duration);
  }

  const fit = (date: string, from: number, duration: number): number | null => {
    if ((used.get(date) ?? 0) + duration > opts.maxMinutesPerDay) return null;
    let min = winS;
    if (opts.earliest && date === opts.earliest.date) min = Math.max(min, opts.earliest.minute);
    let cand = Math.max(from, min);
    const list = (busy.get(date) ?? []).slice().sort((a, b) => a.s - b.s);
    for (let guard = 0; guard <= list.length + 1; guard++) {
      if (cand + duration > winE) return null;
      const hit = list.find((b) => cand < b.e + gap && cand + duration > b.s - gap);
      if (!hit) return cand;
      cand = hit.e + gap;
    }
    return null;
  };

  const sorted = items.slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const placed: T[] = [];
  const dropped: T[] = [];
  let moved = 0;

  for (const item of sorted) {
    const span = daysBetween(opts.startDate, opts.endDate);
    const first = Math.max(0, daysBetween(opts.startDate, item.date));
    let result: { date: string; minute: number } | null = null;

    for (let off = first; off <= span && !result; off++) {
      const date = addDays(opts.startDate, off);
      // ngày gốc: thử đúng giờ AI chọn trước, rồi mới thử từ đầu khung giờ
      const tries = off === first ? [toMinutes(item.start), winS] : [winS];
      for (const from of tries) {
        const m = fit(date, from, item.duration);
        if (m !== null) {
          result = { date, minute: m };
          break;
        }
      }
    }

    if (!result) {
      dropped.push(item);
      continue;
    }
    push(result.date, { s: result.minute, e: result.minute + item.duration }, item.duration);
    const start = fromMinutes(result.minute);
    if (result.date !== item.date || start !== item.start) moved++;
    placed.push({ ...item, date: result.date, start });
  }

  placed.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { placed, dropped, moved };
}

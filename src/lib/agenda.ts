import { fromMinutes, toMinutes } from './date';
import type { Task } from '../types';

export type Period = 'morning' | 'afternoon' | 'evening';

export const PERIOD_LABEL: Record<Period, string> = { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' };

export function periodOf(start: string): Period {
  const m = toMinutes(start);
  if (m < 12 * 60) return 'morning';
  if (m < 18 * 60) return 'afternoon';
  return 'evening';
}

export type AgendaRow =
  | { kind: 'period'; period: Period; count: number; minutes: number }
  | { kind: 'task'; task: Task; overlap: boolean; current: boolean }
  | { kind: 'gap'; minutes: number; from: string }
  | { kind: 'now'; time: string };

/** khoảng trống tối thiểu (phút) mới hiển thị thành một dòng "Trống" */
export const GAP_MIN = 60;

/**
 * Dòng thời gian một ngày: chia theo buổi Sáng/Chiều/Tối, chèn khoảng trống dài,
 * vạch "bây giờ" (chỉ khi `nowMin` có giá trị, tức là hôm nay) và đánh dấu buổi trùng giờ.
 */
export function buildAgenda(dayTasks: Task[], nowMin?: number): AgendaRow[] {
  const sorted = [...dayTasks].sort((a, b) => a.start.localeCompare(b.start) || a.duration - b.duration);
  const rows: AgendaRow[] = [];
  let period: Period | null = null;
  let lastEnd = -1;
  let nowPlaced = nowMin === undefined;

  const placeNow = (beforeMin: number) => {
    if (nowPlaced || nowMin! > beforeMin) return;
    rows.push({ kind: 'now', time: fromMinutes(nowMin!) });
    nowPlaced = true;
  };

  for (const t of sorted) {
    const s = toMinutes(t.start);
    const e = s + t.duration;
    const p = periodOf(t.start);
    if (p !== period) {
      // vạch "bây giờ" nằm trước tiêu đề buổi nếu nó rơi vào khoảng giữa hai buổi
      placeNow(s);
      const same = sorted.filter((x) => periodOf(x.start) === p);
      rows.push({ kind: 'period', period: p, count: same.length, minutes: same.reduce((n, x) => n + x.duration, 0) });
      period = p;
    } else if (lastEnd >= 0 && s - lastEnd >= GAP_MIN) {
      // "bây giờ" rơi vào khoảng trống thì đứng sau dòng "Trống"
      rows.push({ kind: 'gap', minutes: s - lastEnd, from: fromMinutes(lastEnd) });
    }
    placeNow(s);
    const current = nowMin !== undefined && nowMin >= s && nowMin < e;
    if (current) nowPlaced = true;
    // trùng giờ với bất kỳ buổi nào khác trong ngày (cả buổi bắt đầu trước)
    const overlap = sorted.some((o) => o !== t && toMinutes(o.start) < e && s < toMinutes(o.start) + o.duration);
    rows.push({ kind: 'task', task: t, overlap, current });
    lastEnd = Math.max(lastEnd, e);
  }
  if (!nowPlaced && sorted.length) rows.push({ kind: 'now', time: fromMinutes(nowMin!) });
  return rows;
}

export type Placed = { task: Task; lane: number; lanes: number };
export type Overflow = { start: number; end: number; lane: number; lanes: number; tasks: Task[] };

/**
 * Chia các buổi trùng giờ trong một ngày thành làn đứng cạnh nhau. Tối đa `maxLanes` làn hiển thị;
 * buổi không còn làn được gom vào một ô "+N" chiếm làn cuối của cụm.
 */
export function layoutLanes(tasks: Task[], maxLanes = 2): { placed: Placed[]; overflow: Overflow[] } {
  const sorted = [...tasks].sort((a, b) => a.start.localeCompare(b.start) || b.duration - a.duration);
  const placed: Placed[] = [];
  const overflow: Overflow[] = [];
  let cluster: { task: Task; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const tooMany = laneEnds.length > maxLanes;
    // còn chỗ cho maxLanes-1 làn thật + 1 làn "+N"
    const visible = tooMany ? maxLanes - 1 : laneEnds.length;
    const lanes = tooMany ? maxLanes : laneEnds.length;
    const hidden: Task[] = [];
    for (const c of cluster) {
      if (c.lane < visible) placed.push({ task: c.task, lane: c.lane, lanes });
      else hidden.push(c.task);
    }
    if (hidden.length) {
      const start = Math.min(...hidden.map((t) => toMinutes(t.start)));
      const end = Math.max(...hidden.map((t) => toMinutes(t.start) + t.duration));
      overflow.push({ start, end, lane: visible, lanes, tasks: hidden });
    }
    cluster = [];
    laneEnds = [];
  };

  for (const t of sorted) {
    const s = toMinutes(t.start);
    const e = s + t.duration;
    if (s >= clusterEnd) {
      flush();
      clusterEnd = e;
    } else clusterEnd = Math.max(clusterEnd, e);
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = e;
    cluster.push({ task: t, lane });
  }
  flush();
  return { placed, overflow };
}

export type Segment = { fromH: number; toH: number; collapsed: boolean; top: number; height: number };
export type TimeScale = {
  segments: Segment[];
  height: number;
  /** phút trong ngày -> toạ độ y */
  yOf: (min: number) => number;
  /** toạ độ y -> phút trong ngày (dải gộp trả về đầu dải) */
  minOf: (y: number) => number;
};

/**
 * Thước thời gian cho lưới tuần: giờ có buổi học hiển thị đủ cao, còn từ 2 giờ trống liên tiếp
 * trở lên (không buổi nào trong tuần chạm tới) bị gộp thành một dải mỏng.
 */
export function timeScale(tasks: Task[], hourH: number, collapsedH: number): TimeScale {
  const { startH, endH } = hourRange(tasks);
  const busy = new Set<number>();
  for (const t of tasks) {
    const s = toMinutes(t.start);
    const e = s + t.duration;
    for (let h = Math.floor(s / 60); h < Math.ceil(e / 60); h++) busy.add(h);
  }

  const segments: Segment[] = [];
  let top = 0;
  const push = (fromH: number, toH: number, collapsed: boolean) => {
    const height = collapsed ? collapsedH : hourH * (toH - fromH);
    segments.push({ fromH, toH, collapsed, top, height });
    top += height;
  };
  for (let h = startH; h < endH; ) {
    if (busy.size && !busy.has(h)) {
      let run = h;
      while (run < endH && !busy.has(run)) run++;
      // chỉ gộp khoảng trống nằm giữa các buổi; phần đệm ở mép khung giữ nguyên
      if (run - h >= 2 && h > startH && run < endH) {
        push(h, run, true);
        h = run;
        continue;
      }
    }
    push(h, h + 1, false);
    h++;
  }

  const yOf = (min: number) => {
    const hh = min / 60;
    if (hh <= startH) return 0;
    for (const s of segments) {
      if (hh < s.toH) return s.top + ((hh - s.fromH) / (s.toH - s.fromH)) * s.height;
    }
    return top;
  };
  const minOf = (y: number) => {
    for (const s of segments) {
      if (y < s.top + s.height) {
        return s.collapsed ? s.fromH * 60 : Math.round((s.fromH + (y - s.top) / s.height) * 60);
      }
    }
    return endH * 60;
  };
  return { segments, height: top, yOf, minOf };
}

/** Khung giờ hiển thị của lưới tuần: ôm sát các buổi (cộng lề 1 giờ), tối thiểu 6 giờ; tuần trống thì 8–20h. */
export function hourRange(tasks: Task[]): { startH: number; endH: number } {
  if (!tasks.length) return { startH: 8, endH: 20 };
  let startH = Math.min(...tasks.map((t) => Math.floor(toMinutes(t.start) / 60))) - 1;
  let endH = Math.max(...tasks.map((t) => Math.ceil((toMinutes(t.start) + t.duration) / 60))) + 1;
  startH = Math.max(0, startH);
  endH = Math.min(24, endH);
  while (endH - startH < 6) {
    if (endH < 24) endH++;
    if (endH - startH < 6 && startH > 0) startH--;
  }
  return { startH, endH };
}

import type { FocusSession } from '../types';

/** Thời gian còn lại (ms), tính theo mốc thời gian nên vẫn đúng khi app ở nền hoặc bị tắt. */
export function remainingMs(f: FocusSession, now: number): number {
  // kẹp trên: mốc `now` có thể cũ hơn lúc bắt đầu một chút (nhịp đồng hồ chưa kịp chạy)
  return f.endAt !== null ? Math.min(f.minutes * 60000, Math.max(0, f.endAt - now)) : f.remainingMs;
}

/** Số phút trọn vẹn đã tập trung. */
export function elapsedMinutes(f: FocusSession, now: number): number {
  return Math.max(0, Math.floor((f.minutes * 60000 - remainingMs(f, now)) / 60000));
}

export function isFinished(f: FocusSession, now: number): boolean {
  return f.endAt !== null && f.endAt <= now;
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

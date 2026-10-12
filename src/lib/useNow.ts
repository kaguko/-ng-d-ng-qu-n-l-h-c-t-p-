import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { nowHHmm, todayISO } from './date';

/**
 * Ngày và giờ hiện tại, tự cập nhật mỗi khi sang phút mới và khi app quay lại từ nền,
 * để "hôm nay", buổi bị lỡ và vạch giờ hiện tại không bị đứng yên.
 */
export function useNow(): { today: string; now: string } {
  const [state, setState] = useState(() => ({ today: todayISO(), now: nowHHmm() }));

  useEffect(() => {
    const refresh = () =>
      setState((s) => {
        const next = { today: todayISO(), now: nowHHmm() };
        return next.today === s.today && next.now === s.now ? s : next;
      });
    let interval: ReturnType<typeof setInterval> | undefined;
    // canh đúng đầu phút rồi mới chạy nhịp 60 giây
    const align = setTimeout(() => {
      refresh();
      interval = setInterval(refresh, 60000);
    }, 60000 - (Date.now() % 60000) + 50);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
      sub.remove();
    };
  }, []);

  return state;
}

/** Mốc thời gian (ms) cập nhật mỗi `everyMs` khi `active`, dùng cho đồng hồ đếm ngược. */
export function useTicker(active: boolean, everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs]);
  return now;
}

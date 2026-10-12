import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Data, EMPTY_DATA, sanitizeData } from '@/lib/data';
import { addDays, toISO, todayISO } from '@/lib/date';
import { elapsedMinutes, isFinished, remainingMs } from '@/lib/focus';
import { loadApiKey, saveApiKey } from '@/lib/secure';
import { subjectEmojis, subjectPalette } from '@/theme';
import { sanitizeTopics } from '@/lib/graph';
import { FocusResult, Settings, Subject, Task, Topic } from '@/types';

const DATA_KEY = 'lumo.data.v1';


export type PlanInput = {
  tasks: (Omit<Task, 'id' | 'done' | 'topicId'> & { topicName?: string })[];
  topics: { name: string; subjectId: string | null; requires: string[] }[];
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

type Store = Data & {
  ready: boolean;
  apiKey: string;
  addTask: (t: Omit<Task, 'id' | 'done'> & { done?: boolean }) => void;
  addTasks: (t: Omit<Task, 'id' | 'done'>[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  updateTasks: (patches: { id: string; patch: Partial<Task> }[]) => void;
  toggleTask: (id: string) => void;
  /** xoá và trả về buổi học đã xoá để có thể hoàn tác */
  deleteTask: (id: string) => Task | undefined;
  restoreTask: (task: Task) => void;
  addSubject: (name: string) => Subject;
  deleteSubject: (id: string) => void;
  addPlan: (plan: PlanInput) => void;
  addTopic: (name: string, subjectId: string | null, requires: string[]) => void;
  updateTopic: (id: string, patch: Partial<Omit<Topic, 'id'>>) => void;
  deleteTopic: (id: string) => void;
  startFocus: (opts: { minutes: number; subjectId: string | null; taskId?: string }) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  /** kết thúc sớm và lưu số phút đã tập trung */
  stopFocus: () => void;
  /** huỷ phiên mà không ghi nhật ký */
  discardFocus: () => void;
  focusResult: FocusResult | null;
  clearFocusResult: () => void;
  setLogRating: (id: string, rating: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setApiKey: (key: string) => Promise<void>;
  resetData: () => void;
  replaceData: (data: Data) => void;
  subjectOf: (id: string | null) => Subject | undefined;
  streak: number;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY_DATA);
  const [focusResult, setFocusResult] = useState<FocusResult | null>(null);
  const dataRef = useRef(data);
  useLayoutEffect(() => {
    dataRef.current = data;
  }, [data]);
  const [apiKey, setKey] = useState('');
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DATA_KEY);
        if (raw) setData(sanitizeData(JSON.parse(raw), subjectPalette));
      } catch {
        // dữ liệu hỏng -> bắt đầu mới
      }
      setKey(await loadApiKey());
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(data)).catch(() => {});
  }, [data]);

  const addTasks = useCallback((items: Omit<Task, 'id' | 'done'>[]) => {
    setData((d) => ({ ...d, tasks: [...d.tasks, ...items.map((t) => ({ ...t, id: uid(), done: false }))] }));
  }, []);

  const addTask = useCallback<Store['addTask']>((t) => {
    setData((d) => ({ ...d, tasks: [...d.tasks, { done: false, ...t, id: uid() }] }));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const updateTasks = useCallback((patches: { id: string; patch: Partial<Task> }[]) => {
    const map = new Map(patches.map((p) => [p.id, p.patch]));
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (map.has(t.id) ? { ...t, ...map.get(t.id) } : t)) }));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    const removed = dataRef.current.tasks.find((t) => t.id === id);
    setData((d) => ({
      ...d,
      tasks: d.tasks.filter((t) => t.id !== id),
      focus: d.focus?.taskId === id ? { ...d.focus, taskId: undefined } : d.focus,
    }));
    return removed;
  }, []);

  const restoreTask = useCallback((task: Task) => {
    setData((d) => (d.tasks.some((t) => t.id === task.id) ? d : { ...d, tasks: [...d.tasks, task] }));
  }, []);

  const addSubject = useCallback(
    (name: string) => {
      const existing = data.subjects.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
      if (existing) return existing;
      const i = data.subjects.length;
      const subject: Subject = {
        id: uid(),
        name: name.trim(),
        color: subjectPalette[i % subjectPalette.length],
        emoji: subjectEmojis[i % subjectEmojis.length],
      };
      setData((d) => ({ ...d, subjects: [...d.subjects, subject] }));
      return subject;
    },
    [data.subjects],
  );

  const deleteSubject = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      subjects: d.subjects.filter((s) => s.id !== id),
      tasks: d.tasks.map((t) => (t.subjectId === id ? { ...t, subjectId: null } : t)),
      topics: d.topics.map((t) => (t.subjectId === id ? { ...t, subjectId: null } : t)),
      logs: d.logs.map((l) => (l.subjectId === id ? { ...l, subjectId: null } : l)),
    }));
  }, []);

  const addPlan = useCallback((plan: PlanInput) => {
    setData((d) => {
      const topics = d.topics.map((t) => ({ ...t }));
      const key = (n: string) => n.trim().toLowerCase();
      const idOf = new Map(topics.map((t) => [key(t.name), t.id]));

      // tạo chủ đề mới trước (để cạnh có thể trỏ tới nhau theo tên), rồi nối liên kết
      for (const t of plan.topics) {
        if (!t.name.trim() || idOf.has(key(t.name))) continue;
        const id = uid();
        idOf.set(key(t.name), id);
        topics.push({ id, name: t.name.trim(), subjectId: t.subjectId, requires: [] });
      }
      for (const t of plan.topics) {
        const topic = topics.find((x) => x.id === idOf.get(key(t.name)));
        if (!topic) continue;
        for (const r of t.requires) {
          const rid = idOf.get(key(r));
          if (rid && !topic.requires.includes(rid)) topic.requires.push(rid);
        }
      }

      const tasks = plan.tasks.map(({ topicName, ...rest }) => ({
        ...rest,
        id: uid(),
        done: false,
        topicId: topicName ? idOf.get(key(topicName)) : undefined,
      }));
      return { ...d, topics: sanitizeTopics(topics), tasks: [...d.tasks, ...tasks] };
    });
  }, []);

  const addTopic = useCallback((name: string, subjectId: string | null, requires: string[]) => {
    const clean = name.trim();
    if (!clean) return;
    setData((d) => {
      if (d.topics.some((t) => t.name.toLowerCase() === clean.toLowerCase())) return d;
      return { ...d, topics: sanitizeTopics([...d.topics, { id: uid(), name: clean, subjectId, requires }]) };
    });
  }, []);

  const updateTopic = useCallback((id: string, patch: Partial<Omit<Topic, 'id'>>) => {
    setData((d) => ({ ...d, topics: sanitizeTopics(d.topics.map((t) => (t.id === id ? { ...t, ...patch } : t))) }));
  }, []);

  const deleteTopic = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      topics: d.topics.filter((t) => t.id !== id).map((t) => ({ ...t, requires: t.requires.filter((r) => r !== id) })),
      tasks: d.tasks.map((t) => (t.topicId === id ? { ...t, topicId: undefined } : t)),
    }));
  }, []);

  const startFocus = useCallback<Store['startFocus']>(({ minutes, subjectId, taskId }) => {
    const now = Date.now();
    const ms = minutes * 60000;
    setFocusResult(null);
    setData((d) => ({ ...d, focus: { minutes, subjectId, taskId, startedAt: now, endAt: now + ms, remainingMs: ms } }));
  }, []);

  const pauseFocus = useCallback(() => {
    setData((d) =>
      d.focus && d.focus.endAt !== null
        ? { ...d, focus: { ...d.focus, remainingMs: remainingMs(d.focus, Date.now()), endAt: null } }
        : d,
    );
  }, []);

  const resumeFocus = useCallback(() => {
    setData((d) => (d.focus && d.focus.endAt === null ? { ...d, focus: { ...d.focus, endAt: Date.now() + d.focus.remainingMs } } : d));
  }, []);

  // Phiên đang kết thúc (theo startedAt), chặn ghi nhật ký hai lần khi nhịp kiểm tra chạy trước lần render kế tiếp.
  const ending = useRef<number | null>(null);

  /** Đóng phiên: ghi nhật ký; nếu chạy đủ giờ thì đánh dấu buổi học liên kết là hoàn thành. */
  const endFocus = useCallback((natural: boolean) => {
    const f = dataRef.current.focus;
    if (!f || ending.current === f.startedAt) return;
    ending.current = f.startedAt;
    const minutes = natural ? f.minutes : elapsedMinutes(f, Date.now());
    const task = f.taskId ? dataRef.current.tasks.find((t) => t.id === f.taskId) : undefined;
    const completeTask = natural && !!task && !task.done;
    const logId = minutes >= 1 ? uid() : null;
    // phiên kết thúc lúc app đang tắt vẫn được ghi vào đúng ngày kết thúc
    const date = natural && f.endAt !== null ? toISO(new Date(f.endAt)) : todayISO();
    setData((d) => ({
      ...d,
      focus: null,
      logs: logId ? [...d.logs, { id: logId, date, minutes, subjectId: f.subjectId, taskId: task?.id }] : d.logs,
      tasks: completeTask ? d.tasks.map((t) => (t.id === task!.id ? { ...t, done: true } : t)) : d.tasks,
    }));
    setFocusResult(logId ? { logId, minutes, completedTask: completeTask, taskId: task?.id, taskTitle: task?.title } : null);
    if (natural) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const stopFocus = useCallback(() => endFocus(false), [endFocus]);
  const discardFocus = useCallback(() => setData((d) => ({ ...d, focus: null })), []);
  const clearFocusResult = useCallback(() => setFocusResult(null), []);

  // Tự kết thúc phiên khi hết giờ, kể cả khi đang ở màn hình khác hoặc vừa mở lại app.
  const running = ready && data.focus !== null && data.focus.endAt !== null;
  useEffect(() => {
    if (!running) return;
    const check = () => {
      const f = dataRef.current.focus;
      if (f && isFinished(f, Date.now())) endFocus(true);
    };
    check();
    const id = setInterval(check, 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running, endFocus]);

  const setLogRating = useCallback((id: string, rating: number) => {
    setData((d) => ({ ...d, logs: d.logs.map((l) => (l.id === id ? { ...l, rating } : l)) }));
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    await saveApiKey(key);
    setKey(key.trim());
  }, []);

  const resetData = useCallback(() => {
    setFocusResult(null);
    setData(EMPTY_DATA);
  }, []);

  const replaceData = useCallback((next: Data) => {
    setFocusResult(null);
    setData({ ...next, focus: null });
  }, []);

  const subjectOf = useCallback((id: string | null) => data.subjects.find((s) => s.id === id), [data.subjects]);

  const streak = useMemo(() => {
    const active = new Set<string>();
    data.logs.forEach((l) => active.add(l.date));
    data.tasks.forEach((t) => t.done && active.add(t.date));
    let day = todayISO();
    // hôm nay chưa học thì chuỗi vẫn tính đến hôm qua
    if (!active.has(day)) day = addDays(day, -1);
    let n = 0;
    while (active.has(day)) {
      n++;
      day = addDays(day, -1);
    }
    return n;
  }, [data.logs, data.tasks]);

  const value: Store = {
    ...data,
    ready,
    apiKey,
    addTask,
    addTasks,
    updateTask,
    updateTasks,
    toggleTask,
    deleteTask,
    restoreTask,
    addSubject,
    deleteSubject,
    addPlan,
    addTopic,
    updateTopic,
    deleteTopic,
    startFocus,
    pauseFocus,
    resumeFocus,
    stopFocus,
    discardFocus,
    focusResult,
    clearFocusResult,
    setLogRating,
    setSettings,
    setApiKey,
    resetData,
    replaceData,
    subjectOf,
    streak,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore phải nằm trong StoreProvider');
  return s;
}

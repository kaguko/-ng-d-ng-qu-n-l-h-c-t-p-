import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, todayISO } from '@/lib/date';
import { loadApiKey, saveApiKey } from '@/lib/secure';
import { subjectEmojis, subjectPalette } from '@/theme';
import { DEFAULT_SETTINGS, FocusLog, Settings, Subject, Task } from '@/types';

const DATA_KEY = 'lumo.data.v1';

type Data = {
  subjects: Subject[];
  tasks: Task[];
  logs: FocusLog[];
  settings: Settings;
};

const EMPTY: Data = { subjects: [], tasks: [], logs: [], settings: DEFAULT_SETTINGS };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

type Store = Data & {
  ready: boolean;
  apiKey: string;
  addTask: (t: Omit<Task, 'id' | 'done'> & { done?: boolean }) => void;
  addTasks: (t: Omit<Task, 'id' | 'done'>[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  updateTasks: (patches: { id: string; patch: Partial<Task> }[]) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addSubject: (name: string) => Subject;
  deleteSubject: (id: string) => void;
  addLog: (minutes: number, subjectId: string | null) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setApiKey: (key: string) => Promise<void>;
  resetData: () => void;
  subjectOf: (id: string | null) => Subject | undefined;
  streak: number;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [apiKey, setKey] = useState('');
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DATA_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Data>;
          setData({
            subjects: parsed.subjects ?? [],
            tasks: parsed.tasks ?? [],
            logs: parsed.logs ?? [],
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          });
        }
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
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
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
      logs: d.logs.map((l) => (l.subjectId === id ? { ...l, subjectId: null } : l)),
    }));
  }, []);

  const addLog = useCallback((minutes: number, subjectId: string | null) => {
    if (minutes <= 0) return;
    setData((d) => ({ ...d, logs: [...d.logs, { id: uid(), date: todayISO(), minutes, subjectId }] }));
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    await saveApiKey(key);
    setKey(key.trim());
  }, []);

  const resetData = useCallback(() => setData(EMPTY), []);

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
    addSubject,
    deleteSubject,
    addLog,
    setSettings,
    setApiKey,
    resetData,
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

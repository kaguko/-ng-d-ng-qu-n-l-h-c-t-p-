import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, todayISO } from '@/lib/date';
import { loadApiKey, saveApiKey } from '@/lib/secure';
import { subjectEmojis, subjectPalette } from '@/theme';
import { sanitizeTopics } from '@/lib/graph';
import { DEFAULT_SETTINGS, FocusLog, Settings, Subject, Task, Topic } from '@/types';

const DATA_KEY = 'lumo.data.v1';

type Data = {
  subjects: Subject[];
  tasks: Task[];
  topics: Topic[];
  logs: FocusLog[];
  settings: Settings;
};

const EMPTY: Data = { subjects: [], tasks: [], topics: [], logs: [], settings: DEFAULT_SETTINGS };

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
  deleteTask: (id: string) => void;
  addSubject: (name: string) => Subject;
  deleteSubject: (id: string) => void;
  addPlan: (plan: PlanInput) => void;
  addTopic: (name: string, subjectId: string | null, requires: string[]) => void;
  updateTopic: (id: string, patch: Partial<Omit<Topic, 'id'>>) => void;
  deleteTopic: (id: string) => void;
  addLog: (minutes: number, subjectId: string | null, taskId?: string) => string;
  setLogRating: (id: string, rating: number) => void;
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
            // đưa màu môn học cũ về bảng màu đã kiểm chứng (theo thứ tự, không đổi nếu đã hợp lệ)
            subjects: (parsed.subjects ?? []).map((s, i) =>
              subjectPalette.includes(s.color) ? s : { ...s, color: subjectPalette[i % subjectPalette.length] },
            ),
            tasks: parsed.tasks ?? [],
            topics: parsed.topics ?? [],
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

  const addLog = useCallback((minutes: number, subjectId: string | null, taskId?: string) => {
    const id = uid();
    if (minutes <= 0) return id;
    setData((d) => ({ ...d, logs: [...d.logs, { id, date: todayISO(), minutes, subjectId, taskId }] }));
    return id;
  }, []);

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
    addPlan,
    addTopic,
    updateTopic,
    deleteTopic,
    addLog,
    setLogRating,
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

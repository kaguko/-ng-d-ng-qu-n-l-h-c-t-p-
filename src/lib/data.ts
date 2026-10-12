import { isHHmm, isISO } from './date';
import { sanitizeTopics } from './graph';
import { DEFAULT_SETTINGS, FocusLog, FocusSession, Settings, Subject, Task, Topic } from '../types';

export type Data = {
  subjects: Subject[];
  tasks: Task[];
  topics: Topic[];
  logs: FocusLog[];
  settings: Settings;
  focus: FocusSession | null;
};

export const EMPTY_DATA: Data = { subjects: [], tasks: [], topics: [], logs: [], settings: DEFAULT_SETTINGS, focus: null };

export const BACKUP_APP = 'lumo';
export const BACKUP_VERSION = 1;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/**
 * Đọc dữ liệu không đáng tin (AsyncStorage cũ, file sao lưu do người dùng dán vào)
 * và trả về dữ liệu hợp lệ: bỏ bản ghi hỏng, cắt giá trị ngoài khoảng, gỡ tham chiếu treo.
 * `palette` dùng để đưa màu môn học lạ về bảng màu đã kiểm chứng.
 */
export function sanitizeData(raw: unknown, palette: string[] = []): Data {
  const src = isObj(raw) ? raw : {};

  const subjects = uniqueById(
    list(src.subjects).flatMap((s, i): Subject[] => {
      if (!isObj(s) || !str(s.id) || !str(s.name)) return [];
      const color = str(s.color) && (palette.length === 0 || palette.includes(s.color)) ? s.color : palette[i % palette.length] ?? '#3987E5';
      return [{ id: s.id, name: s.name.trim(), color, emoji: str(s.emoji) ? s.emoji : '📘' }];
    }),
  );
  const subjectIds = new Set(subjects.map((s) => s.id));
  const subjectRef = (v: unknown) => (str(v) && subjectIds.has(v) ? v : null);

  const topics = sanitizeTopics(
    uniqueById(
      list(src.topics).flatMap((t): Topic[] => {
        if (!isObj(t) || !str(t.id) || !str(t.name)) return [];
        return [{ id: t.id, name: t.name.trim(), subjectId: subjectRef(t.subjectId), requires: list(t.requires).filter(str) }];
      }),
    ),
  );
  const topicIds = new Set(topics.map((t) => t.id));

  const tasks = uniqueById(
    list(src.tasks).flatMap((t): Task[] => {
      if (!isObj(t) || !str(t.id) || !str(t.title) || !isISO(t.date) || !isHHmm(t.start) || !num(t.duration)) return [];
      return [
        {
          id: t.id,
          title: t.title,
          subjectId: subjectRef(t.subjectId),
          date: t.date,
          start: t.start,
          duration: clamp(Math.round(t.duration), 5, 600),
          done: t.done === true,
          ...(str(t.note) ? { note: t.note } : {}),
          ...(t.ai === true ? { ai: true } : {}),
          ...(str(t.topicId) && topicIds.has(t.topicId) ? { topicId: t.topicId } : {}),
        },
      ];
    }),
  );
  const taskIds = new Set(tasks.map((t) => t.id));

  const logs = uniqueById(
    list(src.logs).flatMap((l): FocusLog[] => {
      if (!isObj(l) || !str(l.id) || !isISO(l.date) || !num(l.minutes) || l.minutes <= 0) return [];
      return [
        {
          id: l.id,
          date: l.date,
          minutes: clamp(Math.round(l.minutes), 1, 1440),
          subjectId: subjectRef(l.subjectId),
          ...(num(l.rating) ? { rating: clamp(Math.round(l.rating), 1, 5) } : {}),
          ...(str(l.taskId) && taskIds.has(l.taskId) ? { taskId: l.taskId } : {}),
        },
      ];
    }),
  );

  const s = isObj(src.settings) ? src.settings : {};
  const settings: Settings = {
    model: str(s.model) ? s.model : DEFAULT_SETTINGS.model,
    dailyGoalMin: num(s.dailyGoalMin) ? clamp(Math.round(s.dailyGoalMin), 15, 720) : DEFAULT_SETTINGS.dailyGoalMin,
    reminders: typeof s.reminders === 'boolean' ? s.reminders : DEFAULT_SETTINGS.reminders,
    reminderLead: num(s.reminderLead) ? clamp(Math.round(s.reminderLead), 0, 60) : DEFAULT_SETTINGS.reminderLead,
  };

  let focus: FocusSession | null = null;
  const f = src.focus;
  if (isObj(f) && num(f.minutes) && num(f.remainingMs) && num(f.startedAt)) {
    focus = {
      minutes: clamp(Math.round(f.minutes), 1, 600),
      remainingMs: clamp(f.remainingMs, 0, f.minutes * 60000),
      endAt: num(f.endAt) ? f.endAt : null,
      startedAt: f.startedAt,
      subjectId: subjectRef(f.subjectId),
      ...(str(f.taskId) && taskIds.has(f.taskId) ? { taskId: f.taskId } : {}),
    };
  }

  return { subjects, tasks, topics, logs, settings, focus };
}

/** Nội dung file sao lưu (JSON). Không chứa API key. */
export function exportBackup(data: Data, now = new Date()): string {
  // chọn từng trường: đối tượng truyền vào có thể là cả store (có API key)
  const { subjects, tasks, topics, logs, settings } = data;
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), subjects, tasks, topics, logs, settings });
}

export type BackupParse = { ok: true; data: Data } | { ok: false; error: string };

export function parseBackup(text: string, palette: string[] = []): BackupParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return { ok: false, error: 'Nội dung không phải JSON hợp lệ. Hãy dán nguyên văn bản sao lưu.' };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'Đây không phải bản sao lưu của Lumo.' };
  if (!num(raw.version) || raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'Bản sao lưu được tạo bởi phiên bản Lumo mới hơn. Hãy cập nhật ứng dụng.' };
  }
  const data = sanitizeData({ ...raw, focus: null }, palette);
  if (!data.tasks.length && !data.subjects.length && !data.logs.length && !data.topics.length) {
    return { ok: false, error: 'Bản sao lưu không có dữ liệu nào.' };
  }
  return { ok: true, data };
}

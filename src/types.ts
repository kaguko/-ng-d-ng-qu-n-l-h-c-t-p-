export type Subject = {
  id: string;
  name: string;
  color: string;
  emoji: string;
};

export type Task = {
  id: string;
  title: string;
  subjectId: string | null;
  /** YYYY-MM-DD (giờ địa phương) */
  date: string;
  /** HH:mm */
  start: string;
  /** phút */
  duration: number;
  done: boolean;
  note?: string;
  ai?: boolean;
  /** chủ đề kiến thức mà buổi học này thuộc về */
  topicId?: string;
};

/** Một nút kiến thức. `requires` là các chủ đề cần nắm trước (cạnh đi từ chúng tới chủ đề này). */
export type Topic = {
  id: string;
  name: string;
  subjectId: string | null;
  requires: string[];
};

export type FocusLog = {
  id: string;
  date: string;
  minutes: number;
  subjectId: string | null;
  /** tự đánh giá độ tập trung sau buổi học, 1–5 */
  rating?: number;
  taskId?: string;
};

export type Settings = {
  model: string;
  dailyGoalMin: number;
  reminders: boolean;
  /** nhắc trước giờ bắt đầu (phút) */
  reminderLead: number;
};

export const DEFAULT_SETTINGS: Settings = {
  model: 'gemini-flash-latest',
  dailyGoalMin: 120,
  reminders: false,
  reminderLead: 10,
};

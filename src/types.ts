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
};

export type FocusLog = {
  id: string;
  date: string;
  minutes: number;
  subjectId: string | null;
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

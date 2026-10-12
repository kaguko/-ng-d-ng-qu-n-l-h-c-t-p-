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

/**
 * Phiên tập trung đang chạy hoặc tạm dừng. Lưu cùng dữ liệu nên vẫn còn khi rời màn hình
 * hay tắt app; đang chạy khi `endAt` khác null, tạm dừng thì thời gian còn lại nằm ở `remainingMs`.
 */
export type FocusSession = {
  /** độ dài dự định (phút) */
  minutes: number;
  endAt: number | null;
  remainingMs: number;
  startedAt: number;
  subjectId: string | null;
  taskId?: string;
};

/** Kết quả phiên vừa kết thúc, dùng để hỏi tự đánh giá. Không lưu xuống đĩa. */
export type FocusResult = {
  logId: string | null;
  minutes: number;
  /** buổi học được liên kết đã được đánh dấu hoàn thành */
  completedTask: boolean;
  taskId?: string;
  taskTitle?: string;
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

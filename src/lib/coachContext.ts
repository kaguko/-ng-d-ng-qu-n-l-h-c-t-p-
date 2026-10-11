import { addDays, formatShort, toMinutes, weekdayShort } from './date';
import type { FocusLog, Subject, Task } from '../types';

type Input = {
  today: string;
  now: string;
  tasks: Task[];
  logs: FocusLog[];
  subjects: Subject[];
  dailyGoalMin: number;
  streak: number;
};

const MAX_UPCOMING = 25;
const MAX_OVERDUE = 8;

/** Tóm tắt trạng thái học tập thành văn bản ngắn để gửi kèm cho huấn luyện viên AI. */
export function buildCoachContext(i: Input): string {
  const name = (t: Task) => i.subjects.find((s) => s.id === t.subjectId)?.name;
  const line = (t: Task) =>
    `- ${t.done ? '[xong]' : '[chưa]'} ${formatShort(t.date)} ${t.start} (${t.duration} phút) ${t.title}${name(t) ? ` – ${name(t)}` : ''}`;

  const overdue = i.tasks.filter(
    (t) => !t.done && (t.date < i.today || (t.date === i.today && toMinutes(t.start) + t.duration < toMinutes(i.now))),
  );
  const until = addDays(i.today, 7);
  const upcoming = i.tasks
    .filter((t) => t.date >= i.today && t.date <= until && !overdue.includes(t))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  const week = Array.from({ length: 7 }, (_, k) => {
    const d = addDays(i.today, k - 6);
    const m = i.logs.filter((l) => l.date === d).reduce((s, l) => s + l.minutes, 0);
    return `${weekdayShort(d)} ${m}'`;
  });
  const weekTotal = i.logs.filter((l) => l.date >= addDays(i.today, -6)).reduce((s, l) => s + l.minutes, 0);

  const doneCount = i.tasks.filter((t) => t.done).length;
  const lines = [
    `Hôm nay: ${i.today}, bây giờ ${i.now}`,
    `Mục tiêu tập trung: ${i.dailyGoalMin} phút/ngày. Chuỗi ngày học liên tiếp: ${i.streak}.`,
    `Tập trung 7 ngày qua (tổng ${weekTotal} phút): ${week.join(', ')}`,
    `Tổng số buổi học đã tạo: ${i.tasks.length}, đã hoàn thành: ${doneCount}.`,
    `Môn học: ${i.subjects.map((s) => s.name).join(', ') || 'chưa có'}`,
    `Buổi học bị lỡ (${overdue.length}):`,
    ...(overdue.length ? overdue.slice(0, MAX_OVERDUE).map(line) : ['- không có']),
    `Lịch 7 ngày tới (${upcoming.length} buổi):`,
    ...(upcoming.length ? upcoming.slice(0, MAX_UPCOMING).map(line) : ['- chưa có buổi nào']),
  ];
  return lines.join('\n');
}

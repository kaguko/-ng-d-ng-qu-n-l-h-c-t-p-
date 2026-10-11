import { isHHmm, isISO } from './date';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {}

type CallOpts = {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  schema?: object;
  temperature?: number;
};

async function callGemini({ apiKey, model, system, prompt, schema, temperature = 0.6 }: CallOpts): Promise<string> {
  if (!apiKey) throw new GeminiError('Chưa có API key. Vào Cài đặt để nhập key Gemini của bạn.');

  let res: Response;
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(model.trim())}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
        },
      }),
    });
  } catch {
    throw new GeminiError('Không kết nối được tới Gemini. Kiểm tra mạng rồi thử lại.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message ?? '';
    } catch {
      // bỏ qua
    }
    if (res.status === 400 && /api key/i.test(detail)) throw new GeminiError('API key không hợp lệ.');
    if (res.status === 401 || res.status === 403) throw new GeminiError('API key bị từ chối hoặc chưa được cấp quyền.');
    if (res.status === 404) throw new GeminiError(`Không tìm thấy model "${model}". Hãy đổi model trong Cài đặt.`);
    if (res.status === 429) throw new GeminiError('Đã vượt hạn mức của API key. Đợi một lúc rồi thử lại.');
    throw new GeminiError(`Gemini báo lỗi ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  const json = await res.json();
  const cand = json?.candidates?.[0];
  const text: string | undefined = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) {
    const why = json?.promptFeedback?.blockReason ?? cand?.finishReason;
    throw new GeminiError(`Gemini không trả về nội dung${why ? ` (${why})` : ''}.`);
  }
  return text;
}

function parseJSON<T>(text: string): T {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new GeminiError('Gemini trả về dữ liệu không đọc được. Hãy thử lại.');
  }
}

export async function testConnection(apiKey: string, model: string): Promise<void> {
  await callGemini({
    apiKey,
    model,
    system: 'Trả lời đúng một từ.',
    prompt: 'Nói "ok".',
  });
}

// ---------- Tạo lịch học ----------

export type PlanRequest = {
  apiKey: string;
  model: string;
  goal: string;
  subjects: string[];
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  windowStart: string;
  windowEnd: string;
  level: string;
  notes: string;
  existing: { date: string; start: string; duration: number }[];
};

export type PlanItem = {
  date: string;
  start: string;
  duration: number;
  title: string;
  subject: string;
  note: string;
};

const planSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'YYYY-MM-DD' },
          start: { type: 'STRING', description: 'HH:mm 24 giờ' },
          duration: { type: 'INTEGER', description: 'số phút' },
          title: { type: 'STRING' },
          subject: { type: 'STRING' },
          note: { type: 'STRING' },
        },
        required: ['date', 'start', 'duration', 'title', 'subject'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM_PLANNER = `Bạn là huấn luyện viên học tập giúp học sinh/sinh viên Việt Nam lập lịch học khoa học.
Nguyên tắc: chia nhỏ mục tiêu thành các buổi 25-90 phút; xen kẽ các môn; ôn tập ngắt quãng (spaced repetition) trước kỳ hạn; dành buổi ôn tổng hợp/làm đề ở cuối; nghỉ giữa các buổi liền kề ít nhất 10 phút; không xếp vào khung giờ đã bận; không vượt quá số giờ học mỗi ngày.
Tiêu đề từng buổi phải cụ thể, hành động được (ví dụ "Giải 15 bài tích phân từng phần"), viết bằng tiếng Việt. "subject" phải trùng đúng một tên trong danh sách môn người dùng cung cấp.`;

export async function generatePlan(req: PlanRequest): Promise<PlanItem[]> {
  const busy = req.existing.length
    ? req.existing.map((e) => `${e.date} ${e.start} (${e.duration} phút)`).join('; ')
    : 'không có';
  const prompt = `Mục tiêu: ${req.goal}
Các môn/chủ đề: ${req.subjects.join(', ') || 'tự đề xuất theo mục tiêu'}
Từ ngày ${req.startDate} đến hết ngày ${req.endDate}
Tối đa ${req.hoursPerDay} giờ học mỗi ngày, chỉ xếp trong khung ${req.windowStart}–${req.windowEnd}
Trình độ hiện tại: ${req.level}
Ghi chú thêm: ${req.notes || 'không có'}
Khung giờ đã bận (không xếp trùng): ${busy}

Trả về danh sách buổi học theo schema.`;

  const text = await callGemini({
    apiKey: req.apiKey,
    model: req.model,
    system: SYSTEM_PLANNER,
    prompt,
    schema: planSchema,
  });

  const raw = parseJSON<{ items?: Partial<PlanItem>[] }>(text).items ?? [];
  const items: PlanItem[] = [];
  for (const r of raw) {
    if (!isISO(r.date) || r.date < req.startDate || r.date > req.endDate) continue;
    if (!isHHmm(r.start) || !r.title) continue;
    const duration = Math.min(240, Math.max(15, Math.round(Number(r.duration) || 45)));
    items.push({
      date: r.date,
      start: r.start,
      duration,
      title: String(r.title).slice(0, 120),
      subject: String(r.subject ?? ''),
      note: String(r.note ?? '').slice(0, 300),
    });
  }
  if (!items.length) throw new GeminiError('Gemini không tạo được buổi học nào hợp lệ. Hãy thử mô tả mục tiêu rõ hơn.');
  return items;
}

// ---------- Sắp xếp lại việc trễ ----------

export type RescheduleRequest = {
  apiKey: string;
  model: string;
  today: string;
  nowTime: string;
  untilDate: string;
  overdue: { id: string; title: string; duration: number; originalDate: string }[];
  upcoming: { date: string; start: string; duration: number }[];
  hoursPerDay: number;
};

export type RescheduleItem = { id: string; date: string; start: string };

const rescheduleSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          date: { type: 'STRING' },
          start: { type: 'STRING' },
        },
        required: ['id', 'date', 'start'],
      },
    },
  },
  required: ['items'],
};

export async function rescheduleOverdue(req: RescheduleRequest): Promise<RescheduleItem[]> {
  const prompt = `Hôm nay là ${req.today}, bây giờ là ${req.nowTime}.
Các buổi học bị lỡ cần xếp lại (đưa theo thứ tự ưu tiên: buổi lỡ lâu nhất trước):
${req.overdue.map((o) => `- id=${o.id} | "${o.title}" | ${o.duration} phút | lỡ từ ${o.originalDate}`).join('\n')}

Các buổi đã có trong lịch (không được xếp trùng): ${
    req.upcoming.map((u) => `${u.date} ${u.start} (${u.duration} phút)`).join('; ') || 'không có'
  }
Chỉ xếp từ bây giờ đến hết ngày ${req.untilDate}, trong khung 06:00–22:30, tối đa ${req.hoursPerDay} giờ học mỗi ngày (tính cả các buổi đã có).
Trải đều, không dồn hết vào một ngày, và chỉ trả về id đã cho cùng ngày/giờ bắt đầu mới.`;

  const text = await callGemini({
    apiKey: req.apiKey,
    model: req.model,
    system: 'Bạn là trợ lý lập lịch học. Chỉ trả về JSON đúng schema, không giải thích.',
    prompt,
    schema: rescheduleSchema,
    temperature: 0.3,
  });

  const ids = new Set(req.overdue.map((o) => o.id));
  const out: RescheduleItem[] = [];
  for (const r of parseJSON<{ items?: Partial<RescheduleItem>[] }>(text).items ?? []) {
    if (!r.id || !ids.has(r.id) || !isISO(r.date) || !isHHmm(r.start)) continue;
    if (r.date < req.today || r.date > req.untilDate) continue;
    if (r.date === req.today && r.start < req.nowTime) continue;
    out.push({ id: r.id, date: r.date, start: r.start });
  }
  if (!out.length) throw new GeminiError('Không sắp xếp được. Hãy thử lại.');
  return out;
}

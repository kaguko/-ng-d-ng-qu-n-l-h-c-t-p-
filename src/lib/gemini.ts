import { isHHmm, isISO } from './date';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {}

export type ChatMessage = { role: 'user' | 'model'; text: string };

type CallOpts = {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  schema?: object;
  temperature?: number;
  /** kiểm tra kết nối: hết giờ sớm và báo lỗi ngay khi mạng treo */
  quick?: boolean;
};

// Tắt chế độ "suy nghĩ" để phản hồi nhanh hơn nhiều. Model không cho tắt (vd. dòng Pro)
// sẽ báo lỗi 400 nhắc tới thinking; ghi nhớ để các lần sau gửi thẳng không kèm tuỳ chọn này.
const thinkingLocked = new Set<string>();

class OverloadedError extends GeminiError {}
class TimeoutError extends OverloadedError {}

async function post(opts: CallOpts, thinkingOff: boolean): Promise<Response> {
  const { apiKey, model, system, messages, schema, temperature = 0.6 } = opts;
  // Quá thời gian chờ thì huỷ để người dùng không phải nhìn vòng quay vô tận.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.quick ? 12_000 : schema ? 75_000 : 30_000);
  try {
    return await fetch(`${BASE}/${encodeURIComponent(model.trim())}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: {
          temperature,
          ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          ...(schema ? { maxOutputTokens: 16384 } : {}),
          ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
        },
      }),
    });
  } catch {
    if (ctrl.signal.aborted) throw new TimeoutError('Gemini phản hồi quá lâu. Thử lại sau ít phút.');
    throw new GeminiError('Không kết nối được tới Gemini. Kiểm tra mạng rồi thử lại.');
  } finally {
    clearTimeout(timer);
  }
}

async function errorDetail(res: Response): Promise<string> {
  try {
    return (await res.clone().json())?.error?.message ?? '';
  } catch {
    return '';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Model dự phòng khi model đang chọn quá tải (503) kéo dài.
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

async function callModel(opts: CallOpts): Promise<string> {
  const { model } = opts;

  const modelKey = model.trim();
  let res = await post(opts, !thinkingLocked.has(modelKey));
  let detail = res.ok ? '' : await errorDetail(res);

  if (!res.ok && res.status === 400 && /think/i.test(detail) && !thinkingLocked.has(modelKey)) {
    thinkingLocked.add(modelKey);
    res = await post(opts, false);
    detail = res.ok ? '' : await errorDetail(res);
  }

  if (!res.ok) {
    if (res.status === 400 && /api key/i.test(detail)) throw new GeminiError('API key không hợp lệ.');
    if (res.status === 401 || res.status === 403) throw new GeminiError('API key bị từ chối hoặc chưa được cấp quyền.');
    if (res.status === 404) throw new GeminiError(`Không tìm thấy model "${model}". Hãy đổi model trong Cài đặt.`);
    if (res.status === 500 || res.status === 503 || res.status === 504) throw new OverloadedError('Gemini đang quá tải. Thử lại sau ít phút.');
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

async function callGemini(opts: CallOpts): Promise<string> {
  if (!opts.apiKey) throw new GeminiError('Chưa có API key. Vào Cài đặt để nhập key Gemini của bạn.');
  const chosen = opts.model.trim();
  const models = [chosen, ...FALLBACK_MODELS.filter((m) => m !== chosen)];
  let last: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel({ ...opts, model });
      } catch (e) {
        if (!(e instanceof OverloadedError)) throw e;
        last = e;
        if (e instanceof TimeoutError && opts.quick) throw e; // kiểm tra kết nối: báo ngay, đừng bắt người dùng chờ
        if (e instanceof TimeoutError) break; // model này đang chậm: sang model khác ngay
        if (attempt === 0) await sleep(1500);
      }
    }
  }
  throw last;
}

function parseJSON<T>(text: string): T {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new GeminiError('Gemini trả về dữ liệu không đọc được. Hãy thử lại.');
  }
}

/** Gọi Gemini lấy JSON; thử lại một lần nếu dữ liệu trả về không đọc được (thường do bị cắt cụt). */
async function callJSON<T>(opts: CallOpts): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callGemini({ ...opts, temperature: attempt ? 0.2 : opts.temperature });
    try {
      return parseJSON<T>(text);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export async function testConnection(apiKey: string, model: string): Promise<void> {
  await callGemini({
    apiKey,
    model,
    system: 'Trả lời đúng một từ.',
    messages: [{ role: 'user', text: 'Nói "ok".' }],
    quick: true,
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
  /** thời điểm hiện tại, để không xếp vào quá khứ */
  now: { date: string; time: string };
};

export type PlanItem = {
  date: string;
  start: string;
  duration: number;
  title: string;
  subject: string;
  note: string;
  /** tên chủ đề kiến thức (khớp một phần tử trong PlanResult.topics) */
  topic: string;
};

export type PlanTopic = { name: string; subject: string; requires: string[] };

export type PlanResult = { items: PlanItem[]; topics: PlanTopic[] };

const planSchema = {
  type: 'OBJECT',
  properties: {
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          subject: { type: 'STRING' },
          requires: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['name', 'subject', 'requires'],
      },
    },
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
          topic: { type: 'STRING' },
        },
        required: ['date', 'start', 'duration', 'title', 'subject', 'topic'],
      },
    },
  },
  required: ['topics', 'items'],
};

const SYSTEM_PLANNER = `Bạn là huấn luyện viên học tập giúp học sinh/sinh viên Việt Nam lập lịch học khoa học.
Nguyên tắc: chia nhỏ mục tiêu thành các buổi 25-90 phút; xen kẽ các môn; ôn tập ngắt quãng (spaced repetition) trước kỳ hạn; dành buổi ôn tổng hợp/làm đề ở cuối; nghỉ giữa các buổi liền kề ít nhất 10 phút; không xếp vào khung giờ đã bận; không vượt quá số giờ học mỗi ngày.
Tiêu đề từng buổi phải cụ thể, hành động được (ví dụ "Giải 15 bài tích phân từng phần"), viết bằng tiếng Việt. "subject" phải trùng đúng một tên trong danh sách môn người dùng cung cấp.
Đồng thời dựng bản đồ kiến thức: chia mục tiêu thành 4-12 chủ đề ("topics"), mỗi chủ đề có tên ngắn gọn (tối đa 5 từ) và "requires" là danh sách tên các chủ đề khác cần nắm trước (rỗng nếu là nền tảng; chỉ nêu mối phụ thuộc thật sự, tránh nối thừa, không tạo vòng tròn). Mỗi buổi học có "topic" trùng đúng tên một chủ đề, và các buổi của chủ đề nền tảng phải đứng trước các buổi của chủ đề phụ thuộc vào nó.`;

export async function generatePlan(req: PlanRequest): Promise<PlanResult> {
  const busy = req.existing.length
    ? req.existing.map((e) => `${e.date} ${e.start} (${e.duration} phút)`).join('; ')
    : 'không có';
  const prompt = `Bây giờ là ${req.now.time} ngày ${req.now.date}; không xếp buổi nào trước thời điểm này.
Mục tiêu: ${req.goal}
Các môn/chủ đề: ${req.subjects.join(', ') || 'tự đề xuất theo mục tiêu'}
Từ ngày ${req.startDate} đến hết ngày ${req.endDate}
Tối đa ${req.hoursPerDay} giờ học mỗi ngày, chỉ xếp trong khung ${req.windowStart}–${req.windowEnd}
Trình độ hiện tại: ${req.level}
Ghi chú thêm: ${req.notes || 'không có'}
Khung giờ đã bận (không xếp trùng): ${busy}

Trả về danh sách buổi học theo schema.`;

  const parsed = await callJSON<{ items?: Partial<PlanItem>[]; topics?: Partial<PlanTopic>[] }>({
    apiKey: req.apiKey,
    model: req.model,
    system: SYSTEM_PLANNER,
    messages: [{ role: 'user', text: prompt }],
    schema: planSchema,
  });

  const raw = parsed.items ?? [];
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
      topic: String(r.topic ?? '').trim().slice(0, 60),
    });
  }
  if (!items.length) throw new GeminiError('Gemini không tạo được buổi học nào hợp lệ. Hãy thử mô tả mục tiêu rõ hơn.');

  const topics = cleanTopics(parsed.topics ?? []);
  // buổi học trỏ tới chủ đề không tồn tại thì bỏ liên kết chủ đề, không bỏ buổi học
  const known = new Set(topics.map((t) => t.name.toLowerCase()));
  for (const it of items) if (!known.has(it.topic.toLowerCase())) it.topic = '';
  return { items, topics };
}

const MAX_TOPICS = 20;

function cleanTopics(raw: Partial<PlanTopic>[]): PlanTopic[] {
  const seen = new Set<string>();
  const topics: PlanTopic[] = [];
  for (const t of raw) {
    const name = String(t.name ?? '').trim().slice(0, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    topics.push({
      name,
      subject: String(t.subject ?? '').trim(),
      requires: Array.isArray(t.requires) ? t.requires.map((r) => String(r).trim()).filter(Boolean) : [],
    });
    if (topics.length >= MAX_TOPICS) break;
  }
  // chỉ giữ liên kết tới chủ đề có thật và không trỏ vào chính nó
  const names = new Set(topics.map((t) => t.name.toLowerCase()));
  for (const t of topics) {
    t.requires = t.requires.filter((r) => names.has(r.toLowerCase()) && r.toLowerCase() !== t.name.toLowerCase());
  }
  return topics;
}

// ---------- Gợi ý liên kết kiến thức ----------

const linksSchema = {
  type: 'OBJECT',
  properties: {
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          requires: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['name', 'requires'],
      },
    },
  },
  required: ['topics'],
};

/** Nhờ Gemini đề xuất mối phụ thuộc giữa các chủ đề đã có. Trả về tên chủ đề -> các tên cần học trước. */
export async function suggestLinks(opts: {
  apiKey: string;
  model: string;
  topics: { name: string; subject?: string }[];
}): Promise<Map<string, string[]>> {
  const list = opts.topics.map((t) => `- ${t.name}${t.subject ? ` (${t.subject})` : ''}`).join('\n');
  const parsed = await callJSON<{ topics?: Partial<PlanTopic>[] }>({
    apiKey: opts.apiKey,
    model: opts.model,
    system:
      'Bạn là chuyên gia thiết kế chương trình học. Với danh sách chủ đề, hãy chỉ ra chủ đề nào cần nắm trước chủ đề nào. Chỉ nêu mối phụ thuộc thật sự, không tạo vòng tròn, chỉ dùng đúng tên đã cho. Chỉ trả về JSON đúng schema.',
    messages: [{ role: 'user', text: `Các chủ đề:\n${list}` }],
    schema: linksSchema,
    temperature: 0.2,
  });
  const clean = cleanTopics((parsed.topics ?? []).map((t) => ({ ...t, subject: '' })));
  const given = new Map(opts.topics.map((t) => [t.name.toLowerCase(), t.name]));
  const out = new Map<string, string[]>();
  for (const t of clean) {
    const name = given.get(t.name.toLowerCase());
    if (!name) continue;
    const reqs = t.requires.map((r) => given.get(r.toLowerCase())).filter((r): r is string => !!r);
    if (reqs.length) out.set(name, reqs);
  }
  return out;
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

  const parsed = await callJSON<{ items?: Partial<RescheduleItem>[] }>({
    apiKey: req.apiKey,
    model: req.model,
    system: 'Bạn là trợ lý lập lịch học. Chỉ trả về JSON đúng schema, không giải thích.',
    messages: [{ role: 'user', text: prompt }],
    schema: rescheduleSchema,
    temperature: 0.3,
  });

  const ids = new Set(req.overdue.map((o) => o.id));
  const out: RescheduleItem[] = [];
  for (const r of parsed.items ?? []) {
    if (!r.id || !ids.has(r.id) || !isISO(r.date) || !isHHmm(r.start)) continue;
    if (r.date < req.today || r.date > req.untilDate) continue;
    if (r.date === req.today && r.start < req.nowTime) continue;
    out.push({ id: r.id, date: r.date, start: r.start });
  }
  if (!out.length) throw new GeminiError('Không sắp xếp được. Hãy thử lại.');
  return out;
}

// ---------- Huấn luyện viên AI ----------

const SYSTEM_COACH = `Bạn là Lumo, huấn luyện viên học tập thân thiện cho học sinh/sinh viên Việt Nam.
Chỉ dựa vào "DỮ LIỆU CỦA NGƯỜI DÙNG" bên dưới khi nói về lịch, tiến độ hay thói quen; nếu dữ liệu không có thì nói rõ là chưa có, không bịa số liệu.
Trả lời ngắn gọn (tối đa khoảng 8 dòng), cụ thể, hành động được, bằng tiếng Việt. Không dùng markdown (không **, không #); dùng gạch đầu dòng "-" khi liệt kê.
Khi người dùng cần đổi hoặc tạo lịch, hướng dẫn họ dùng tab AI hoặc nút "AI xếp lại lịch" ở tab Hôm nay.`;

export async function coachReply(opts: {
  apiKey: string;
  model: string;
  context: string;
  history: ChatMessage[];
}): Promise<string> {
  const text = await callGemini({
    apiKey: opts.apiKey,
    model: opts.model,
    system: `${SYSTEM_COACH}

DỮ LIỆU CỦA NGƯỜI DÙNG:
${opts.context}`,
    messages: opts.history,
    temperature: 0.7,
  });
  return text.trim();
}

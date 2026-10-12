import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { GeminiError, testConnection } from './gemini';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 });
const err = (status: number, message = 'x') => new Response(JSON.stringify({ error: { message } }), { status });

/** Giả lập fetch: trả lần lượt các phản hồi và ghi lại model đã gọi. */
function mock(responses: (() => Response)[]) {
  const models: string[] = [];
  globalThis.fetch = (async (url: string) => {
    models.push(/models\/([^:]+):/.exec(url)![1]);
    const next = responses[Math.min(models.length - 1, responses.length - 1)];
    return next();
  }) as typeof fetch;
  return models;
}

test('503 một lần rồi thành công: thử lại cùng model', async () => {
  const models = mock([() => err(503), ok]);
  await testConnection('k', 'gemini-flash-latest');
  assert.deepEqual(models, ['gemini-flash-latest', 'gemini-flash-latest']);
});

test('model đang chọn quá tải kéo dài: chuyển sang model dự phòng', async () => {
  const models = mock([() => err(503), () => err(503), ok]);
  await testConnection('k', 'gemini-flash-latest');
  assert.equal(models.at(-1), 'gemini-2.5-flash');
});

test('mọi model đều quá tải: báo lỗi thân thiện, không treo', async () => {
  mock([() => err(503, 'high demand')]);
  await assert.rejects(testConnection('k', 'gemini-flash-latest'), (e: Error) => {
    assert.ok(e instanceof GeminiError);
    assert.match(e.message, /quá tải/);
    return true;
  });
});

test('key bị từ chối: không thử lại', async () => {
  const models = mock([() => err(403)]);
  await assert.rejects(testConnection('k', 'gemini-flash-latest'), /từ chối/);
  assert.equal(models.length, 1);
});

test('key sai (400): không thử lại', async () => {
  const models = mock([() => err(400, 'API key not valid')]);
  await assert.rejects(testConnection('k', 'gemini-flash-latest'), /không hợp lệ/);
  assert.equal(models.length, 1);
});

test('hết hạn mức (429): không thử lại', async () => {
  const models = mock([() => err(429)]);
  await assert.rejects(testConnection('k', 'gemini-flash-latest'), /hạn mức/);
  assert.equal(models.length, 1);
});

test('mất mạng: báo lỗi kết nối', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('Network request failed');
  }) as typeof fetch;
  await assert.rejects(testConnection('k', 'gemini-flash-latest'), /Không kết nối được/);
});

test('model treo quá lâu: huỷ rồi chuyển model dự phòng', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const models: string[] = [];
  globalThis.fetch = ((url: string, init: RequestInit) => {
    models.push(/models\/([^:]+):/.exec(url)![1]);
    if (models.length > 1) return Promise.resolve(ok());
    return new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))));
  }) as typeof fetch;
  const p = testConnection('k', 'gemini-flash-latest');
  t.mock.timers.tick(30_000);
  await p;
  assert.deepEqual(models, ['gemini-flash-latest', 'gemini-2.5-flash']);
});

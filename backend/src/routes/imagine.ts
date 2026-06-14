import { Router } from 'express';
import https from 'node:https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { toEnglishPrompt } from '../zhEnPrompt.js';

export const imagineRouter = Router();
export const hfImageModel = process.env.HF_IMAGE_MODEL ?? 'black-forest-labs/FLUX.1-schnell';

const TIMEOUT_MS = Number(process.env.IMAGINE_TIMEOUT_MS ?? 60_000);
const ENDPOINT_URL = process.env.HF_IMAGE_URL || `https://router.huggingface.co/hf-inference/models/${hfImageModel}`;
const PROXY = process.env.socks_proxy || process.env.SOCKS_PROXY || '';
const AGENT = PROXY ? new SocksProxyAgent(PROXY) : undefined;
console.log('[sonicraft] imagine endpoint:', ENDPOINT_URL, '| socks proxy:', PROXY || 'none (direct)');
const MAX_PROMPT = 240;

// 抠图（背景移除）模型：把前景物体从自带影棚底里抠出来，使其能自然合成到画布背景上。
export const hfCutoutModel = process.env.HF_CUTOUT_MODEL ?? 'briaai/RMBG-1.4';
const CUTOUT_URL = process.env.HF_CUTOUT_URL || `https://router.huggingface.co/hf-inference/models/${hfCutoutModel}`;
const MAX_IMAGE_BYTES = Number(process.env.CUTOUT_MAX_BYTES ?? 6_000_000);

export function hasHfToken(): boolean {
  return Boolean(process.env.HF_TOKEN);
}

imagineRouter.post('/imagine', async (req, res) => {
  const token = process.env.HF_TOKEN ?? '';
  const prompt = parsePrompt(req.body?.prompt);

  if (!token) {
    res.status(503).json({ error: '后端未配置 HF_TOKEN，无法使用 AI 文生图' });
    return;
  }
  if (!prompt) {
    res.status(400).json({ error: '缺少 prompt 字段' });
    return;
  }

  const enPrompt = toEnglishPrompt(prompt); // FLUX 以英文为主，先把中文主体翻成英文
  console.log('[sonicraft] imagine prompt:', prompt, '→', enPrompt);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetchImageHttps(enPrompt, token, controller.signal);
    await pipeResponse(resp, res);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const detail = err instanceof Error ? err.message : String(err);
    if (!aborted) console.error('[sonicraft] imagine error:', detail);
    res.status(aborted ? 504 : 502).json({ error: aborted ? '文生图超时' : `文生图调用失败：${detail}` });
  } finally {
    clearTimeout(timer);
  }
});

// —— 抠图：移除前景图片自带背景，返回掩码（前端据此合成透明 PNG）——
imagineRouter.post('/cutout', async (req, res) => {
  const token = process.env.HF_TOKEN ?? '';
  if (!token) {
    res.status(503).json({ error: '后端未配置 HF_TOKEN，无法抠图' });
    return;
  }
  const raw = typeof req.body?.image === 'string' ? req.body.image : '';
  const b64 = raw.replace(/^data:image\/\w+;base64,/, '').trim();
  if (!b64) {
    res.status(400).json({ error: '缺少 image 字段（base64 PNG）' });
    return;
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    res.status(400).json({ error: 'image 不是合法 base64' });
    return;
  }
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
    res.status(400).json({ error: '图片为空或过大' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await fetchCutoutHttps(buf, token, controller.signal);
    if (result.kind === 'cutout') res.json({ cutout: result.data }); // 已是透明 PNG
    else res.json({ mask: result.data }); // 灰度掩码，前端合成
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const detail = err instanceof Error ? err.message : String(err);
    if (!aborted) console.error('[sonicraft] cutout error:', detail);
    res.status(aborted ? 504 : 502).json({ error: aborted ? '抠图超时' : `抠图调用失败：${detail}` });
  } finally {
    clearTimeout(timer);
  }
});

function parsePrompt(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, MAX_PROMPT);
}

/**
 * 调 HF 背景移除模型。两种返回都兼容：
 *  - JSON（image-segmentation）：[{ label, mask(base64) }] → 取前景掩码（kind:'mask'）
 *  - 直接 PNG（部分背景移除端点直出透明图）→ kind:'cutout'
 */
function fetchCutoutHttps(
  image: Buffer,
  token: string,
  signal: AbortSignal,
): Promise<{ kind: 'mask' | 'cutout'; data: string }> {
  const url = new URL(CUTOUT_URL);
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'x-wait-for-model': 'true',
        'Content-Length': image.length,
      },
      ...(AGENT ? { agent: AGENT, rejectUnauthorized: false } : {}),
      timeout: TIMEOUT_MS,
      signal,
    }, (resp) => {
      const chunks: Buffer[] = [];
      resp.on('data', (chunk: Buffer) => chunks.push(chunk));
      resp.on('end', () => {
        const status = resp.statusCode ?? 502;
        const buf = Buffer.concat(chunks);
        if (status >= 400) {
          reject(new Error(`HF cutout HTTP ${status}: ${buf.toString().slice(0, 300)}`));
          return;
        }
        const contentType = String(resp.headers['content-type'] ?? '');
        if (contentType.includes('image/')) {
          resolve({ kind: 'cutout', data: buf.toString('base64') });
          return;
        }
        try {
          const data = JSON.parse(buf.toString());
          const mask = extractMask(data);
          if (mask) resolve({ kind: 'mask', data: mask });
          else reject(new Error('抠图未返回掩码'));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
      resp.on('error', reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    request.write(image);
    request.end();
  });
}

/** 从 image-segmentation 响应里取前景掩码（base64 PNG，白=前景）。 */
function extractMask(data: unknown): string {
  if (!Array.isArray(data)) {
    const single = data as { mask?: string };
    return typeof single?.mask === 'string' ? single.mask : '';
  }
  // 优先 label 像“前景/主体”的项；否则取首个带 mask 的项。
  const fg = data.find((d) => /foreground|subject|object/i.test(String(d?.label ?? '')) && d?.mask);
  const any = data.find((d) => typeof d?.mask === 'string');
  return String((fg ?? any)?.mask ?? '');
}

function fetchImageHttps(prompt: string, token: string, signal: AbortSignal): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: () => Promise<Buffer> }> {
  const url = new URL(ENDPOINT_URL);
  const body = JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 4 } });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'image/png',
        'x-wait-for-model': 'true',
        'Content-Length': Buffer.byteLength(body),
      },
      ...(AGENT ? { agent: AGENT, rejectUnauthorized: false } : {}),
      timeout: TIMEOUT_MS,
      signal,
    }, (resp) => {
      const chunks: Buffer[] = [];
      resp.on('data', (chunk: Buffer) => chunks.push(chunk));
      resp.on('end', () => {
        resolve({
          statusCode: resp.statusCode ?? 502,
          headers: resp.headers,
          body: () => Promise.resolve(Buffer.concat(chunks)),
        });
      });
      resp.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(body);
    req.end();
  });
}

async function pipeResponse(
  resp: Awaited<ReturnType<typeof fetchImageHttps>>,
  res: import('express').Response,
): Promise<void> {
  if (!resp.statusCode || resp.statusCode >= 400) {
    const buf = await resp.body();
    const detail = buf.toString().slice(0, 300);
    throw new Error(`HF image HTTP ${resp.statusCode}: ${detail}`);
  }

  const contentType = String(resp.headers['content-type'] ?? '');
  const buf = await resp.body();

  if (contentType.includes('application/json')) {
    const data = JSON.parse(buf.toString()) as Record<string, any>;
    const b64 = data?.images?.[0]?.b64_json ?? data?.data?.[0]?.b64_json ?? data?.image ?? '';
    if (!b64) {
      res.status(502).json({ error: '文生图未返回图片', detail: JSON.stringify(data).slice(0, 200) });
      return;
    }
    res.type('png').send(Buffer.from(String(b64), 'base64'));
    return;
  }

  res.type(contentType.includes('jpeg') ? 'jpeg' : 'png').send(buf);
}

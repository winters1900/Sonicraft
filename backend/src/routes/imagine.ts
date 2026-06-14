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

function parsePrompt(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, MAX_PROMPT);
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

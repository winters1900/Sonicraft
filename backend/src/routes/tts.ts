import { Router } from 'express';
import { getQiniuConfig } from '../qiniu.js';

// POST /api/tts  { text }  → audio/mpeg 二进制
// 文字转语音代理：把反馈文案发往七牛 TTS，返回可直接播放的音频。密钥隔离在后端。
// 说明：响应可能是二进制音频或含 base64 的 JSON，这里都兼容；线上字段差异集中于此。
export const ttsRouter = Router();

const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS ?? 12000);

ttsRouter.post('/tts', async (req, res) => {
  const cfg = getQiniuConfig();
  if (!cfg.apiKey) {
    res.status(503).json({ error: '后端未配置 QINIU_API_KEY，请改用浏览器语音合成' });
    return;
  }
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    res.status(400).json({ error: '缺少 text 字段' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const resp = await fetch(`${cfg.baseUrl}/voice/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      // 七牛 TTS 实测契约：audio.voice_type + request.text（不是 OpenAI 的 input/voice）。
      body: JSON.stringify({ audio: { voice_type: cfg.ttsVoice, encoding: 'mp3' }, request: { text } }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      res.status(502).json({ error: `七牛 TTS HTTP ${resp.status}`, detail: detail.slice(0, 300) });
      return;
    }

    const contentType = resp.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      // 兼容 { data: base64 } / { audio: base64 } 形态
      const data = (await resp.json()) as Record<string, any>;
      const b64 = data?.audio ?? data?.data?.audio ?? data?.data ?? '';
      if (!b64) {
        res.status(502).json({ error: '七牛 TTS 未返回音频' });
        return;
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(Buffer.from(String(b64), 'base64'));
      return;
    }
    // 二进制音频直接透传
    const buf = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({ error: aborted ? '七牛 TTS 超时' : '七牛 TTS 调用失败' });
  } finally {
    clearTimeout(timer);
  }
});

import { Router } from 'express';
import { getQiniuConfig } from '../qiniu.js';
import { hasKodo, uploadAudio, deleteObject } from '../kodo.js';

// POST /api/asr  { audio: base64, format: 'wav'|'mp3'|'webm' }  → { text }
// 语音识别代理：七牛 ASR 为“服务端回拉音频”模式（audio.url 必填，访问不到 localhost），
// 因此先把前端上传的录音放到 Kodo 对象存储换取公网 URL，再交七牛识别；密钥隔离在后端。
export const asrRouter = Router();

const ASR_TIMEOUT_MS = Number(process.env.ASR_TIMEOUT_MS ?? 12000);

asrRouter.post('/asr', async (req, res) => {
  const cfg = getQiniuConfig();
  if (!cfg.apiKey) {
    res.status(503).json({ error: '后端未配置 QINIU_API_KEY，请改用浏览器语音识别' });
    return;
  }
  if (!hasKodo()) {
    res.status(503).json({ error: '后端未配置 Kodo 对象存储（QINIU_KODO_*），七牛 ASR 需公网音频地址，请改用浏览器识别' });
    return;
  }
  const audio: unknown = req.body?.audio;
  const format: string = typeof req.body?.format === 'string' ? req.body.format : 'wav';
  if (typeof audio !== 'string' || !audio) {
    res.status(400).json({ error: '缺少 audio(base64) 字段' });
    return;
  }

  // 1) 录音上传 Kodo 换公网 URL
  let uploaded: { url: string; key: string };
  try {
    uploaded = await uploadAudio(Buffer.from(audio, 'base64'), format);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: '音频上传 Kodo 失败', detail: msg.slice(0, 300) });
    return;
  }

  // 2) 用公网 URL 调七牛 ASR
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASR_TIMEOUT_MS);
  try {
    const resp = await fetch(`${cfg.baseUrl}/voice/asr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: 'asr', audio: { format, url: uploaded.url } }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      res.status(502).json({ error: `七牛 ASR HTTP ${resp.status}`, detail: detail.slice(0, 300) });
      return;
    }
    const data = await resp.json();
    res.json({ text: extractText(data) });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({ error: aborted ? '七牛 ASR 超时' : '七牛 ASR 调用失败' });
  } finally {
    clearTimeout(timer);
    deleteObject(uploaded.key); // best-effort 清理临时音频
  }
});

/** 防御式提取识别文本，兼容不同响应包裹形态。 */
function extractText(data: unknown): string {
  if (typeof data === 'string') return data;
  const o = data as Record<string, any>;
  return (
    o?.text ??
    o?.data?.result?.text ?? // 七牛实测结构：{ data: { result: { text } } }
    o?.data?.text ??
    o?.result?.text ??
    (typeof o?.data?.result === 'string' ? o.data.result : '') ??
    (Array.isArray(o?.results) ? o.results.map((r: any) => r?.text).join('') : '') ??
    ''
  );
}

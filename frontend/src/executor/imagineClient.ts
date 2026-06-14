// AI 文生图前端客户端：把提示词发往后端 /api/imagine（代理 HF 文生图），取回图片 dataURL。
// 密钥隔离在后端；前端只拿图片。

export async function imagineImage(prompt: string, signal?: AbortSignal): Promise<string> {
  const resp = await fetch('/api/imagine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error((data as { error?: string })?.error ?? `文生图失败(${resp.status})`);
  }
  const blob = await resp.blob();
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

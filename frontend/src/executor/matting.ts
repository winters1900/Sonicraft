// 浏览器内真抠图：用 transformers.js 跑 RMBG-1.4 抠图模型，对任意图片去背景，
// 返回带透明通道的 PNG dataURL。模型与 ONNX runtime 的 wasm 都走本地（/models、/ort），
// 不依赖浏览器直连 HF/CDN。库按需动态加载（首次调用才下载 ~42MB 模型，之后浏览器缓存）。

type TF = typeof import('@huggingface/transformers');

const MODEL_ID = 'briaai/RMBG-1.4';

let libPromise: Promise<TF> | null = null;
let modelPromise: Promise<{ model: any; processor: any }> | null = null;

async function getLib(): Promise<TF> {
  if (!libPromise) {
    libPromise = import('@huggingface/transformers').then((tf) => {
      const env = tf.env;
      env.allowRemoteModels = false; // 只用本地模型，绝不联网
      env.allowLocalModels = true;
      env.localModelPath = '/models/'; // Vite 把 public/ 映射到根
      const wasm = env.backends?.onnx?.wasm;
      if (wasm) {
        wasm.wasmPaths = '/ort/';
        wasm.numThreads = 1; // 单线程，免去 SharedArrayBuffer/COOP-COEP 要求
      }
      return tf;
    });
  }
  return libPromise;
}

async function getModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await getLib();
      const [model, processor] = await Promise.all([
        tf.AutoModel.from_pretrained(MODEL_ID, { dtype: 'q8' }),
        tf.AutoProcessor.from_pretrained(MODEL_ID),
      ]);
      return { model, processor };
    })().catch((e) => {
      modelPromise = null; // 失败可重试
      throw e;
    });
  }
  return modelPromise;
}

/** 抠掉背景，返回透明 PNG dataURL。任何失败都抛出，调用方回退用原图。 */
export async function removeBackground(imageDataUrl: string): Promise<string> {
  const tf = await getLib();
  const { model, processor } = await getModel();

  const image = await tf.RawImage.fromURL(imageDataUrl);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  // output: [1,1,1024,1024] 前景概率；缩放回原尺寸，作为 alpha。
  const mask = await tf.RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);

  const w = image.width;
  const h = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法创建抠图上下文');

  const bitmap = await loadImage(imageDataUrl);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const frame = ctx.getImageData(0, 0, w, h);
  const px = frame.data;
  const m = mask.data; // 单通道，长度 w*h
  for (let i = 0; i < w * h; i++) px[i * 4 + 3] = m[i];
  ctx.putImageData(frame, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

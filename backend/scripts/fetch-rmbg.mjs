// 下载 RMBG-1.4 抠图模型（量化版）到前端 public/models，供 transformers.js 本地加载。
// 经 socks 代理拉取（读 backend/.env 的 socks_proxy）。可重复运行；已存在则跳过。
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SocksProxyAgent } from 'socks-proxy-agent';
import 'dotenv/config';

const PROXY = process.env.socks_proxy || process.env.SOCKS_PROXY || 'socks5://127.0.0.1:7890';
const agent = new SocksProxyAgent(PROXY);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../frontend/public/models/briaai/RMBG-1.4');

const FILES = [
  'config.json',
  'preprocessor_config.json',
  'onnx/model_quantized.onnx',
];

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const u = new URL(url);
    https
      .get({ hostname: u.hostname, path: u.pathname + u.search, agent, rejectUnauthorized: false, headers: { 'User-Agent': 'sonicraft' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http') ? res.headers.location : `https://${u.hostname}${res.headers.location}`;
          resolve(get(next, redirects + 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

const fmt = (n) => (n / 1048576).toFixed(1) + 'MB';

for (const f of FILES) {
  const dest = path.join(OUT, f);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log('skip (exists):', f);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  process.stdout.write(`downloading ${f} ... `);
  const buf = await get(`https://huggingface.co/briaai/RMBG-1.4/resolve/main/${f}`);
  fs.writeFileSync(dest, buf);
  console.log('done', fmt(buf.length));
}
console.log('RMBG model ready at', OUT);

// 把 ONNX runtime 的 wasm 从前端 node_modules 复制到 public/ort（本地加载，免连 CDN）。
const ORT_SRC = path.resolve(here, '../../frontend/node_modules/onnxruntime-web/dist');
const ORT_OUT = path.resolve(here, '../../frontend/public/ort');
const WASM = ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.wasm'];
if (fs.existsSync(ORT_SRC)) {
  fs.mkdirSync(ORT_OUT, { recursive: true });
  for (const f of WASM) {
    const src = path.join(ORT_SRC, f);
    const dst = path.join(ORT_OUT, f);
    if (fs.existsSync(dst) && fs.statSync(dst).size > 0) { console.log('skip (exists):', 'ort/' + f); continue; }
    if (fs.existsSync(src)) { fs.copyFileSync(src, dst); console.log('copied ort/' + f, fmt(fs.statSync(dst).size)); }
    else console.warn('missing ort wasm:', src);
  }
} else {
  console.warn('onnxruntime-web not found — run `npm install` in frontend first, then re-run this script.');
}

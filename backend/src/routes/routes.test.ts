import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import express from 'express';
import { imagineRouter } from './imagine.js';

describe('api route contracts', () => {
  let server: Server;
  let baseUrl = '';
  let originalToken: string | undefined;
  let originalRequest: typeof https.request;

  before(async () => {
    originalToken = process.env.HF_TOKEN;
    originalRequest = https.request;
    server = app().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test server port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (originalToken === undefined) delete process.env.HF_TOKEN;
    else process.env.HF_TOKEN = originalToken;
    https.request = originalRequest;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('POST /api/imagine rejects missing HF_TOKEN', async () => {
    delete process.env.HF_TOKEN;
    const resp = await post('/api/imagine', { prompt: '熊猫' });
    assert.equal(resp.status, 503);
  });

  it('POST /api/imagine rejects missing prompt', async () => {
    process.env.HF_TOKEN = 'test-token';
    const resp = await post('/api/imagine', {});
    assert.equal(resp.status, 400);
  });

  it('POST /api/imagine returns image bytes', async () => {
    process.env.HF_TOKEN = 'test-token';
    https.request = mockHttpsImage(new Uint8Array([1, 2, 3]), 'image/png');
    const resp = await post('/api/imagine', { prompt: '熊猫' });
    https.request = originalRequest;
    assert.equal(resp.status, 200);
    assert.match(resp.headers.get('content-type') ?? '', /image\/png/);
    assert.deepEqual(new Uint8Array(await resp.arrayBuffer()), new Uint8Array([1, 2, 3]));
  });

  it('POST /api/cutout rejects missing HF_TOKEN', async () => {
    delete process.env.HF_TOKEN;
    const resp = await post('/api/cutout', { image: 'AAAA' });
    assert.equal(resp.status, 503);
  });

  it('POST /api/cutout rejects missing image', async () => {
    process.env.HF_TOKEN = 'test-token';
    const resp = await post('/api/cutout', {});
    assert.equal(resp.status, 400);
  });

  function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
});

function app() {
  const api = express();
  api.use(express.json({ limit: '8mb' }));
  api.use('/api', imagineRouter);
  return api;
}

// 路由用 https.request（非 fetch）请求 HF，这里拦截它并模拟一段 PNG 响应。
function mockHttpsImage(bytes: Uint8Array, contentType: string, status = 200): typeof https.request {
  return ((_options: unknown, callback: (res: EventEmitter & { statusCode: number; headers: Record<string, string> }) => void) => {
    const req = new EventEmitter() as EventEmitter & {
      write: () => void;
      end: () => void;
      destroy: () => void;
    };
    req.write = () => {};
    req.destroy = () => {};
    req.end = () => {
      const res = Object.assign(new EventEmitter(), {
        statusCode: status,
        headers: { 'content-type': contentType },
      });
      callback(res); // 路由在回调里挂 data/end 监听
      process.nextTick(() => {
        res.emit('data', Buffer.from(bytes));
        res.emit('end');
      });
    };
    return req;
  }) as unknown as typeof https.request;
}

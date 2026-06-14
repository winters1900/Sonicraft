import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import express from 'express';
import { imagineRouter } from './imagine.js';

describe('api route contracts', () => {
  let server: Server;
  let baseUrl = '';
  let originalToken: string | undefined;
  let originalFetch: typeof fetch;

  before(async () => {
    originalToken = process.env.HF_TOKEN;
    originalFetch = globalThis.fetch;
    server = app().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test server port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (originalToken === undefined) delete process.env.HF_TOKEN;
    else process.env.HF_TOKEN = originalToken;
    globalThis.fetch = originalFetch;
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
    globalThis.fetch = mockImageFetch;
    const resp = await post('/api/imagine', { prompt: '熊猫' });
    assert.equal(resp.status, 200);
    assert.match(resp.headers.get('content-type') ?? '', /image\/png/);
    assert.deepEqual(new Uint8Array(await resp.arrayBuffer()), new Uint8Array([1, 2, 3]));
  });

  function post(path: string, body: unknown): Promise<Response> {
    return originalFetch(`${baseUrl}${path}`, {
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

async function mockImageFetch(): Promise<Response> {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });
}

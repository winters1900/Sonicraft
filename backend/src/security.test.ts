import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRateLimiter, isOriginAllowed, parseAllowedOrigins } from './security.js';

describe('security helpers', () => {
  it('parses CORS allowlist and denies unknown origins', () => {
    const allowed = parseAllowedOrigins('http://localhost:5173,https://voice.example.com');
    assert.equal(isOriginAllowed('http://localhost:5173', allowed), true);
    assert.equal(isOriginAllowed('https://evil.example.com', allowed), false);
  });

  it('allows same-origin/no-origin requests', () => {
    const allowed = parseAllowedOrigins('https://voice.example.com');
    assert.equal(isOriginAllowed(undefined, allowed), true);
  });

  it('rate limits repeated keys in one window', () => {
    let now = 1000;
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: () => now });
    assert.equal(limiter.check('ip:a').allowed, true);
    assert.equal(limiter.check('ip:a').allowed, true);
    assert.equal(limiter.check('ip:a').allowed, false);
    now = 2100;
    assert.equal(limiter.check('ip:a').allowed, true);
  });

});

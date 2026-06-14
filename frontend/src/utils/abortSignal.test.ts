import { describe, expect, it, vi } from 'vitest';
import { makeAbortSignal } from './abortSignal';

describe('makeAbortSignal', () => {
  it('timeoutMs 到期后 abort', async () => {
    vi.useFakeTimers();
    const scoped = makeAbortSignal(undefined, 10);
    expect(scoped.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(10);
    expect(scoped.signal.aborted).toBe(true);
    scoped.release();
    vi.useRealTimers();
  });

  it('父 signal abort 时同步 abort', () => {
    const parent = new AbortController();
    const scoped = makeAbortSignal(parent.signal, 1000);
    parent.abort();
    expect(scoped.signal.aborted).toBe(true);
    scoped.release();
  });
});

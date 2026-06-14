export interface ScopedAbortSignal {
  signal: AbortSignal;
  release: () => void;
}

export function makeAbortSignal(parent: AbortSignal | undefined, timeoutMs: number): ScopedAbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);

  if (parent?.aborted) abort();
  else parent?.addEventListener('abort', abort, { once: true });

  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abort);
    },
  };
}

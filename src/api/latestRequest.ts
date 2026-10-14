/** One cancellable read per resource. Slow replies cannot enter a newer screen or filter. */
export class LatestRequest {
  private controller: AbortController | null = null;
  private pending: Promise<any> | null = null;

  run<T>(work: (signal: AbortSignal) => Promise<T>, mode: 'reuse' | 'replace' = 'reuse'): Promise<T | undefined> {
    if (mode === 'reuse' && this.pending) return this.pending;
    this.cancel();
    const controller = this.controller = new AbortController();
    const pending = Promise.resolve().then(() => work(controller.signal)).then(
      value => this.controller === controller && !controller.signal.aborted ? value : undefined,
      error => {
        if (this.controller !== controller || controller.signal.aborted) return undefined;
        throw error;
      }
    ).finally(() => {
      if (this.pending === pending) { this.pending = null; this.controller = null; }
    });
    this.pending = pending;
    return pending;
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.pending = null;
  }
}

/** Native and web support without depending on AbortSignal.any being present. */
export function combineSignals(first: AbortSignal, second: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  first.addEventListener('abort', abort, { once: true });
  second.addEventListener('abort', abort, { once: true });
  if (first.aborted || second.aborted) abort();
  return {
    signal: controller.signal,
    cleanup: () => { first.removeEventListener('abort', abort); second.removeEventListener('abort', abort); }
  };
}

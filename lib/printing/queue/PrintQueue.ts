/**
 * Sequential print jobs with per-job timeout.
 */

export class PrintQueue {
  private queue: Array<{
    data: Uint8Array;
    resolve: () => void;
    reject: (e: unknown) => void;
  }> = [];

  private draining = false;

  constructor(
    private readonly send: (data: Uint8Array) => Promise<void>,
    private readonly timeoutMs: number,
  ) {}

  enqueue(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      let to: ReturnType<typeof setTimeout> | null = null;
      try {
        await Promise.race([
          this.send(job.data),
          new Promise<never>((_, rej) => {
            to = setTimeout(() => rej(new Error(`Print timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
          }),
        ]);
        job.resolve();
      } catch (e) {
        job.reject(e);
      } finally {
        if (to) clearTimeout(to);
      }
    }
    this.draining = false;
  }
}

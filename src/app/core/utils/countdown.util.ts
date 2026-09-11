import { signal } from '@angular/core';

/**
 * A wall-clock countdown that survives background-tab throttling.
 *
 * `setInterval` is a request, not a guarantee. A backgrounded tab clamps timers
 * to roughly one tick per second and, after a few minutes, to about one per
 * minute; a frozen or discarded tab may not fire them at all. So anything that
 * counts *ticks* (`n = n - 1`) drifts arbitrarily far behind real time and,
 * on return, shows time that has already passed.
 *
 * This stores the absolute deadline instead and derives the remainder from the
 * clock on every tick, so a skipped tick costs nothing — the next one to fire
 * recomputes the true value. It also recomputes on `visibilitychange`, so
 * refocusing the tab corrects the display immediately rather than at the next
 * (possibly long-delayed) tick.
 *
 * Note this follows the system clock, so moving the OS clock skews it.
 * `performance.now()` is monotonic but resets on reload; for a countdown whose
 * real enforcement lives on the server, wall-clock time is the right trade.
 */
export class Countdown {
  /** Whole seconds remaining; 0 once elapsed. */
  readonly seconds = signal(0);

  private endsAt = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.sync();
  };

  /** (Re)start the countdown at `seconds` from now. */
  start(seconds: number): void {
    this.stop();
    this.endsAt = Date.now() + Math.max(0, seconds) * 1000;
    this.sync();
    // Already elapsed — `sync` has published 0, so there is nothing to tick.
    if (this.seconds() === 0) return;
    this.timerId = setInterval(() => this.sync(), 1000);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Halt without changing the published value. Safe to call repeatedly. */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Halt and zero the clock — call from `ngOnDestroy`. */
  destroy(): void {
    this.stop();
    this.seconds.set(0);
  }

  /** Publish the true remainder, and self-stop once it hits zero. */
  private sync(): void {
    const left = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
    this.seconds.set(left);
    if (left === 0) this.stop();
  }
}

type Listener = () => void;

let pendingCount = 0;
let slowVisible = false;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const SLOW_THRESHOLD_MS = 2500;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeApiLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiLoadingState(): { pending: number; slow: boolean } {
  return { pending: pendingCount, slow: slowVisible };
}

export function apiRequestStarted(): void {
  pendingCount += 1;
  if (pendingCount === 1 && slowTimer == null) {
    slowTimer = setTimeout(() => {
      if (pendingCount > 0) {
        slowVisible = true;
        notify();
      }
    }, SLOW_THRESHOLD_MS);
  }
  notify();
}

export function apiRequestFinished(): void {
  pendingCount = Math.max(0, pendingCount - 1);
  if (pendingCount === 0) {
    slowVisible = false;
    if (slowTimer != null) {
      clearTimeout(slowTimer);
      slowTimer = null;
    }
  }
  notify();
}

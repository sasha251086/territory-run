export type PostRunQueue = {
  showTutorial?: boolean;
  showFirstCapture?: boolean;
  captureCells?: number;
};

const POST_RUN_QUEUE_KEY = 'territory-run-post-run-queue';

export function savePostRunQueue(queue: PostRunQueue): void {
  sessionStorage.setItem(POST_RUN_QUEUE_KEY, JSON.stringify(queue));
}

export function readPostRunQueue(): PostRunQueue | null {
  const raw = sessionStorage.getItem(POST_RUN_QUEUE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PostRunQueue;
  } catch {
    return null;
  }
}

export function clearPostRunQueue(): void {
  sessionStorage.removeItem(POST_RUN_QUEUE_KEY);
}

export function hasPostRunQueue(): boolean {
  const queue = readPostRunQueue();
  if (!queue) {
    return false;
  }
  return Boolean(queue.showTutorial || queue.showFirstCapture);
}

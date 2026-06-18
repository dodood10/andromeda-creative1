const QUEUE_KEY = "andromeda_draft_queue";

export const BATCH_CHECKLIST_EVENT = "andromeda:batch-checklist-update";

export function saveDraftQueue(ids: string[]): void {
  if (ids.length === 0) {
    localStorage.removeItem(QUEUE_KEY);
    return;
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ids));
}

/** Sincroniza localStorage com a fila do projeto (fonte de verdade no servidor). */
export function syncDraftQueueFromServer(serverIds: string[]): void {
  if (serverIds.length > 0) saveDraftQueue(serverIds);
}

/** @deprecated Use syncDraftQueueFromServer */
export function hydrateDraftQueueFromServer(serverIds: string[]): void {
  syncDraftQueueFromServer(serverIds);
}

export function loadDraftQueue(): string[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function advanceDraftQueue(currentId: string): string | null {
  const queue = loadDraftQueue();
  const idx = queue.indexOf(currentId);
  if (idx < 0) return queue[0] ?? null;
  const remaining = queue.slice(idx + 1);
  saveDraftQueue(remaining);
  return remaining[0] ?? null;
}

export function draftQueuePosition(currentId: string): { index: number; total: number } | null {
  const queue = loadDraftQueue();
  if (queue.length === 0) return null;
  const idx = queue.indexOf(currentId);
  if (idx < 0) return { index: 1, total: queue.length };
  return { index: idx + 1, total: queue.length };
}

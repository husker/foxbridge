export const SIDEBAR_WIDTH_STORAGE_KEY = "foxbridge.sidebarWidth";
export const DEFAULT_SIDEBAR_WIDTH = 220;
export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 420;

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH;

  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

export function loadSidebarWidth(): number {
  const storage = getStorage();
  if (!storage) return DEFAULT_SIDEBAR_WIDTH;

  const stored = storage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  if (!stored) return DEFAULT_SIDEBAR_WIDTH;

  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) return DEFAULT_SIDEBAR_WIDTH;

  return clampSidebarWidth(parsed);
}

export function saveSidebarWidth(width: number): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(width)));
}

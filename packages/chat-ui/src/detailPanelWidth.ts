export const DETAIL_PANEL_WIDTH_STORAGE_KEY = "foxbridge.detailPanelWidth";
export const DEFAULT_DETAIL_PANEL_WIDTH = 300;
export const MIN_DETAIL_PANEL_WIDTH = 280;
export const MAX_DETAIL_PANEL_WIDTH = 640;
export const MIN_CHAT_PANEL_WIDTH = 360;

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getMaxDetailPanelWidth(viewportWidth = window.innerWidth): number {
  return Math.max(
    MIN_DETAIL_PANEL_WIDTH,
    Math.min(MAX_DETAIL_PANEL_WIDTH, viewportWidth - MIN_CHAT_PANEL_WIDTH),
  );
}

export function clampDetailPanelWidth(width: number, viewportWidth = window.innerWidth): number {
  if (!Number.isFinite(width)) return DEFAULT_DETAIL_PANEL_WIDTH;

  const maxWidth = getMaxDetailPanelWidth(viewportWidth);
  return Math.min(maxWidth, Math.max(MIN_DETAIL_PANEL_WIDTH, Math.round(width)));
}

export function loadDetailPanelWidth(): number {
  const storage = getStorage();
  if (!storage) return clampDetailPanelWidth(DEFAULT_DETAIL_PANEL_WIDTH);

  const stored = storage.getItem(DETAIL_PANEL_WIDTH_STORAGE_KEY);
  if (!stored) return clampDetailPanelWidth(DEFAULT_DETAIL_PANEL_WIDTH);

  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) return clampDetailPanelWidth(DEFAULT_DETAIL_PANEL_WIDTH);

  return clampDetailPanelWidth(parsed);
}

export function saveDetailPanelWidth(width: number): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(DETAIL_PANEL_WIDTH_STORAGE_KEY, String(clampDetailPanelWidth(width)));
}

import type { Asset, Liability, NisabStandard, Prices } from './zakat';

const STORAGE_KEY = 'zakatApp_v3_dateAware';
const LEGACY_KEYS = ['zakatApp_real_v2', 'zakatApp_real_v1', 'zakatFinalApp_v6'];

export interface SalatLogEntry {
  performed: boolean;
  jamaat: boolean;
  sunnah?: boolean;
  witr?: boolean;
}

export interface AppLocation {
  name: string;
  coords: [number, number];
  timezone: number;
  /** IANA timezone name (e.g. 'Asia/Dhaka') — preferred over the fixed offset when available (handles DST). */
  ianaTz?: string;
  method?: string;
}

export interface TasbihDayStats {
  [dhikrId: string]: number;
}

export interface AppState {
  assets: Asset[];
  liabilities: Liability[];
  prices: Prices;
  nisabStandard: NisabStandard;
  salatLog: Record<string, Record<string, SalatLogEntry>>;
  location: AppLocation;
  pin: string | null;
  /** Google auto-sync: saved OAuth access token (session persistence). */
  googleAccessToken: string | null;
  /** Epoch ms when googleAccessToken expires (tokens live ~1h). */
  googleTokenExpiry: number | null;
  /** Signed-in Google account e-mail (display only). */
  googleEmail: string | null;
  /** ISO time of the last successful cloud sync (local clock). */
  lastSyncTime: string | null;
  /** Last sync failure code: 'auth' | 'api_disabled' | 'scope_or_api' | 'network' | null. */
  lastSyncError: string | null;
  tasbihStats: Record<string, TasbihDayStats>;
  lastBackupTime: string | null;
  theme?: 'dark' | 'light';
  currency?: string;
}

export const DEFAULT_STATE: AppState = {
  assets: [],
  liabilities: [],
  prices: { goldPerGram: 13500, silverPerGram: 165 },
  nisabStandard: 'silver',
  salatLog: {},
  location: {
    name: 'ঢাকা, বাংলাদেশ',
    coords: [23.8103, 90.4125],
    timezone: 6,
    ianaTz: 'Asia/Dhaka',
    method: 'karachi',
  },
  pin: null,
  googleAccessToken: null,
  googleTokenExpiry: null,
  googleEmail: null,
  lastSyncTime: null,
  lastSyncError: null,
  tasbihStats: {},
  lastBackupTime: null,
  theme: 'dark',
  currency: 'BDT',
};

/**
 * Normalize any (possibly partial/old) state object into a full AppState —
 * fills defaults and repairs asset/liability records. Used both by loadState
 * and by every restore path (file / paste / Google Drive) so they all behave
 * identically (fixes the restore-bypasses-normalization issue).
 */
export function normalizeState(parsed: Record<string, unknown>): AppState {
  const now = new Date().toISOString();
  const p = parsed as Partial<AppState>;

  const assets = (p.assets || []).map((asset: Partial<Asset>) => ({
    ...asset,
    id: asset.id || crypto.randomUUID?.() || String(Date.now() + Math.random()),
    label: asset.label || 'সম্পদ',
    type: asset.type || 'cash',
    value: Number(asset.value || 0),
    createdAt: asset.createdAt || now,
  })) as Asset[];

  const liabilities = (p.liabilities || []).map((liability: Partial<Liability>) => ({
    ...liability,
    id: liability.id || crypto.randomUUID?.() || String(Date.now() + Math.random()),
    label: liability.label || 'দায়',
    type: liability.type || 'other',
    amount: Number(liability.amount || 0),
    createdAt: liability.createdAt || now,
  })) as Liability[];

  return {
    ...DEFAULT_STATE,
    ...p,
    prices: { ...DEFAULT_STATE.prices, ...(p.prices || {}) },
    location: { ...DEFAULT_STATE.location, ...(p.location || {}) },
    assets,
    liabilities,
    salatLog: p.salatLog || {},
    tasbihStats: p.tasbihStats || {},
  };
}

export function loadState(): AppState {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return DEFAULT_STATE;
    return normalizeState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state', err);
  }
}

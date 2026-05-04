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
  method?: string;
}

export interface TasbihDayStats {
  [dhikrId: string]: number;
}

export interface AppState {
  assets: Asset[];                    // EACH with createdAt (ISO date)
  liabilities: Liability[];           // EACH with createdAt (ISO date)
  prices: Prices;
  nisabStandard: NisabStandard;
  salatLog: Record<string, Record<string, SalatLogEntry>>;
  location: AppLocation;
  pin: string | null;
  googleAccessToken: string | null;
  googleClientId: string | null;
  tasbihStats: Record<string, TasbihDayStats>;
  lastBackupTime: string | null;
}

export const DEFAULT_STATE: AppState = {
  assets: [],
  liabilities: [],
  prices: { goldPerGram: 13500, silverPerGram: 165 },
  nisabStandard: 'silver',
  salatLog: {},
  location: { name: 'ঢাকা, বাংলাদেশ', coords: [23.8103, 90.4125], timezone: 6 },
  pin: null,
  googleAccessToken: null,
  googleClientId: null,
  tasbihStats: {},
  lastBackupTime: null,
};

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
    const parsed = JSON.parse(raw);
    const now = new Date().toISOString();
    const assets = (parsed.assets || []).map((asset: Partial<Asset>) => ({
      ...asset,
      id: asset.id || crypto.randomUUID?.() || String(Date.now() + Math.random()),
      label: asset.label || 'সম্পদ',
      type: asset.type || 'cash',
      value: Number(asset.value || 0),
      createdAt: asset.createdAt || now,
    })) as Asset[];
    const liabilities = (parsed.liabilities || []).map((liability: Partial<Liability>) => ({
      ...liability,
      id: liability.id || crypto.randomUUID?.() || String(Date.now() + Math.random()),
      label: liability.label || 'দায়',
      type: liability.type || 'other',
      amount: Number(liability.amount || 0),
      createdAt: liability.createdAt || now,
    })) as Liability[];
    return {
      ...DEFAULT_STATE,
      ...parsed,
      prices: { ...DEFAULT_STATE.prices, ...(parsed.prices || {}) },
      location: { ...DEFAULT_STATE.location, ...(parsed.location || {}) },
      assets,
      liabilities,
      salatLog: parsed.salatLog || {},
      tasbihStats: parsed.tasbihStats || {},
    };
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

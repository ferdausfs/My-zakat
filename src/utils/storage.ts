import type { Asset, Liability, NisabStandard, Prices } from './zakat';

const STORAGE_KEY = 'zakatApp_v3_dateAware';

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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      prices: { ...DEFAULT_STATE.prices, ...(parsed.prices || {}) },
      location: { ...DEFAULT_STATE.location, ...(parsed.location || {}) },
      assets: parsed.assets || [],
      liabilities: parsed.liabilities || [],
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

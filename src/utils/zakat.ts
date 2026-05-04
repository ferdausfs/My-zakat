// ═══════════════════════════════════════════════════
// ZAKAT CALCULATION ENGINE — DATE-AWARE, FIQH-CORRECT
// ═══════════════════════════════════════════════════
// Hawl rules (Hanafi school):
// 1. Track daily balance from ALL dated transactions
// 2. Hawl starts the FIRST day balance >= nisab
// 3. If balance drops to ZERO → hawl RESETS
// 4. If balance drops below nisab but > 0 → hawl CONTINUES
// 5. After 354 lunar days → zakat is DUE on current balance

export const ZAKAT_RATE = 0.025;
export const GOLD_NISAB_GRAMS = 87.48;
export const SILVER_NISAB_GRAMS = 612.36;
export const LUNAR_YEAR_DAYS = 354;

export type AssetType =
  | 'cash' | 'bank' | 'gold' | 'silver' | 'business'
  | 'investment' | 'receivable' | 'property' | 'crypto';

export type LiabilityType = 'debt' | 'bills' | 'rent' | 'other';

export interface Asset {
  id: string;
  type: AssetType;
  label: string;
  value: number;
  createdAt: string; // ISO string
}

export interface Liability {
  id: string;
  type: LiabilityType;
  label: string;
  amount: number;
  createdAt: string;
}

export interface Prices {
  goldPerGram: number;
  silverPerGram: number;
}

export type NisabStandard = 'gold' | 'silver';

export const ASSET_META: Record<AssetType, { name: string; icon: string; unit: 'BDT' | 'GRAM'; color: string; bg: string; help: string }> = {
  cash:       { name: 'নগদ টাকা',       icon: 'fa-wallet',        unit: 'BDT',  color: 'text-emerald-400',  bg: 'bg-emerald-500/15',  help: 'হাতে থাকা নগদ অর্থ।' },
  bank:       { name: 'ব্যাংক ব্যালেন্স', icon: 'fa-building-columns', unit: 'BDT', color: 'text-sky-400', bg: 'bg-sky-500/15', help: 'সকল ব্যাংক ও মোবাইল ব্যাংকিং (bKash/Nagad)।' },
  gold:       { name: 'সোনা',            icon: 'fa-ring',          unit: 'GRAM', color: 'text-yellow-400',   bg: 'bg-yellow-500/15',   help: 'সকল সোনা — গ্রামে পরিমাণ দিন।' },
  silver:     { name: 'রূপা',            icon: 'fa-coins',         unit: 'GRAM', color: 'text-slate-300',    bg: 'bg-slate-400/15',    help: 'সকল রূপা — গ্রামে পরিমাণ দিন।' },
  business:   { name: 'ব্যবসায়িক পণ্য', icon: 'fa-store',         unit: 'BDT',  color: 'text-orange-400',   bg: 'bg-orange-500/15',   help: 'বিক্রির পণ্য (stock)। ক্রয়মূল্যে গণনা করুন।' },
  investment: { name: 'বিনিয়োগ/শেয়ার', icon: 'fa-chart-line',    unit: 'BDT',  color: 'text-violet-400',   bg: 'bg-violet-500/15',   help: 'শেয়ার, মিউচুয়াল ফান্ড, বন্ড ইত্যাদির বর্তমান বাজার মূল্য।' },
  receivable: { name: 'প্রাপ্য ঋণ',      icon: 'fa-handshake',     unit: 'BDT',  color: 'text-teal-400',     bg: 'bg-teal-500/15',     help: 'অন্যকে দেওয়া ঋণ যা ফেরত পাওয়া নিশ্চিত।' },
  property:   { name: 'ভাড়ার আয়',      icon: 'fa-house-chimney', unit: 'BDT',  color: 'text-pink-400',     bg: 'bg-pink-500/15',     help: 'ভাড়া থেকে জমাকৃত আয়। নিজের বাড়ি যাকাতমুক্ত।' },
  crypto:     { name: 'ক্রিপ্টো',        icon: 'fa-coins',         unit: 'BDT',  color: 'text-amber-400',    bg: 'bg-amber-500/15',    help: 'ক্রিপ্টো কয়েনের বর্তমান বাজার মূল্য।' },
};

export const LIABILITY_META: Record<LiabilityType, { name: string; icon: string; color: string; bg: string }> = {
  debt:   { name: 'ঋণ/দেনা',      icon: 'fa-file-invoice-dollar', color: 'text-red-400',   bg: 'bg-red-500/15' },
  bills:  { name: 'বকেয়া বিল',    icon: 'fa-receipt',             color: 'text-rose-400',  bg: 'bg-rose-500/15' },
  rent:   { name: 'বকেয়া ভাড়া',  icon: 'fa-house-user',          color: 'text-pink-400',  bg: 'bg-pink-500/15' },
  other:  { name: 'অন্যান্য দায়', icon: 'fa-circle-exclamation',  color: 'text-orange-400', bg: 'bg-orange-500/15' },
};

// ─── Breakdown result ───
export interface HawlInfo {
  status: 'no-prices' | 'no-nisab' | 'awaiting' | 'in-progress' | 'due';
  daysLeft: number;
  daysSinceStart: number;
  hawlStartDate: string | null;
  hawlDueDate: string | null;
  hawlStartHijri: string;
  hawlDueHijri: string;
  timeline: { date: string; balance: number; event: string }[];
}

export interface ZakatBreakdown {
  totalAssets: number;
  totalLiabilities: number;
  netWealth: number;
  goldNisabBDT: number;
  silverNisabBDT: number;
  effectiveNisab: number;
  meetsNisab: boolean;
  zakatDue: number;
  hasValidPrices: boolean;
  assetBreakdown: { type: AssetType; label: string; bdt: number }[];
  hawl: HawlInfo;
}

// ─── Helpers ───
function toBDT(val: number, type: AssetType, prices: Prices): number {
  if (type === 'gold') return val * (prices.goldPerGram || 0);
  if (type === 'silver') return val * (prices.silverPerGram || 0);
  return val;
}

// Local date string (avoids UTC timezone issues)
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Hijri conversion (inline) ───
const HIJRI_MONTHS = [
  "মুহররম", "সফর", "রবিউল আউয়াল", "রবিউস সানি",
  "জমাদিউল আউয়াল", "জমাদিউস সানি", "রজব", "শাবান",
  "রমজান", "শাওয়াল", "জিলকদ", "জিলহজ"
];

function toHijri(g: Date): { y: number; m: number; d: number } {
  const gd = g.getDate(), gm = g.getMonth() + 1, gy = g.getFullYear();
  let y2 = gy, m2 = gm;
  if (m2 <= 2) { y2--; m2 += 12; }
  const a = Math.floor(y2 / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (y2 + 4716)) + Math.floor(30.6001 * (m2 + 1)) + gd + b - 1524.5;
  let l = Math.floor(jd) - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) +
            (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
  l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) -
      (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
  const hm = Math.floor((24 * l) / 709);
  const hd = l - Math.floor((709 * hm) / 24);
  const hy = 30 * n + j - 30;
  return { y: hy, m: hm, d: hd };
}

function fmtHijri(h: { y: number; m: number; d: number } | null): string {
  if (!h) return '';
  return `${h.d} ${HIJRI_MONTHS[h.m - 1]}, ${h.y} হিজরি`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.ceil((db - da) / 86400000);
}

// ═══════════════════════════════════════
// MAIN CALCULATION
// ═══════════════════════════════════════
export function calculateZakat(
  assets: Asset[],
  liabilities: Liability[],
  prices: Prices,
  standard: NisabStandard
): ZakatBreakdown {
  // 1. Current totals
  const assetBreakdown = assets.map(a => ({
    type: a.type, label: a.label, bdt: toBDT(a.value, a.type, prices),
  }));
  const totalAssets = assetBreakdown.reduce((s, a) => s + a.bdt, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const netWealth = Math.max(0, totalAssets - totalLiabilities);

  const goldNisabBDT = GOLD_NISAB_GRAMS * (prices.goldPerGram || 0);
  const silverNisabBDT = SILVER_NISAB_GRAMS * (prices.silverPerGram || 0);
  const effectiveNisab = standard === 'gold' ? goldNisabBDT : silverNisabBDT;
  const hasValidPrices = (standard === 'gold' ? prices.goldPerGram : prices.silverPerGram) > 0;
  const meetsNisab = hasValidPrices && effectiveNisab > 0 && netWealth >= effectiveNisab;

  // 2. HAWL — date-aware calculation
  const todayStr = toLocalDateStr(new Date());

  // Build a map of date → net change
  // For each unique date, compute total assets and total liabilities up to that date
  const dateSet = new Set<string>();
  for (const a of assets) {
    const d = a.createdAt ? toLocalDateStr(new Date(a.createdAt)) : todayStr;
    dateSet.add(d);
  }
  for (const l of liabilities) {
    const d = l.createdAt ? toLocalDateStr(new Date(l.createdAt)) : todayStr;
    dateSet.add(d);
  }
  dateSet.add(todayStr);

  const sortedDates = [...dateSet].sort();

  // Walk through dates chronologically
  let hawlStart: string | null = null;
  let wasAboveNisab = false;
  const timeline: { date: string; balance: number; event: string }[] = [];

  for (const ds of sortedDates) {
    // Sum all assets created on or before this date
    let aSum = 0;
    for (const a of assets) {
      const ad = a.createdAt ? toLocalDateStr(new Date(a.createdAt)) : todayStr;
      if (ad <= ds) aSum += toBDT(a.value, a.type, prices);
    }
    // Sum all liabilities created on or before this date
    let lSum = 0;
    for (const l of liabilities) {
      const ld = l.createdAt ? toLocalDateStr(new Date(l.createdAt)) : todayStr;
      if (ld <= ds) lSum += l.amount;
    }

    const balance = Math.max(0, aSum - lSum);
    const aboveNisab = hasValidPrices && effectiveNisab > 0 && balance >= effectiveNisab;

    if (balance <= 0 && wasAboveNisab) {
      // Balance hit zero → hawl RESETS
      hawlStart = null;
      wasAboveNisab = false;
      timeline.push({ date: ds, balance, event: '⚠️ সম্পদ শূন্য — হাওল রিসেট' });
    } else if (aboveNisab && !wasAboveNisab) {
      // First time crossing nisab → hawl STARTS
      hawlStart = ds;
      wasAboveNisab = true;
      timeline.push({ date: ds, balance, event: '✅ নিসাব ছুঁইয়েছে — হাওল শুরু' });
    } else if (aboveNisab && wasAboveNisab) {
      // Still above nisab — hawl continues
      // Only add to timeline if it's today
      if (ds === todayStr) {
        timeline.push({ date: ds, balance, event: '📊 বর্তমান ব্যালেন্স — হাওল চলছে' });
      }
    } else if (!aboveNisab && balance > 0 && wasAboveNisab) {
      // Below nisab but above zero — Hanafi: hawl CONTINUES
      timeline.push({ date: ds, balance, event: '⬇️ নিসাবের নিচে কিন্তু হাওল চলছে (হানাফি)' });
    }
  }

  // 3. Compute hawl status
  let hawl: HawlInfo = {
    status: 'no-nisab',
    daysLeft: 0,
    daysSinceStart: 0,
    hawlStartDate: null,
    hawlDueDate: null,
    hawlStartHijri: '',
    hawlDueHijri: '',
    timeline,
  };

  if (!hasValidPrices) {
    hawl = { ...hawl, status: 'no-prices' };
  } else if (hawlStart) {
    const dueDate = addDays(hawlStart, LUNAR_YEAR_DAYS);
    const daysLeft = daysBetween(todayStr, dueDate);
    const daysSinceStart = daysBetween(hawlStart, todayStr);

    hawl = {
      status: daysLeft <= 0 ? 'due' : 'in-progress',
      daysLeft: Math.max(0, daysLeft),
      daysSinceStart,
      hawlStartDate: hawlStart,
      hawlDueDate: dueDate,
      hawlStartHijri: fmtHijri(toHijri(new Date(hawlStart + 'T12:00:00'))),
      hawlDueHijri: fmtHijri(toHijri(new Date(dueDate + 'T12:00:00'))),
      timeline,
    };
  } else if (meetsNisab) {
    // Meets nisab today but no historical start found
    hawl = {
      status: 'awaiting',
      daysLeft: LUNAR_YEAR_DAYS,
      daysSinceStart: 0,
      hawlStartDate: todayStr,
      hawlDueDate: addDays(todayStr, LUNAR_YEAR_DAYS),
      hawlStartHijri: fmtHijri(toHijri(new Date())),
      hawlDueHijri: fmtHijri(toHijri(new Date(addDays(todayStr, LUNAR_YEAR_DAYS) + 'T12:00:00'))),
      timeline,
    };
  }

  // 4. Zakat amount — only due if hawl complete AND currently above nisab
  const zakatDue = (hawl.status === 'due' && meetsNisab) ? netWealth * ZAKAT_RATE : 0;

  return {
    totalAssets, totalLiabilities, netWealth,
    goldNisabBDT, silverNisabBDT, effectiveNisab,
    meetsNisab, zakatDue, hasValidPrices,
    assetBreakdown, hawl,
  };
}

// ─── Formatting ───
export function fmtBDT(n: number): string {
  if (!isFinite(n)) return '৳ ০';
  return `৳ ${Math.round(n).toLocaleString('bn-BD')}`;
}

export function fmtBDT2(n: number): string {
  if (!isFinite(n)) return '৳ ০.০০';
  return `৳ ${n.toLocaleString('bn-BD', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

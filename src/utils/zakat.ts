import { gregorianToHijri, formatHijriDate, LUNAR_YEAR_DAYS } from './hijri';

export const ZAKAT_RATE = 0.025;
export const GOLD_NISAB_GRAMS = 87.48;
export const SILVER_NISAB_GRAMS = 612.36;

/** Single source of truth for the lunar-year length (defined in hijri.ts); integer day count for timeline math. */
const LUNAR_DAYS_INT = Math.round(LUNAR_YEAR_DAYS);

export type AssetType =
  | 'cash'
  | 'bank'
  | 'gold'
  | 'silver'
  | 'business'
  | 'investment'
  | 'receivable'
  | 'property'
  | 'crypto';

export type LiabilityType = 'debt' | 'bills' | 'rent' | 'other';

export interface Asset {
  id: string;
  type: AssetType;
  label: string;
  value: number;
  createdAt: string;
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

export const ASSET_META: Record<AssetType, { name: string; icon: string; unit: string; color: string; bg: string; help: string }> = {
  cash:       { name: 'নগদ টাকা',       icon: 'fa-wallet',            unit: 'BDT',  color: 'text-emerald-400', bg: 'bg-emerald-500/15', help: 'হাতে থাকা নগদ অর্থ।' },
  bank:       { name: 'ব্যাংক ব্যালেন্স', icon: 'fa-building-columns', unit: 'BDT',  color: 'text-sky-400',     bg: 'bg-sky-500/15',     help: 'সকল ব্যাংক ও মোবাইল ব্যাংকিং (bKash/Nagad)।' },
  gold:       { name: 'সোনা',            icon: 'fa-ring',              unit: 'GRAM', color: 'text-yellow-400',  bg: 'bg-yellow-500/15',  help: 'সকল সোনা — গ্রামে পরিমাণ দিন।' },
  silver:     { name: 'রূপা',            icon: 'fa-coins',             unit: 'GRAM', color: 'text-slate-300',   bg: 'bg-slate-400/15',   help: 'সকল রূপা — গ্রামে পরিমাণ দিন।' },
  business:   { name: 'ব্যবসায়িক পণ্য', icon: 'fa-store',             unit: 'BDT',  color: 'text-orange-400',  bg: 'bg-orange-500/15',  help: 'বিক্রির পণ্য (stock)। ক্রয়মূল্যে গণনা করুন।' },
  investment: { name: 'বিনিয়োগ/শেয়ার', icon: 'fa-chart-line',        unit: 'BDT',  color: 'text-violet-400',  bg: 'bg-violet-500/15',  help: 'শেয়ার, মিউচুয়াল ফান্ড, বন্ড ইত্যাদির বর্তমান বাজার মূল্য।' },
  receivable: { name: 'প্রাপ্য ঋণ',      icon: 'fa-handshake',         unit: 'BDT',  color: 'text-teal-400',    bg: 'bg-teal-500/15',    help: 'অন্যকে দেওয়া ঋণ যা ফেরত পাওয়া নিশ্চিত।' },
  property:   { name: 'ভাড়ার আয়',      icon: 'fa-house-chimney',     unit: 'BDT',  color: 'text-pink-400',    bg: 'bg-pink-500/15',    help: 'ভাড়া থেকে জমাকৃত আয়। নিজের বাড়ি যাকাতমুক্ত।' },
  crypto:     { name: 'ক্রিপ্টো',       icon: 'fa-bitcoin-sign',      unit: 'BDT',  color: 'text-amber-400',   bg: 'bg-amber-500/15',   help: 'ক্রিপ্টো কয়েনের বর্তমান বাজার মূল্য।' },
};

export const LIABILITY_META: Record<LiabilityType, { name: string; icon: string; color: string; bg: string }> = {
  debt:  { name: 'ঋণ/দেনা',     icon: 'fa-file-invoice-dollar', color: 'text-red-400',    bg: 'bg-red-500/15' },
  bills: { name: 'বকেয়া বিল',   icon: 'fa-receipt',              color: 'text-rose-400',   bg: 'bg-rose-500/15' },
  rent:  { name: 'বকেয়া ভাড়া', icon: 'fa-house-user',           color: 'text-pink-400',   bg: 'bg-pink-500/15' },
  other: { name: 'অন্যান্য দায়', icon: 'fa-circle-exclamation',  color: 'text-orange-400', bg: 'bg-orange-500/15' },
};

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

export function toBDT(val: number, type: AssetType, prices: Prices): number {
  if (type === 'gold') return val * (prices.goldPerGram || 0);
  if (type === 'silver') return val * (prices.silverPerGram || 0);
  return val;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtHijriOf(dateStr: string): string {
  return formatHijriDate(gregorianToHijri(new Date(dateStr + 'T12:00:00')));
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

export function calculateZakat(
  assets: Asset[],
  liabilities: Liability[],
  prices: Prices,
  standard: NisabStandard
): ZakatBreakdown {
  const assetBreakdown = assets.map(a => ({
    type: a.type,
    label: a.label,
    bdt: toBDT(a.value, a.type, prices),
  }));

  const totalAssets = assetBreakdown.reduce((s, a) => s + a.bdt, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const netWealth = Math.max(0, totalAssets - totalLiabilities);

  const goldNisabBDT = GOLD_NISAB_GRAMS * (prices.goldPerGram || 0);
  const silverNisabBDT = SILVER_NISAB_GRAMS * (prices.silverPerGram || 0);
  const effectiveNisab = standard === 'gold' ? goldNisabBDT : silverNisabBDT;
  const hasValidPrices = (standard === 'gold' ? prices.goldPerGram : prices.silverPerGram) > 0;
  const meetsNisab = hasValidPrices && effectiveNisab > 0 && netWealth >= effectiveNisab;

  const todayStr = toLocalDateStr(new Date());
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
  let hawlStart: string | null = null;
  let wasAboveNisab = false;
  const timeline: { date: string; balance: number; event: string }[] = [];

  for (const ds of sortedDates) {
    let aSum = 0;
    for (const a of assets) {
      const ad = a.createdAt ? toLocalDateStr(new Date(a.createdAt)) : todayStr;
      if (ad <= ds) aSum += toBDT(a.value, a.type, prices);
    }
    let lSum = 0;
    for (const l of liabilities) {
      const ld = l.createdAt ? toLocalDateStr(new Date(l.createdAt)) : todayStr;
      if (ld <= ds) lSum += l.amount;
    }
    const balance = Math.max(0, aSum - lSum);
    const aboveNisab = hasValidPrices && effectiveNisab > 0 && balance >= effectiveNisab;

    if (balance === 0) {
      hawlStart = null;
      wasAboveNisab = false;
      if (assets.length > 0 || liabilities.length > 0) {
        timeline.push({ date: ds, balance, event: '🔴 সম্পদ শূন্য — হাওল রিসেট' });
      }
    } else if (aboveNisab && !wasAboveNisab) {
      hawlStart = ds;
      wasAboveNisab = true;
      timeline.push({ date: ds, balance, event: '🟢 নিসাব পূর্ণ — হাওল শুরু' });
    } else if (!aboveNisab && balance > 0 && wasAboveNisab) {
      timeline.push({ date: ds, balance, event: '⬇️ নিসাবের নিচে কিন্তু হাওল চলছে (হানাফি)' });
    }
  }

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
    const dueDate = addDays(hawlStart, LUNAR_DAYS_INT);
    const daysLeft = daysBetween(todayStr, dueDate);
    const daysSinceStart = daysBetween(hawlStart, todayStr);
    hawl = {
      status: daysLeft <= 0 ? 'due' : 'in-progress',
      daysLeft: Math.max(0, daysLeft),
      daysSinceStart,
      hawlStartDate: hawlStart,
      hawlDueDate: dueDate,
      hawlStartHijri: fmtHijriOf(hawlStart),
      hawlDueHijri: fmtHijriOf(dueDate),
      timeline,
    };
  } else if (meetsNisab) {
    hawl = {
      status: 'awaiting',
      daysLeft: LUNAR_DAYS_INT,
      daysSinceStart: 0,
      hawlStartDate: todayStr,
      hawlDueDate: addDays(todayStr, LUNAR_DAYS_INT),
      hawlStartHijri: fmtHijriOf(todayStr),
      hawlDueHijri: fmtHijriOf(addDays(todayStr, LUNAR_DAYS_INT)),
      timeline,
    };
  }

  const zakatDue = (hawl.status === 'due' && meetsNisab) ? netWealth * ZAKAT_RATE : 0;

  return {
    totalAssets, totalLiabilities, netWealth,
    goldNisabBDT, silverNisabBDT, effectiveNisab,
    meetsNisab, zakatDue, hasValidPrices,
    assetBreakdown, hawl,
  };
}

export function fmtBDT(n: number): string {
  if (!isFinite(n)) return '৳ ০';
  return `৳ ${Math.round(n).toLocaleString('bn-BD')}`;
}

export function fmtBDT2(n: number): string {
  if (!isFinite(n)) return '৳ ০.০০';
  return `৳ ${n.toLocaleString('bn-BD', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

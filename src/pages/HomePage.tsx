import { useMemo, useState, useEffect } from 'react';
import { gregorianToHijri, formatHijriDate } from '../utils/hijri';
import {
  calcPrayerTimes, PRAYER_NAMES_BN, getZoneOffsetHours, nowInOffset,
  type PrayerKey, type PrayerTimes,
} from '../utils/prayerTimes';
import { calculateZakat, fmtBDT, fmtBDT2 } from '../utils/zakat';
import type { Asset, Liability, Prices, NisabStandard } from '../utils/zakat';
import type { AppLocation } from '../utils/storage';

/** Home — Prayer-Times-style landing: big next prayer + list + zakat mini. */
interface Props {
  location: AppLocation;
  assets: Asset[];
  liabilities: Liability[];
  prices: Prices;
  nisabStandard: NisabStandard;
  onNavigate: (page: string) => void;
}

function timeAt(times: PrayerTimes, k: string): string {
  return (times as unknown as Record<string, string>)[k];
}

function parseTime24(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const PRAYER_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
const PRAYER_EN: Record<string, string> = {
  fajr: 'Fajr', sunrise: 'Shuruq', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
};

export function HomePage({ location, assets, liabilities, prices, nisabStandard, onNavigate }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const hijri = useMemo(() => {
    try { return formatHijriDate(gregorianToHijri(now)); } catch { return ''; }
  }, [now]);

  const coords = location.coords ?? [23.8103, 90.4125];
  const lat = coords[0];
  const lng = coords[1];
  const tz = location.timezone ?? 6;
  const offsetHours = location.ianaTz ? (getZoneOffsetHours(location.ianaTz, now) ?? tz) : tz;

  const { times, next, current, countdownLabel } = useMemo(() => {
    const res = calcPrayerTimes(now, lat, lng, offsetHours, location.method || 'karachi');
    const times = res.formatted;
    const cityNow = nowInOffset(offsetHours, now);
    const nowMins = cityNow.minutes;
    let nextKey: PrayerKey = 'fajr';
    let curKey: string = PRAYER_ORDER[0];
    for (const k of PRAYER_ORDER) {
      const raw = timeAt(times, k);
      if (!raw || raw === '--:--') continue;
      if (parseTime24(raw) <= nowMins) curKey = k;
      if (parseTime24(raw) > nowMins) { nextKey = k as PrayerKey; break; }
    }
    let mins = parseTime24(timeAt(times, nextKey)) - nowMins;
    if (mins <= 0) mins += 1440;
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const label = hh > 0
      ? `${hh.toLocaleString('bn-BD')} ঘ ${mm.toLocaleString('bn-BD')} মি`
      : `${mm.toLocaleString('bn-BD')} মিনিট`;
    return { times, next: nextKey, current: curKey, countdownLabel: label };
  }, [now, lat, lng, offsetHours, location.method]);

  const zk = useMemo(() => {
    try { return calculateZakat(assets, liabilities, prices, nisabStandard); }
    catch { return null; }
  }, [assets, liabilities, prices, nisabStandard]);

  const zkStatus = zk?.hawl.status ?? 'no-nisab';
  const zkDue = zkStatus === 'due' && zk ? fmtBDT2(zk.zakatDue) : zk ? fmtBDT(zk.netWealth) : fmtBDT(0);
  const progressPct = zk?.hawl.status === 'in-progress'
    ? Math.min(100, Math.round(((zk.hawl as { progressDays?: number }).progressDays ?? 0) / 354 * 100))
    : zkStatus === 'due' ? 100 : 0;
  const zkStat = zkStatus === 'due' ? 'যাকাত প্রদেয়' : zkStatus === 'in-progress' ? `হাওল ${progressPct}%` : 'নিসাবের নিচে';

  return (
    <div className="fade-in">
      <div className="pt-topbar">
        <div className="pt-loc"><span className="pin">●</span><b>{location.name || 'ঢাকা'}</b></div>
        <div className="pt-topbtn">☰</div>
      </div>

      {/* Prayer hero */}
      <div className="pt-hero">
        <div className="now-lbl">পরবর্তী নামাজ</div>
        <div className="now-name">{PRAYER_NAMES_BN[next] || next}</div>
        <div className="now-time">{timeAt(times, next) || '--:--'}</div>
        <div className="now-count">আর <b>{countdownLabel}</b> বাকি</div>
        <div className="date-row">
          <span>{now.toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="sep" />
          <span className="hijri">{hijri}</span>
        </div>
      </div>

      {/* Prayer list */}
      <div className="pt-list">
        {PRAYER_ORDER.map(k => {
          const isNext = k === next;
          const isNow = k === current;
          return (
            <div key={k} className={`pl-row ${isNext ? 'next' : ''} ${isNow ? 'now' : ''}`}>
              <div className="nm" style={isNow ? { color: 'var(--primary)' } : undefined}>
                {PRAYER_NAMES_BN[k] || k} <span className="en">{PRAYER_EN[k]}</span>
              </div>
              <div className="tm" style={isNow ? { color: 'var(--primary)' } : undefined}>
                {timeAt(times, k) || '--:--'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zakat mini */}
      <div className="zk-mini" onClick={() => onNavigate('zakat')}>
        <div>
          <div className="l">যাকাত</div>
          <div className="v">{zkDue}</div>
          <div className="s">{zkStat}</div>
          <div className="bar"><i data-w={progressPct} /></div>
        </div>
        <div className="arr">›</div>
      </div>

      {/* Quick grid — ALL features reachable (সালাত/যাকাত/তাসবীহ/দোয়া/কিবলা/হিজরি) */}
      <div className="pt-grid">
        <div className="pt-two-card" onClick={() => onNavigate('salat')}>
          <div className="qi">◐</div><div className="qn">সালাত</div><div className="qs">টাইমস + লগ</div>
        </div>
        <div className="pt-two-card" onClick={() => onNavigate('zakat')}>
          <div className="qi">◇</div><div className="qn">যাকাত</div><div className="qs">হিসাব + হাওল</div>
        </div>
        <div className="pt-two-card" onClick={() => onNavigate('tasbih')}>
          <div className="qi">✦</div><div className="qn">তাসবীহ</div><div className="qs">জিকর কাউন্টার</div>
        </div>
        <div className="pt-two-card" onClick={() => onNavigate('dua')}>
          <div className="qi">☾</div><div className="qn">দোয়া</div><div className="qs">সংকলন</div>
        </div>
        <div className="pt-two-card" onClick={() => onNavigate('qibla')}>
          <div className="qi">⌖</div><div className="qn">কিবলা</div><div className="qs">কম্পাস</div>
        </div>
        <div className="pt-two-card" onClick={() => onNavigate('hijri')}>
          <div className="qi">☀</div><div className="qn">হিজরি</div><div className="qs">ক্যালেন্ডার</div>
        </div>
      </div>
    </div>
  );
}

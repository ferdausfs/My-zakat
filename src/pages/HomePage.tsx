import { useMemo, useState, useEffect } from 'react';
import { gregorianToHijri, formatHijriDate } from '../utils/hijri';
import {
  calcPrayerTimes, PRAYER_NAMES_BN, LOGGABLE_PRAYERS, getZoneOffsetHours, nowInOffset,
  type PrayerKey, type PrayerTimes,
} from '../utils/prayerTimes';
import { calculateZakat, fmtBDT, fmtBDT2 } from '../utils/zakat';
import type { Asset, Liability, Prices, NisabStandard } from '../utils/zakat';
import type { AppLocation, SalatLogEntry } from '../utils/storage';

/** Home — Premium Minimal landing: next prayer + zakat summary + weekly salat. */
interface Props {
  location: AppLocation;
  salatLog: Record<string, Record<string, SalatLogEntry>>;
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

export function HomePage({ location, salatLog, assets, liabilities, prices, nisabStandard, onNavigate }: Props) {
  const [now, setNow] = useState(() => new Date());

  // live countdown tick (every 15s enough for minutes display)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const hijri = useMemo(() => {
    try {
      const g = gregorianToHijri(now);
      return formatHijriDate(g);
    } catch { return ''; }
  }, [now]);

  const coords = location.coords ?? [23.8103, 90.4125];
  const lat = coords[0];
  const lng = coords[1];
  const tz = location.timezone ?? 6;
  const offsetHours = location.ianaTz ? (getZoneOffsetHours(location.ianaTz, now) ?? tz) : tz;

  const { times, next, countdownLabel } = useMemo(() => {
    const res = calcPrayerTimes(now, lat, lng, offsetHours, location.method || 'karachi');
    const times = res.formatted;
    const cityNow = nowInOffset(offsetHours, now);
    const nowMins = cityNow.minutes;
    const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
    let nextKey: PrayerKey | null = null;
    for (const k of order) {
      const raw = timeAt(times, k);
      if (!raw || raw === '--:--') continue;
      if (parseTime24(raw) > nowMins) { nextKey = k; break; }
    }
    if (!nextKey) nextKey = 'fajr'; // past isha → tomorrow fajr
    let mins = parseTime24(timeAt(times, nextKey)) - nowMins;
    if (mins <= 0) mins += 1440;
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return {
      times,
      next: nextKey,
      countdownLabel: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    };
  }, [now, lat, lng, offsetHours, location.method]);

  // weekly salat summary (last 7 days, count logged prayers)
  const week = useMemo(() => {
    const out: { label: string; count: number; max: number }[] = [];
    const today = now;
    const bnDays = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = salatLog[key] || {};
      let count = 0;
      for (const k of LOGGABLE_PRAYERS) if (day[k]) count++;
      out.push({ label: bnDays[d.getDay()], count, max: LOGGABLE_PRAYERS.length });
    }
    return out;
  }, [salatLog, now]);

  const zk = useMemo(() => {
    try { return calculateZakat(assets, liabilities, prices, nisabStandard); }
    catch { return null; }
  }, [assets, liabilities, prices, nisabStandard]);

  const zkStatus = zk?.hawl.status ?? 'no-nisab';
  const progressPct = zk?.hawl.status === 'in-progress'
    ? Math.min(100, Math.round(((zk.hawl as { progressDays?: number }).progressDays ?? 0) / 354 * 100))
    : zkStatus === 'due' ? 100 : 0;

  const salatDoneToday = useMemo(() => {
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const day = salatLog[key] || {};
    return LOGGABLE_PRAYERS.filter(k => day[k]).length;
  }, [salatLog, now]);

  const quick = [
    { key: 'zakat', icon: 'fa-shield-halved', label: 'যাকাত', cls: 'color:#E3B23C;background:rgba(227,178,60,.12)' },
    { key: 'salat', icon: 'fa-mosque', label: 'সালাত', cls: 'color:#34D399;background:rgba(52,211,153,.12)' },
    { key: 'tasbih', icon: 'fa-hands-praying', label: 'তাসবীহ', cls: 'color:#A5B4FC;background:rgba(129,140,248,.14)' },
    { key: 'dua', icon: 'fa-book-quran', label: 'দোয়া', cls: 'color:#E879F9;background:rgba(217,70,239,.12)' },
  ];

  return (
    <div className="fade-in">
      {/* Next prayer hero */}
      <div className="home-hero">
        <div className="geo-bg" />
        <div className="hh-top">
          <span className="hh-lbl">পরবর্তী নামাজ</span>
          <span className="hh-hijri">{hijri}</span>
        </div>
        <div className="hh-body">
          <div className="hh-ring">
            <svg width="76" height="76">
              <circle cx="38" cy="38" r="32" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
              <circle className="hh-arc" cx="38" cy="38" r="32" fill="none" stroke="#34D399" strokeWidth="5"
                strokeLinecap="round" strokeDasharray="201" strokeDashoffset="201" />
            </svg>
            <div className="hh-val">{countdownLabel}<small>বাকি</small></div>
          </div>
          <div className="hh-txt">
            <div className="hh-n">{PRAYER_NAMES_BN[next] || next}</div>
            <div className="hh-t">{timeAt(times, next) || '--:--'}</div>
            <div className="hh-w">
              {LOGGABLE_PRAYERS.map(k => `${PRAYER_NAMES_BN[k] || k} ${timeAt(times, k) || '--'}`).join(' · ')}
            </div>
          </div>
        </div>
        <div className="hh-foot"><b>●</b> {location.name || 'ঢাকা'} · {location.method ? location.method.toUpperCase() + ' method' : 'Karachi method'} · {offsetHours >= 0 ? '+' : ''}{offsetHours} GMT</div>
      </div>

      {/* Quick actions */}
      <div className="quick-grid">
        {quick.map(q => (
          <button key={q.key} className="q-item" onClick={() => onNavigate(q.key)}>
            <div className="qi" style={{ ...(q.cls.split(';').reduce((acc, s) => {
              const [k, v] = s.split(':');
              if (k && v !== undefined) (acc as Record<string, string>)[k.trim()] = v.trim();
              return acc;
            }, {} as Record<string, string>)) }}>
              <i className={`fas ${q.icon}`} />
            </div>
            <div className="qn">{q.label}</div>
          </button>
        ))}
      </div>

      {/* Zakat summary */}
      <div className="zk-hero" onClick={() => onNavigate('zakat')} style={{ cursor: 'pointer' }}>
        <div className="zk-top">
          <span className="zk-lbl">যাকাত</span>
          <span className="zk-stat">আজকের সালাত {salatDoneToday}/{LOGGABLE_PRAYERS.length}</span>
        </div>
        <div className="zk-due">
          {zkStatus === 'due' && zk ? fmtBDT2(zk.zakatDue) : zk ? fmtBDT(zk.netWealth) : fmtBDT(0)}
          <small>{zkStatus === 'due' ? ' · যাকাত প্রদেয়' : ' · নেট সম্পদ'}</small>
        </div>
        <div className="hawl-bar"><i data-w={progressPct} /></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <span className={zkStatus === 'due' ? 'pill pill-gold' : 'pill pill-em'}>
            {zkStatus === 'due' ? 'নিসাব অতিক্রান্ত ✓' : zkStatus === 'in-progress' ? 'হাওল চলছে' : 'নিসাবের নিচে'}
          </span>
          {zkStatus === 'due' && zk && (
            <span className="pill pill-gold">হাওল সম্পূর্ণ</span>
          )}
        </div>
      </div>

      {/* Weekly salat */}
      <div className="card">
        <div className="card-title"><i className="fas fa-mosque" /> এই সপ্তাহের সালাত</div>
        <div className="week-dots">
          {week.map(w => (
            <div className="wday" key={w.label}>
              <div className="wd-bar" style={{ height: `${6 + (w.count / w.max) * 16}px`, background: w.count === w.max
                ? 'linear-gradient(180deg, rgba(52,211,153,.5), rgba(52,211,153,.12))'
                : w.count > 0
                  ? 'linear-gradient(180deg, rgba(227,178,60,.5), rgba(227,178,60,.15))'
                  : 'rgba(255,255,255,.05)' }} />
              <div className="wd-l">{w.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

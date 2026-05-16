import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { gregorianToHijri, formatHijriDate, getAdjustedDateForHijri } from '../utils/hijri';
import {
  calcPrayerTimes, PRAYER_NAMES_BN, LOGGABLE_PRAYERS, POPULAR_LOCATIONS,
  type PrayerKey, type PrayerTimes
} from '../utils/prayerTimes';
import type { AppLocation, SalatLogEntry } from '../utils/storage';

interface Props {
  location: AppLocation;
  salatLog: Record<string, Record<string, SalatLogEntry>>;
  onUpdateLog: (dateISO: string, prayerKey: PrayerKey, entry: SalatLogEntry) => void;
  onChangeLocation: (loc: AppLocation) => void;
  showToast: (msg: string) => void;
}

const PRAYER_ICONS: Record<string, string> = {
  fajr: 'fa-moon', sunrise: 'fa-sun', dhuhr: 'fa-sun', asr: 'fa-cloud-sun', maghrib: 'fa-sunset', isha: 'fa-star',
};

const PRAYER_COLORS: Record<string, string> = {
  fajr: 'text-indigo-300', sunrise: 'text-orange-300', dhuhr: 'text-yellow-300', asr: 'text-sky-300', maghrib: 'text-rose-300', isha: 'text-violet-300',
};

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseTime24(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getNextPrayer(times: PrayerTimes): string {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (const k of order) {
    const raw = (times as unknown as Record<string, string>)[k];
    if (!raw || raw === '--:--') continue;
    const t = parseTime24(raw);
    if (t > currentMins) return k;
  }
  return 'fajr';
}

function getCurrentPrayer(times: PrayerTimes): string {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  let current = order[0];
  for (const k of order) {
    const raw = (times as unknown as Record<string, string>)[k];
    if (!raw || raw === '--:--') continue;
    if (parseTime24(raw) <= currentMins) current = k;
  }
  return current;
}

// ─── Log Modal ───
function SalatLogModal({ prayerKey, existing, onSave }: {
  prayerKey: PrayerKey;
  existing?: SalatLogEntry;
  onSave: (entry: SalatLogEntry) => void;
  onClose?: () => void;
}) {
  const [performed, setPerformed] = useState(existing?.performed ?? false);
  const [jamaat, setJamaat] = useState(existing?.jamaat ?? false);
  const [sunnah, setSunnah] = useState(existing?.sunnah ?? false);
  const [witr, setWitr] = useState(existing?.witr ?? false);

  const hasSunnah = ['fajr', 'dhuhr', 'isha'].includes(prayerKey);
  const hasWitr = prayerKey === 'isha';

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{PRAYER_NAMES_BN[prayerKey]}</p>
        <p className="text-sm text-gray-400">সালাতের তথ্য লিখুন</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center justify-between p-4 rounded-xl bg-white/4 border border-white/8 cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <i className="fas fa-check text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">ফরজ আদায় হয়েছে</p>
              <p className="text-xs text-gray-400">সালাত সম্পন্ন করেছেন?</p>
            </div>
          </div>
          <input type="checkbox" checked={performed} onChange={e => { setPerformed(e.target.checked); if (!e.target.checked) { setJamaat(false); setSunnah(false); setWitr(false); } }} />
        </label>

        {performed && (
          <>
            <label className="flex items-center justify-between p-4 rounded-xl bg-white/4 border border-white/8 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <i className="fas fa-people-group text-sky-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">জামাতে আদায়</p>
                  <p className="text-xs text-gray-400">মসজিদে জামাতে পড়েছেন?</p>
                </div>
              </div>
              <input type="checkbox" checked={jamaat} onChange={e => setJamaat(e.target.checked)} />
            </label>

            {hasSunnah && (
              <label className="flex items-center justify-between p-4 rounded-xl bg-white/4 border border-white/8 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <i className="fas fa-star text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">সুন্নাত আদায়</p>
                    <p className="text-xs text-gray-400">সুন্নাত নামাজও পড়েছেন?</p>
                  </div>
                </div>
                <input type="checkbox" checked={sunnah} onChange={e => setSunnah(e.target.checked)} />
              </label>
            )}

            {hasWitr && (
              <label className="flex items-center justify-between p-4 rounded-xl bg-white/4 border border-white/8 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <i className="fas fa-moon text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">বিতর আদায়</p>
                    <p className="text-xs text-gray-400">বিতর নামাজ পড়েছেন?</p>
                  </div>
                </div>
                <input type="checkbox" checked={witr} onChange={e => setWitr(e.target.checked)} />
              </label>
            )}
          </>
        )}
      </div>

      <button
        className="btn btn-primary"
        onClick={() => onSave({ performed, jamaat, sunnah, witr })}
      >
        <i className="fas fa-check" />সংরক্ষণ করুন
      </button>
    </div>
  );
}

// ─── Weekly Calendar ───
function WeeklyCalendar({ salatLog }: { salatLog: Record<string, Record<string, SalatLogEntry>> }) {
  const days = useMemo(() => {
    const arr = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDateKey(d);
      const dayLog = salatLog[key] || {};
      const performed = LOGGABLE_PRAYERS.filter(p => dayLog[p]?.performed).length;
      arr.push({ date: d, key, performed });
    }
    return arr;
  }, [salatLog]);

  const dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

  return (
    <div className="card" style={{ padding: '12px' }}>
      <p className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1">
        <i className="fas fa-calendar-week text-indigo-400" />গত ৭ দিনের সালাত
      </p>
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, performed }) => {
          const isToday = formatDateKey(date) === formatDateKey(new Date());
          const pct = (performed / 5) * 100;
          const color = pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-sky-500' : pct >= 20 ? 'bg-amber-500' : 'bg-gray-700';
          return (
            <div key={date.toISOString()} className="flex flex-col items-center gap-1">
              <span className={`text-[10px] ${isToday ? 'text-indigo-400 font-bold' : 'text-gray-500'}`}>
                {dayNames[date.getDay()]}
              </span>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${color} ${isToday ? 'border-indigo-400' : 'border-transparent'}`}
              >
                {performed}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />৫/৫</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />৩-৪</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />১-২</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-700 inline-block" />০</span>
      </div>
    </div>
  );
}

export function SalatPage({ location, salatLog, onUpdateLog, onChangeLocation, showToast }: Props) {
  const [logModal, setLogModal] = useState<{ open: boolean; prayer?: PrayerKey }>({ open: false });
  const [locModal, setLocModal] = useState(false);
  const [showQibla, setShowQibla] = useState(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showWeekly, setShowWeekly] = useState(false);

  // Update clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const hijriToday = useMemo(() => gregorianToHijri(getAdjustedDateForHijri(today)), [today]);

  const times = useMemo(() => calcPrayerTimes(
    today,
    location.coords[0],
    location.coords[1],
    location.timezone,
    location.method || 'karachi',
  ), [today, location]);

  const prayerKeys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  const nextKey = useMemo(() => getNextPrayer(times.raw), [times]);
  const currentKey = useMemo(() => getCurrentPrayer(times.raw), [times]);

  const todayLog = useMemo(() => salatLog[todayKey] || {}, [salatLog, todayKey]);
  const performedCount = LOGGABLE_PRAYERS.filter(k => todayLog[k]?.performed).length;
  const jamaatCount = LOGGABLE_PRAYERS.filter(k => todayLog[k]?.jamaat).length;

  // Next prayer time countdown
  const nextTimeRaw = (times.raw as unknown as Record<string, string>)[nextKey];
  const nextPrayerCountdown = useMemo(() => {
    if (!nextTimeRaw || nextTimeRaw === '--:--') return '';
    const [h, m] = nextTimeRaw.split(':').map(Number);
    const now = currentTime;
    const prayerDate = new Date(now);
    prayerDate.setHours(h, m, 0, 0);
    if (prayerDate < now) prayerDate.setDate(prayerDate.getDate() + 1);
    const diff = prayerDate.getTime() - now.getTime();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hrs > 0) return `${hrs}ঘ ${mins}মি`;
    return `${mins} মিনিট`;
  }, [nextTimeRaw, currentTime]);

  // Qibla
  const qiblaBearing = useMemo(() => {
    const lat1 = location.coords[0] * Math.PI / 180;
    const lng1 = location.coords[1] * Math.PI / 180;
    const lat2 = 21.4225 * Math.PI / 180;
    const lng2 = 39.8262 * Math.PI / 180;
    const dLng = lng2 - lng1;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return Math.round((bearing + 360) % 360);
  }, [location]);

  const qiblaRotation = compassHeading !== null ? (qiblaBearing - compassHeading + 360) % 360 : qiblaBearing;

  const qiblaDirection = useMemo(() => {
    const dirs = ['উত্তর', 'উত্তর-পূর্ব', 'পূর্ব', 'দক্ষিণ-পূর্ব', 'দক্ষিণ', 'দক্ষিণ-পশ্চিম', 'পশ্চিম', 'উত্তর-পশ্চিম'];
    return dirs[Math.round(qiblaBearing / 45) % 8];
  }, [qiblaBearing]);

  const handleCompass = useCallback(() => {
    setShowQibla(v => !v);
    const DeviceOrientationEvent = (window as unknown as Record<string, unknown>)['DeviceOrientationEvent'] as { requestPermission?: () => Promise<string> } | undefined;
    if (DeviceOrientationEvent?.requestPermission) {
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === 'granted') {
          window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
            if (e.alpha !== null) setCompassHeading(e.alpha);
          });
        }
      }).catch(() => {});
    } else {
      window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
        if (e.alpha !== null) setCompassHeading(e.alpha);
      }, { once: false });
    }
  }, []);

  return (
    <div className="px-4 pt-5 space-y-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gradient-text">সালাত ও কিবলা</h1>
          <p className="text-xs text-gray-400 mt-0.5">{formatHijriDate(hijriToday)}</p>
        </div>
        <button
          onClick={() => setLocModal(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition"
        >
          <i className="fas fa-location-dot text-indigo-400" />
          <span className="max-w-20 truncate">{location.name.split(',')[0]}</span>
        </button>
      </div>

      {/* Next Prayer Card */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))', padding: '20px' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">পরবর্তী ওয়াক্ত</p>
              <p className="text-2xl font-extrabold" style={{ color: 'var(--primary)' }}>{PRAYER_NAMES_BN[nextKey]}</p>
              <p className="text-lg font-bold text-white mt-1">{(times.formatted as unknown as Record<string, string>)[nextKey]}</p>
              {nextPrayerCountdown && (
                <p className="text-xs text-gray-400 mt-1">
                  <i className="fas fa-clock mr-1" />আর {nextPrayerCountdown} পরে
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">আজ আদায়</p>
              <p className="text-4xl font-extrabold text-emerald-400">{performedCount}</p>
              <p className="text-xs text-gray-500">/ ৫ ওয়াক্ত</p>
              <p className="text-xs text-sky-400 mt-1">
                <i className="fas fa-people-group mr-1" />{jamaatCount} জামাতে
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(performedCount / 5) * 100}%`, background: 'linear-gradient(90deg, #818cf8, #34d399)' }}
            />
          </div>
        </div>
      </div>

      {/* Weekly toggle */}
      <button
        onClick={() => setShowWeekly(v => !v)}
        className="btn btn-secondary text-sm"
      >
        <i className={`fas fa-calendar-week`} />
        {showWeekly ? 'সাপ্তাহিক রিপোর্ট লুকান' : 'সাপ্তাহিক রিপোর্ট দেখুন'}
      </button>
      {showWeekly && <WeeklyCalendar salatLog={salatLog} />}

      {/* Qibla */}
      <button
        onClick={handleCompass}
        className={`btn ${showQibla ? 'btn-primary' : 'btn-secondary'} text-sm`}
      >
        <i className="fas fa-compass" />
        {showQibla ? 'কিবলা লুকান' : 'কিবলা দেখুন'}
      </button>

      {showQibla && (
        <div className="card text-center">
          <div className="relative w-40 h-40 mx-auto mb-4">
            {/* Compass ring */}
            <svg className="w-full h-full" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="76" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(129,140,248,0.2)" strokeWidth="1" strokeDasharray="4 6" />
              {/* Direction letters */}
              <text x="80" y="16" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">উ</text>
              <text x="148" y="84" textAnchor="middle" fill="#94a3b8" fontSize="10">পূ</text>
              <text x="80" y="152" textAnchor="middle" fill="#94a3b8" fontSize="10">দ</text>
              <text x="12" y="84" textAnchor="middle" fill="#94a3b8" fontSize="10">প</text>
              {/* North arrow */}
              <line x1="80" y1="80" x2="80" y2="24" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
              <polygon points="80,18 76,28 84,28" fill="#818cf8" />
            </svg>
            {/* Kaaba pointer */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `rotate(${qiblaRotation}deg)`, transformOrigin: 'center', transition: 'transform 0.5s ease' }}
            >
              <div className="relative w-full h-full">
                <div className="absolute left-1/2 -translate-x-1/2 top-2 flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50" />
                  <div className="w-0.5 h-16 bg-gradient-to-b from-emerald-400 to-transparent" />
                </div>
              </div>
            </div>
            {/* Center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🕋</span>
            </div>
          </div>
          <p className="text-sm font-bold text-emerald-300">কিবলা: {qiblaDirection} দিকে</p>
          <p className="text-xs text-gray-400 mt-1">উত্তর থেকে {qiblaBearing}° ঘড়ির কাটার দিকে</p>
          {compassHeading !== null && <p className="text-xs text-indigo-400 mt-1"><i className="fas fa-mobile-alt mr-1" />কম্পাস সক্রিয়</p>}
        </div>
      )}

      {/* Prayer times list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="p-4 border-b border-white/5">
          <p className="font-bold text-sm flex items-center gap-2">
            <i className="fas fa-mosque text-indigo-400" />আজকের নামাজের সময়
          </p>
        </div>
        <div className="divide-y divide-white/5">
          {prayerKeys.map(k => {
            const isLoggable = LOGGABLE_PRAYERS.includes(k as PrayerKey);
            const log = todayLog[k as PrayerKey];
            const isCurrent = k === currentKey;
            const isNext = k === nextKey;

            return (
              <div
                key={k}
                className={`flex items-center gap-3 px-4 py-3 transition ${isCurrent ? 'bg-indigo-500/8' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${PRAYER_COLORS[k]} bg-white/5 flex-shrink-0`}>
                  <i className={`fas ${PRAYER_ICONS[k]} text-sm`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm ${isCurrent ? 'text-indigo-300' : ''}`}>{PRAYER_NAMES_BN[k]}</p>
                    {isNext && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">পরবর্তী</span>}
                  </div>
                  <p className="text-xs text-gray-400 tabular-nums">{(times.formatted as unknown as Record<string, string>)[k]}</p>
                </div>
                {isLoggable && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {log?.performed && (
                      <div className="flex gap-1">
                        <span className="text-emerald-400 text-xs"><i className="fas fa-check" /></span>
                        {log.jamaat && <span className="text-sky-400 text-xs"><i className="fas fa-people-group" /></span>}
                        {log.sunnah && <span className="text-amber-400 text-xs"><i className="fas fa-star" /></span>}
                      </div>
                    )}
                    <button
                      onClick={() => setLogModal({ open: true, prayer: k as PrayerKey })}
                      className={`ml-1 w-8 h-8 rounded-lg flex items-center justify-center text-xs transition ${
                        log?.performed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500 hover:text-indigo-400'
                      }`}
                    >
                      <i className={`fas ${log?.performed ? 'fa-pen' : 'fa-plus'}`} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quran quote */}
      <div className="card text-center" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.15)' }}>
        <p className="text-xs text-indigo-300 italic">
          "নিশ্চয়ই সালাত অশ্লীল ও মন্দ কাজ থেকে বিরত রাখে।"
        </p>
        <p className="text-[10px] text-gray-500 mt-1">— সূরা আল-আনকাবূত, আয়াত: ৪৫</p>
      </div>

      {/* Log Modal */}
      {logModal.prayer && (
        <Modal open={logModal.open} onClose={() => setLogModal({ open: false })} title="সালাত লগ">
          <SalatLogModal
            prayerKey={logModal.prayer}
            existing={todayLog[logModal.prayer]}
            onSave={entry => {
              onUpdateLog(todayKey, logModal.prayer!, entry);
              showToast(`${PRAYER_NAMES_BN[logModal.prayer!]} সালাত লগ সেভ হয়েছে ✅`);
              setLogModal({ open: false });
            }}
            onClose={() => setLogModal({ open: false })}
          />
        </Modal>
      )}

      {/* Location Modal */}
      <Modal open={locModal} onClose={() => setLocModal(false)} title="অবস্থান নির্বাচন">
        <div className="space-y-2">
          {POPULAR_LOCATIONS.map(loc => (
            <button
              key={loc.name}
              onClick={() => {
                onChangeLocation(loc);
                showToast(`অবস্থান পরিবর্তন: ${loc.name} ✅`);
                setLocModal(false);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-sm ${
                location.name === loc.name
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                  : 'border-white/8 bg-white/3 hover:bg-white/6'
              }`}
            >
              <span>{loc.name}</span>
              {location.name === loc.name && <i className="fas fa-check text-indigo-400" />}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

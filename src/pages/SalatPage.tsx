import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { gregorianToHijri, formatHijriDate, getAdjustedDateForHijri } from '../utils/hijri';
import { getPrayerTimes, PRAYER_NAMES_BN, LOGGABLE_PRAYERS, POPULAR_LOCATIONS } from '../utils/prayerTimes';
import type { PrayerKey } from '../utils/prayerTimes';
import type { AppLocation, SalatLogEntry } from '../utils/storage';
import { calculateQiblaDirection, getQiblaDescription, distanceToMecca } from '../utils/qibla';

interface Props {
  location: AppLocation;
  salatLog: Record<string, Record<string, SalatLogEntry>>;
  onUpdateLog: (dateISO: string, prayerKey: PrayerKey, entry: SalatLogEntry) => void;
  onChangeLocation: (loc: AppLocation) => void;
  showToast: (msg: string) => void;
}

const PRAYER_ICONS: Record<string, string> = {
  fajr: 'fa-cloud-sun', sunrise: 'fa-sun', dhuhr: 'fa-sun',
  asr: 'fa-cloud-sun', maghrib: 'fa-cloud-moon', isha: 'fa-moon',
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Isolated countdown component — only this re-renders every second
function CountdownTimer({ targetMinutes, onExpire }: { targetMinutes: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  let diffMins = targetMinutes - nowMinutes;
  if (diffMins < 0) {
    // Trigger re-calc in parent
    clearInterval(intervalRef.current);
    onExpire();
    diffMins = 0;
  }

  const h = Math.floor(diffMins / 60);
  const m = Math.floor(diffMins % 60);
  const s = Math.floor((diffMins * 60) % 60);

  return (
    <p className="mt-3 inline-block text-lg font-mono bg-black/40 px-4 py-2 rounded-full tabular-nums">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </p>
  );
}

export function SalatPage({ location, salatLog, onUpdateLog, onChangeLocation, showToast }: Props) {
  const [tick, setTick] = useState(0); // force re-calc when countdown expires
  const [logModal, setLogModal] = useState<{ open: boolean; prayer?: PrayerKey }>({ open: false });
  const [locModal, setLocModal] = useState(false);
  const [showQibla, setShowQibla] = useState(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Compass for Qibla
  useEffect(() => {
    if (!showQibla) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading = 0;
      if ('webkitCompassHeading' in e) {
        heading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }
      setCompassHeading(heading);
    };

    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permission: string) => {
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation as any, true);
          }
        })
        .catch(() => {});
    } else {
      window.addEventListener('deviceorientation', handleOrientation as any, true);
    }

    return () => window.removeEventListener('deviceorientation', handleOrientation as any, true);
  }, [showQibla]);

  // Geolocation auto-detect
  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Geolocation সমর্থিত নয়');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const tz = -(new Date().getTimezoneOffset() / 60);
        // Find nearest known location for name, or use coordinates
        let nearest = POPULAR_LOCATIONS[0];
        let minDist = Infinity;
        for (const loc of POPULAR_LOCATIONS) {
          const d = Math.sqrt((loc.coords[0] - lat) ** 2 + (loc.coords[1] - lng) ** 2);
          if (d < minDist) { minDist = d; nearest = loc; }
        }
        const useName = minDist < 2 ? nearest.name : `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
        onChangeLocation({
          name: useName,
          coords: [lat, lng],
          timezone: tz,
          method: nearest.method || 'mwl',
        });
        setDetectingLocation(false);
        showToast(`অবস্থান শনাক্ত: ${useName}`);
      },
      () => {
        setDetectingLocation(false);
        showToast('অবস্থান শনাক্ত করা যায়নি');
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, [onChangeLocation, showToast]);

  // Prayer time calculation (memoized — only recalculates when day/location changes)
  const today = useMemo(() => new Date(), [tick]);
  const hijriToday = useMemo(() => gregorianToHijri(getAdjustedDateForHijri(today)), [today]);
  const todayKey = useMemo(() => getAdjustedDateForHijri(today).toISOString().split('T')[0], [today]);
  const todayLog = salatLog[todayKey] || {};

  const times = useMemo(
    () => getPrayerTimes(today, location.coords, {
      timezone: location.timezone,
      method: location.method || 'mwl',
    }),
    [today, location.coords, location.timezone, location.method]
  );

  const prayerKeys: (keyof typeof times.raw)[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  let nextIdx = prayerKeys.findIndex(k => timeToMinutes(times.raw[k]) > nowMinutes);
  if (nextIdx === -1) nextIdx = 0;
  const nextKey = prayerKeys[nextIdx];
  const currentKey = nextIdx === 0 ? 'isha' : prayerKeys[nextIdx - 1];

  const nextMins = nextIdx === 0
    ? timeToMinutes(times.raw[nextKey]) + 1440
    : timeToMinutes(times.raw[nextKey]);

  const performedCount = LOGGABLE_PRAYERS.filter(p => todayLog[p]?.performed).length;
  const jamaatCount = LOGGABLE_PRAYERS.filter(p => todayLog[p]?.jamaat).length;

  // Qibla
  const qiblaBearing = useMemo(
    () => calculateQiblaDirection(location.coords[0], location.coords[1]),
    [location.coords]
  );
  const qiblaDirection = getQiblaDescription(qiblaBearing);
  const distance = useMemo(
    () => distanceToMecca(location.coords[0], location.coords[1]),
    [location.coords]
  );
  const compassRotation = compassHeading !== null ? qiblaBearing - compassHeading : qiblaBearing;

  const handleCountdownExpire = useCallback(() => {
    // Force re-calculation of prayer times
    setTick(t => t + 1);
  }, []);

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="text-center mb-5">
        <h1 className="text-2xl font-bold">সালাত ও কিবলা</h1>
        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--primary)' }}>
          {formatHijriDate(hijriToday)}
        </p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            onClick={() => setLocModal(true)}
            className="text-xs text-gray-300 hover:text-indigo-300 transition"
          >
            <i className="fas fa-location-dot mr-1" /> {location.name}
            <i className="fas fa-chevron-down text-[10px] ml-1" />
          </button>
          <button
            onClick={detectLocation}
            disabled={detectingLocation}
            className="text-xs px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 transition"
            title="GPS দিয়ে অবস্থান শনাক্ত করুন"
          >
            {detectingLocation ? (
              <i className="fas fa-spinner spin" />
            ) : (
              <i className="fas fa-crosshairs" />
            )}
          </button>
        </div>
      </div>

      {/* Next prayer countdown */}
      <div className="card text-center" style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.12))',
        borderColor: 'rgba(129,140,248,0.3)',
      }}>
        <p className="text-xs text-gray-300 mb-1">পরবর্তী ওয়াক্ত</p>
        <h2 className="text-3xl font-extrabold tracking-wide">{PRAYER_NAMES_BN[nextKey]}</h2>
        <p className="text-xl font-mono mt-1" style={{ color: 'var(--primary)' }}>
          {times.formatted[nextKey]}
        </p>
        <CountdownTimer targetMinutes={nextMins} onExpire={handleCountdownExpire} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card mb-0 p-3 text-center">
          <p className="text-xs text-gray-400">আজ আদায়</p>
          <p className="text-2xl font-bold text-emerald-400">{performedCount} / ৫</p>
        </div>
        <div className="card mb-0 p-3 text-center">
          <p className="text-xs text-gray-400">জামাতে</p>
          <p className="text-2xl font-bold text-indigo-300">{jamaatCount} / ৫</p>
        </div>
      </div>

      {/* Qibla */}
      <button
        onClick={() => setShowQibla(!showQibla)}
        className="w-full card mb-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <i className="fas fa-compass text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="font-bold">কিবলা দিক</p>
            <p className="text-xs text-gray-400">
              {qiblaDirection} ({qiblaBearing}°) • মক্কা: {distance.toLocaleString('bn-BD')} কিমি
            </p>
          </div>
        </div>
        <i className={`fas fa-chevron-${showQibla ? 'up' : 'down'} text-gray-500`} />
      </button>

      {showQibla && (
        <div className="card mb-4 text-center">
          <div className="relative w-56 h-56 mx-auto mb-4">
            <svg className="w-full h-full" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
              <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x="100" y="16" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">উ</text>
              <text x="100" y="196" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">দ</text>
              <text x="8" y="104" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">প</text>
              <text x="192" y="104" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">পূ</text>
              <g transform={`rotate(${compassRotation}, 100, 100)`}>
                <line x1="100" y1="100" x2="100" y2="22" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
                <polygon points="100,15 93,30 107,30" fill="var(--primary)" />
              </g>
              <circle cx="100" cy="100" r="5" fill="var(--primary)" opacity="0.6" />
            </svg>
            <div
              className="absolute top-1 left-1/2 -translate-x-1/2"
              style={{ transform: `translateX(-50%) rotate(${compassRotation}deg)`, transformOrigin: '50% 100px' }}
            >
              <div className="text-2xl -mt-3">🕋</div>
            </div>
          </div>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--primary)' }}>
            কিবলা: {qiblaDirection} দিকে ({qiblaBearing}°)
          </p>
          <p className="text-xs text-gray-400">
            উত্তর থেকে {qiblaBearing}° ঘড়ির কাটার দিকে
            {compassHeading !== null && ' • কম্পাস সক্রিয়'}
          </p>
          <button
            onClick={() => {
              if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                (DeviceOrientationEvent as any).requestPermission().then((p: string) => {
                  if (p === 'granted') showToast('কম্পাস সক্রিয়');
                  else showToast('কম্পাস অনুমতি প্রয়োজন');
                });
              } else {
                showToast('ডিভাইস ঘোরান — কম্পাস কাজ করছে');
              }
            }}
            className="mt-3 btn btn-secondary text-sm"
          >
            <i className="fas fa-sync" /> কম্পাস চালু করুন
          </button>
        </div>
      )}

      {/* Prayer times list */}
      <div className="card">
        <div className="card-title">
          <i className="fas fa-mosque" style={{ color: 'var(--primary)' }} />
          আজকের নামাজের সময়
        </div>
        <div className="space-y-2">
          {prayerKeys.map(k => {
            const isLoggable = LOGGABLE_PRAYERS.includes(k as PrayerKey);
            const log = todayLog[k];
            const isCurrent = k === currentKey;

            return (
              <button
                key={k}
                disabled={!isLoggable}
                onClick={() => isLoggable && setLogModal({ open: true, prayer: k as PrayerKey })}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${
                  isCurrent ? 'bg-indigo-500/15 border-indigo-400/40' :
                  'bg-white/5 border-transparent'
                } ${isLoggable ? 'hover:bg-white/10 cursor-pointer' : 'opacity-60'}`}
              >
                <div className="flex items-center gap-3">
                  <i className={`fas ${PRAYER_ICONS[k]} text-gray-300 w-5`} />
                  <span className="font-semibold">{PRAYER_NAMES_BN[k]}</span>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200">
                      এখন
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isLoggable && (
                    log?.performed ? (
                      <span className="text-xs text-emerald-400">
                        <i className="fas fa-check-circle mr-1" />
                        {log.jamaat ? 'জামাত' : 'আদায়'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">লগ করুন</span>
                    )
                  )}
                  <span className="font-mono text-sm">{times.formatted[k]}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card text-center text-sm text-gray-300">
        <p className="italic">"নিশ্চয়ই সালাত অশ্লীল ও মন্দ কাজ থেকে বিরত রাখে।"</p>
        <p className="text-xs text-gray-500 mt-1">— সূরা আল-আনকাবূত, আয়াত: ৪৫</p>
      </div>

      {/* Log modal */}
      {logModal.prayer && (
        <SalatLogModal
          open={logModal.open}
          prayer={logModal.prayer}
          existing={todayLog[logModal.prayer]}
          onClose={() => setLogModal({ open: false })}
          onSave={(entry) => {
            onUpdateLog(todayKey, logModal.prayer!, entry);
            showToast(`${PRAYER_NAMES_BN[logModal.prayer!]} সালাত লগ সেভ হয়েছে`);
            setLogModal({ open: false });
          }}
        />
      )}

      {/* Location modal */}
      <Modal open={locModal} onClose={() => setLocModal(false)} title="অবস্থান নির্বাচন">
        <div className="space-y-2">
          <button
            onClick={() => { detectLocation(); setLocModal(false); }}
            className="w-full text-left p-3 rounded-xl flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/15 transition border border-emerald-500/20"
          >
            <i className="fas fa-crosshairs text-emerald-400" />
            <span className="font-semibold">📍 GPS দিয়ে স্বয়ংক্রিয় শনাক্ত</span>
          </button>
          {POPULAR_LOCATIONS.map(loc => (
            <button
              key={loc.name}
              onClick={() => {
                onChangeLocation(loc);
                setLocModal(false);
                showToast(`অবস্থান: ${loc.name}`);
              }}
              className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition ${
                loc.name === location.name
                  ? 'bg-indigo-500/20 border border-indigo-400/40'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <i className="fas fa-location-dot text-indigo-300" />
              <span>{loc.name}</span>
              {loc.name === location.name && <i className="fas fa-check ml-auto text-emerald-400" />}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── Salat Log Modal ───
function SalatLogModal({
  open, prayer, existing, onClose, onSave,
}: {
  open: boolean;
  prayer: PrayerKey;
  existing?: SalatLogEntry;
  onClose: () => void;
  onSave: (entry: SalatLogEntry) => void;
}) {
  const [performed, setPerformed] = useState(existing?.performed ?? false);
  const [jamaat, setJamaat] = useState(existing?.jamaat ?? false);
  const [sunnah, setSunnah] = useState(existing?.sunnah ?? false);
  const [witr, setWitr] = useState(existing?.witr ?? false);

  useEffect(() => {
    if (open) {
      setPerformed(existing?.performed ?? false);
      setJamaat(existing?.jamaat ?? false);
      setSunnah(existing?.sunnah ?? false);
      setWitr(existing?.witr ?? false);
    }
  }, [open, existing]);

  return (
    <Modal open={open} onClose={onClose} title={`${PRAYER_NAMES_BN[prayer]} সালাত লগ`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ performed, jamaat: performed && jamaat, sunnah, witr });
        }}
      >
        <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 cursor-pointer">
          <span className="font-semibold">আদায় করেছেন</span>
          <input
            type="checkbox"
            checked={performed}
            onChange={(e) => {
              setPerformed(e.target.checked);
              if (!e.target.checked) setJamaat(false);
            }}
          />
        </label>
        <label className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${performed ? 'bg-black/30' : 'bg-black/10 opacity-50'}`}>
          <span className="font-semibold">জামাতে আদায়</span>
          <input
            type="checkbox"
            checked={jamaat}
            disabled={!performed}
            onChange={(e) => {
              setJamaat(e.target.checked);
              if (e.target.checked) setPerformed(true);
            }}
          />
        </label>
        {prayer !== 'maghrib' && (
          <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 cursor-pointer">
            <span className="font-semibold">সুন্নাত আদায়</span>
            <input type="checkbox" checked={sunnah} onChange={(e) => setSunnah(e.target.checked)} />
          </label>
        )}
        {prayer === 'isha' && (
          <label className="flex items-center justify-between p-3 rounded-xl bg-black/30 cursor-pointer">
            <span className="font-semibold">বিতর আদায়</span>
            <input type="checkbox" checked={witr} onChange={(e) => setWitr(e.target.checked)} />
          </label>
        )}
        <button type="submit" className="btn btn-primary mt-2">
          <i className="fas fa-save" /> লগ সেভ করুন
        </button>
      </form>
    </Modal>
  );
}

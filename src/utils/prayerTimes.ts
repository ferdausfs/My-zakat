// Accurate prayer time calculation
// Based on PrayTimes.js by Hamid Zarrabi-Zadeh with corrections:
// - Proper Asr juristic method (Hanafi/Shafi'i)
// - Maghrib = sunset (not sunset + offset)
// - High-latitude adjustment (angle-based method)
// - Auto timezone detection via Intl API

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type AsrMethod = 'standard' | 'hanafi'; // standard = Shafi'i/Maliki/Hanbali

export interface CalcMethod {
  name: string;
  fajrAngle: number;
  ishaAngle: number;
  ishaMinutes?: number; // if set, isha = maghrib + minutes (e.g. 90 for Umm al-Qura)
}

export const CALC_METHODS: Record<string, CalcMethod> = {
  mwl:      { name: 'Muslim World League',     fajrAngle: 18, ishaAngle: 17 },
  isna:     { name: 'ISNA (North America)',    fajrAngle: 15, ishaAngle: 15 },
  egypt:    { name: 'Egyptian General Auth.',  fajrAngle: 19.5, ishaAngle: 17.5 },
  makkah:   { name: 'Umm al-Qura (Makkah)',    fajrAngle: 18.5, ishaAngle: 0, ishaMinutes: 90 },
  karachi:  { name: 'Karachi (South Asia)',    fajrAngle: 18, ishaAngle: 18 },
  dhaka:    { name: 'Bangladesh (BFR)',        fajrAngle: 18, ishaAngle: 18 },
};

function normalize(t: number): number {
  return ((t % 24) + 24) % 24;
}

function julian(year: number, month: number, day: number): number {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

// Sun declination and equation of time — more accurate formulas
function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = normalize((357.529 + 0.98560028 * D) / 1) * D2R; // mean anomaly
  const q = normalize((280.459 + 0.98564736 * D) / 1);        // mean longitude
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R; // ecliptic longitude
  const e = 23.439 - 0.00000036 * D; // obliquity

  const RA = R2D * Math.atan2(Math.cos(e * D2R) * Math.sin(L), Math.cos(L)) / 15; // right ascension in hours
  const decl = R2D * Math.asin(Math.sin(e * D2R) * Math.sin(L)); // declination in degrees

  // Equation of time (in hours)
  const ST = normalize((100.46 + 0.985647352 * D) / 1); // sidereal time
  const EqT = (ST - RA) / 15; // equation of time in hours, but we use it differently

  return { decl, EqT };
}

// Compute the time when sun reaches a given angle below horizon
function computeTime(angle: number, decl: number, lat: number, dhuhr: number, direction: 'ccw' | 'cw'): number {
  const latRad = lat * D2R;
  const declRad = decl * D2R;
  const cosH = (-Math.sin(angle * D2R) - Math.sin(latRad) * Math.sin(declRad)) /
               (Math.cos(latRad) * Math.cos(declRad));

  if (cosH > 1 || cosH < -1) {
    // Sun never reaches this angle — high latitude
    return NaN;
  }

  const H = R2D * Math.acos(cosH) / 15; // in hours
  return direction === 'ccw' ? dhuhr - H : dhuhr + H;
}

// Asr time computation
function computeAsr(decl: number, lat: number, dhuhr: number, method: AsrMethod): number {
  const factor = method === 'hanafi' ? 2 : 1; // Hanafi: shadow = 2x + noon shadow
  const latRad = lat * D2R;
  const declRad = decl * D2R;
  const angle = -R2D * Math.atan(1 / (factor + Math.tan(Math.abs(latRad - declRad))));
  return computeTime(angle, decl, lat, dhuhr, 'cw');
}

// High-latitude adjustment: Angle-based method (recommended by PrayTimes.org)
function adjustHighLat(times: Record<string, number>, _lat: number, sunset: number, fajr: number, _ishaAngle: number): Record<string, number> {
  const nightTime = normalize(sunset - fajr); // total night duration in hours

  // Fajr: if NaN or unreasonable, use portion of night
  if (isNaN(times.fajr) || normalize(times.fajr - sunset) > normalize(fajr - sunset)) {
    const fajrPortion = (18 / 60); // 18° angle → ~1/7 of night
    times.fajr = normalize(sunset - nightTime * fajrPortion * 4);
  }

  // Isha: if NaN or unreasonable, use portion of night
  if (isNaN(times.isha)) {
    const ishaPortion = (17 / 60);
    times.isha = normalize(sunset + nightTime * ishaPortion * 4);
  }

  return times;
}

function formatTime12(time: number): string {
  if (isNaN(time)) return '-----';
  time = normalize(time + 0.5 / 60); // round to nearest minute
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  const hour12 = ((hours + 11) % 12) + 1;
  const mm = String(minutes).padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hour12}:${mm} ${suffix}`;
}

function formatTime24(time: number): string {
  if (isNaN(time)) return '-----';
  time = normalize(time + 0.5 / 60);
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export interface PrayerTimes {
  fajr: string; sunrise: string; dhuhr: string;
  asr: string; maghrib: string; isha: string;
}

export interface PrayerTimesOptions {
  method?: string;      // calculation method key
  asrMethod?: AsrMethod;
  timezone?: number;    // if not provided, auto-detect
}

export function getPrayerTimes(
  date: Date,
  coords: [number, number],
  options: PrayerTimesOptions = {}
): { formatted: PrayerTimes; raw: PrayerTimes } {
  const lat = coords[0];
  const lng = coords[1];

  // Auto-detect timezone if not provided
  const timezone = options.timezone ?? -(date.getTimezoneOffset() / 60);
  const methodKey = options.method || 'mwl';
  const asrMethod = options.asrMethod || 'standard';
  const method = CALC_METHODS[methodKey] || CALC_METHODS.mwl;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const jd = julian(year, month, day) - lng / (15 * 24);

  const { decl } = sunPosition(jd);

  // Dhuhr = 12 + timezone - lng/15 - EqT
  // More accurately: solar noon
  const { EqT } = sunPosition(jd);
  let dhuhr = 12 - EqT + timezone - lng / 15;
  // Small safety margin (1 min)
  dhuhr += 1 / 60;

  const fajr = computeTime(method.fajrAngle, decl, lat, dhuhr, 'ccw');
  const sunrise = computeTime(0.833, decl, lat, dhuhr, 'ccw'); // 0.833° accounts for refraction
  const sunset = computeTime(0.833, decl, lat, dhuhr, 'cw');
  const asr = computeAsr(decl, lat, dhuhr, asrMethod);
  const maghrib = sunset; // Maghrib begins at sunset (correct fiqh position)

  let isha: number;
  if (method.ishaMinutes) {
    isha = sunset + method.ishaMinutes / 60;
  } else {
    isha = computeTime(method.ishaAngle, decl, lat, dhuhr, 'cw');
  }

  let times: Record<string, number> = { fajr, sunrise, dhuhr, asr, maghrib, isha, sunset };

  // High-latitude adjustment
  const isHighLat = Math.abs(lat) > 48;
  if (isHighLat) {
    times = adjustHighLat(times, lat, sunset, fajr, isha);
  }

  const keys: (keyof PrayerTimes)[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const formatted = {} as PrayerTimes;
  const raw = {} as PrayerTimes;

  for (const k of keys) {
    formatted[k] = formatTime12(times[k]);
    raw[k] = formatTime24(times[k]);
  }

  return { formatted, raw };
}

// Auto-detect timezone offset for a given date
export function getTimezoneOffset(date: Date = new Date()): number {
  return -(date.getTimezoneOffset() / 60);
}

// Get user's timezone name
export function getTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export const PRAYER_NAMES_BN: Record<string, string> = {
  fajr: 'ফজর',
  sunrise: 'সূর্যোদয়',
  dhuhr: 'যোহর',
  asr: 'আসর',
  maghrib: 'মাগরিব',
  isha: 'ইশা',
};

export const LOGGABLE_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = typeof LOGGABLE_PRAYERS[number];

export const POPULAR_LOCATIONS: { name: string; coords: [number, number]; timezone: number; method: string }[] = [
  { name: 'ঢাকা, বাংলাদেশ',     coords: [23.8103, 90.4125], timezone: 6, method: 'karachi' },
  { name: 'চট্টগ্রাম, বাংলাদেশ',  coords: [22.3569, 91.7832], timezone: 6, method: 'karachi' },
  { name: 'সিলেট, বাংলাদেশ',     coords: [24.8949, 91.8687], timezone: 6, method: 'karachi' },
  { name: 'রাজশাহী, বাংলাদেশ',   coords: [24.3745, 88.6042], timezone: 6, method: 'karachi' },
  { name: 'খুলনা, বাংলাদেশ',     coords: [22.8456, 89.5403], timezone: 6, method: 'karachi' },
  { name: 'মক্কা, সৌদি আরব',     coords: [21.4225, 39.8262], timezone: 3, method: 'makkah' },
  { name: 'মদীনা, সৌদি আরব',    coords: [24.4700, 39.6100], timezone: 3, method: 'makkah' },
  { name: 'ইস্তাম্বুল, তুরস্ক',    coords: [41.0082, 28.9784], timezone: 3, method: 'mwl' },
  { name: 'লন্ডন, যুক্তরাজ্য',     coords: [51.5074, -0.1278], timezone: 0, method: 'mwl' },
  { name: 'নিউ ইয়র্ক, USA',      coords: [40.7128, -74.0060], timezone: -5, method: 'isna' },
  { name: 'কুয়ালালামপুর, মালয়েশিয়া', coords: [3.1390, 101.6869], timezone: 8, method: 'mwl' },
];

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type AsrMethod = 'standard' | 'hanafi';

export interface CalcMethod {
  name: string;
  fajrAngle: number;
  ishaAngle: number;
  ishaMinutes?: number;
}

export const CALC_METHODS: Record<string, CalcMethod> = {
  mwl:    { name: 'Muslim World League',      fajrAngle: 18,   ishaAngle: 17 },
  isna:   { name: 'ISNA (North America)',      fajrAngle: 15,   ishaAngle: 15 },
  egypt:  { name: 'Egyptian General Auth.',    fajrAngle: 19.5, ishaAngle: 17.5 },
  makkah: { name: 'Umm al-Qura (Makkah)',      fajrAngle: 18.5, ishaAngle: 0, ishaMinutes: 90 },
  karachi:{ name: 'Karachi (South Asia)',      fajrAngle: 18,   ishaAngle: 18 },
  dhaka:  { name: 'Bangladesh (BFR)',          fajrAngle: 18,   ishaAngle: 18 },
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

function sunPosition(jd: number): { declination: number; equation: number } {
  const D = jd - 2451545.0;
  const g = normalize((357.529 + 0.98560028 * D) / 360) * 360;
  const q = normalize((280.459 + 0.98564736 * D) / 360) * 360;
  const L = q + 1.915 * Math.sin(g * D2R) + 0.020 * Math.sin(2 * g * D2R);
  const e = 23.439 - 0.00000036 * D;
  const RA = Math.atan2(Math.cos(e * D2R) * Math.sin(L * D2R), Math.cos(L * D2R)) * R2D / 15;
  const declination = Math.asin(Math.sin(e * D2R) * Math.sin(L * D2R)) * R2D;
  const equation = q / 15 - normalize(RA);
  return { declination, equation };
}

function hourAngle(lat: number, dec: number, elev: number): number {
  const cosVal = (Math.cos(elev * D2R) - Math.sin(lat * D2R) * Math.sin(dec * D2R)) /
                 (Math.cos(lat * D2R) * Math.cos(dec * D2R));
  if (Math.abs(cosVal) > 1) return NaN;
  return Math.acos(cosVal) * R2D / 15;
}

function asrTime(lat: number, dec: number, shadow: number, transit: number): number {
  const a = Math.atan(1 / (shadow + Math.tan(Math.abs(lat - dec) * D2R))) * R2D;
  const t = hourAngle(lat, dec, 90 - a);
  return isNaN(t) ? NaN : transit + t;
}

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  sunset: string;
}

function formatTime12(time: number): string {
  if (isNaN(time)) return '-----';
  time = normalize(time + 0.5 / 60);
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  const hour12 = ((hours + 11) % 12) + 1;
  const mm = String(minutes).padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hour12}:${mm} ${suffix}`;
}

function formatTime24(time: number): string {
  if (isNaN(time)) return '--:--';
  time = normalize(time + 0.5 / 60);
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function adjustHighLat(
  times: Record<string, number>,
  _lat: number,
  sunset: number,
  fajr: number,
  _ishaAngle: number
): Record<string, number> {
  const nightTime = normalize(sunset - fajr);
  if (isNaN(times['fajr']) || normalize(times['fajr'] - sunset) > normalize(fajr - sunset)) {
    const fajrPortion = (18 / 60);
    times['fajr'] = normalize(sunset - nightTime * fajrPortion * 4);
  }
  if (isNaN(times['isha'])) {
    const ishaPortion = (17 / 60);
    times['isha'] = normalize(sunset + nightTime * ishaPortion * 4);
  }
  return times;
}

export function calcPrayerTimes(
  date: Date,
  lat: number,
  lng: number,
  timezone: number,
  methodKey: string = 'karachi',
  asrMethod: AsrMethod = 'hanafi'
): { formatted: PrayerTimes; raw: PrayerTimes } {
  const method = CALC_METHODS[methodKey] || CALC_METHODS['karachi'];
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { declination, equation } = sunPosition(jd);
  const transitRaw = 12 - lng / 15 - equation;
  const transit = normalize(transitRaw + timezone);

  const sunriseAngle = 0.833;
  const sunriseHA = hourAngle(lat, declination, 90 - sunriseAngle);
  const sunrise = isNaN(sunriseHA) ? NaN : normalize(transit - sunriseHA);
  const sunset  = isNaN(sunriseHA) ? NaN : normalize(transit + sunriseHA);

  const fajrHA = hourAngle(lat, declination, 90 - method.fajrAngle);
  const fajr   = isNaN(fajrHA) ? NaN : normalize(transit - fajrHA);

  let isha: number;
  if (method.ishaMinutes) {
    isha = normalize(sunset + method.ishaMinutes / 60);
  } else {
    const ishaHA = hourAngle(lat, declination, 90 - method.ishaAngle);
    isha = isNaN(ishaHA) ? NaN : normalize(transit + ishaHA);
  }

  const shadowRatio = asrMethod === 'hanafi' ? 2 : 1;
  const asr = asrTime(lat, declination, shadowRatio, transit);

  const maghrib = sunset;

  let times: Record<string, number> = { fajr, sunrise, dhuhr: transit, asr, maghrib, isha, sunset };

  if (Math.abs(lat) > 48) {
    times = adjustHighLat(times, lat, sunset, fajr, method.ishaAngle);
  }

  const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'sunset'];
  const fmtObj: Record<string, string> = {};
  const rawObj: Record<string, string> = {};
  for (const k of keys) {
    fmtObj[k] = formatTime12(times[k]);
    rawObj[k] = formatTime24(times[k]);
  }

  return {
    formatted: fmtObj as unknown as PrayerTimes,
    raw: rawObj as unknown as PrayerTimes,
  };
}

export function getTimezoneOffset(date: Date = new Date()): number {
  return -(date.getTimezoneOffset() / 60);
}

export function getTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export const PRAYER_NAMES_BN: Record<string, string> = {
  fajr:    'ফজর',
  sunrise: 'সূর্যোদয়',
  dhuhr:   'যোহর',
  asr:     'আসর',
  maghrib: 'মাগরিব',
  isha:    'ইশা',
};

export const LOGGABLE_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = typeof LOGGABLE_PRAYERS[number];

export const POPULAR_LOCATIONS: { name: string; coords: [number, number]; timezone: number; method: string }[] = [
  { name: 'ঢাকা, বাংলাদেশ',         coords: [23.8103, 90.4125],   timezone: 6,  method: 'karachi' },
  { name: 'চট্টগ্রাম, বাংলাদেশ',     coords: [22.3569, 91.7832],   timezone: 6,  method: 'karachi' },
  { name: 'সিলেট, বাংলাদেশ',         coords: [24.8949, 91.8687],   timezone: 6,  method: 'karachi' },
  { name: 'রাজশাহী, বাংলাদেশ',       coords: [24.3745, 88.6042],   timezone: 6,  method: 'karachi' },
  { name: 'খুলনা, বাংলাদেশ',         coords: [22.8456, 89.5403],   timezone: 6,  method: 'karachi' },
  { name: 'ময়মনসিংহ, বাংলাদেশ',     coords: [24.7471, 90.4203],   timezone: 6,  method: 'karachi' },
  { name: 'বরিশাল, বাংলাদেশ',        coords: [22.7010, 90.3535],   timezone: 6,  method: 'karachi' },
  { name: 'রংপুর, বাংলাদেশ',         coords: [25.7439, 89.2752],   timezone: 6,  method: 'karachi' },
  { name: 'কক্সবাজার, বাংলাদেশ',     coords: [21.4272, 92.0058],   timezone: 6,  method: 'karachi' },
  { name: 'মক্কা, সৌদি আরব',         coords: [21.4225, 39.8262],   timezone: 3,  method: 'makkah' },
  { name: 'মদীনা, সৌদি আরব',         coords: [24.4700, 39.6100],   timezone: 3,  method: 'makkah' },
  { name: 'ইস্তাম্বুল, তুরস্ক',       coords: [41.0082, 28.9784],   timezone: 3,  method: 'mwl' },
  { name: 'লন্ডন, যুক্তরাজ্য',        coords: [51.5074, -0.1278],   timezone: 0,  method: 'mwl' },
  { name: 'নিউ ইয়র্ক, USA',          coords: [40.7128, -74.0060],  timezone: -5, method: 'isna' },
  { name: 'কুয়ালালামপুর, মালয়েশিয়া', coords: [3.1390,  101.6869],  timezone: 8,  method: 'mwl' },
  { name: 'দুবাই, UAE',               coords: [25.2048, 55.2708],   timezone: 4,  method: 'mwl' },
  { name: 'করাচি, পাকিস্তান',         coords: [24.8607, 67.0011],   timezone: 5,  method: 'karachi' },
  { name: 'কায়রো, মিশর',             coords: [30.0444, 31.2357],   timezone: 2,  method: 'egypt' },
];

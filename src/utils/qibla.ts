// Qibla direction calculation using great-circle bearing
// Accurate to within 0.1° for all locations on Earth

const MECCA_LAT = 21.4225241;
const MECCA_LNG = 39.8261818;

export function calculateQiblaDirection(lat: number, lng: number): number {
  const φ1 = lat * Math.PI / 180;
  const φ2 = MECCA_LAT * Math.PI / 180;
  const Δλ = (MECCA_LNG - lng) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = Math.atan2(y, x) * 180 / Math.PI;

  θ = ((θ % 360) + 360) % 360;
  return Math.round(θ * 10) / 10; // 1 decimal place precision
}

export function getQiblaDescription(bearing: number): string {
  const dirs = [
    { min: 337.5, max: 22.5, name: 'উত্তর' },
    { min: 22.5, max: 67.5, name: 'উত্তর-পূর্ব' },
    { min: 67.5, max: 112.5, name: 'পূর্ব' },
    { min: 112.5, max: 157.5, name: 'দক্ষিণ-পূর্ব' },
    { min: 157.5, max: 202.5, name: 'দক্ষিণ' },
    { min: 202.5, max: 247.5, name: 'দক্ষিণ-পশ্চিম' },
    { min: 247.5, max: 292.5, name: 'পশ্চিম' },
    { min: 292.5, max: 337.5, name: 'উত্তর-পশ্চিম' },
  ];
  for (const d of dirs) {
    if (d.min > d.max) { // wraps around 0/360
      if (bearing >= d.min || bearing < d.max) return d.name;
    } else {
      if (bearing >= d.min && bearing < d.max) return d.name;
    }
  }
  return 'উত্তর';
}

// Vincenty formula for more accurate distance (accounts for Earth's oblateness)
export function distanceToMecca(lat: number, lng: number): number {
  const a = 6378137; // semi-major axis (meters)
  const f = 1 / 298.257223563; // flattening
  const b = a * (1 - f);

  const φ1 = lat * Math.PI / 180;
  const φ2 = MECCA_LAT * Math.PI / 180;
  const L = (MECCA_LNG - lng) * Math.PI / 180;

  const U1 = Math.atan((1 - f) * Math.tan(φ1));
  const U2 = Math.atan((1 - f) * Math.tan(φ2));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let λ = L;
  let λP: number;
  let iterLimit = 100;

  let cosSqα: number, sinσ: number, cosσ: number, σ: number;
  let sinα: number, cos2σM: number;

  do {
    const sinλ = Math.sin(λ);
    const cosλ = Math.cos(λ);
    cosSqα = cosU1 * cosU2 * sinλ;
    sinσ = Math.sqrt(
      (cosU2 * sinλ) ** 2 +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) ** 2
    );
    if (sinσ === 0) return 0; // co-incident points

    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    sinα = cosU1 * cosU2 * sinλ / sinσ;
    cos2σM = cosσ - 2 * sinU1 * sinU2 / (1 - sinα * sinα || 1);

    const C = f / 16 * cosSqα * (4 + f * (4 - 3 * cosSqα));
    λP = λ;
    λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σM + C * cosσ * (-1 + 2 * cos2σM * cos2σM)));
  } while (Math.abs(λ - λP) > 1e-12 && --iterLimit > 0);

  if (iterLimit === 0) {
    // Fallback to Haversine for antipodal points
    return haversineDistance(lat, lng);
  }

  const uSq = cosSqAlpha(cosU1, cosU2, sinσ, λ) * (a * a - b * b) / (b * b);
  const A2 = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B2 = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

  const Δσ = B2 * sinσ * (cos2σM! + B2 / 4 * (
    cosσ * (-1 + 2 * cos2σM! * cos2σM!) -
    B2 / 6 * cos2σM! * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σM! * cos2σM!)
  ));

  return Math.round(b * A2 * (σ - Δσ) / 1000); // km
}

function cosSqAlpha(cosU1: number, cosU2: number, sinσ: number, λ: number): number {
  const sinλ = Math.sin(λ);
  const sinAlpha = cosU1 * cosU2 * sinλ / sinσ;
  return 1 - sinAlpha * sinAlpha;
}

function haversineDistance(lat: number, lng: number): number {
  const R = 6371;
  const dLat = (MECCA_LAT - lat) * Math.PI / 180;
  const dLng = (MECCA_LNG - lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * Math.PI / 180) * Math.cos(MECCA_LAT * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

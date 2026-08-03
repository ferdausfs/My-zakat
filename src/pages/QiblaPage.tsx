import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppLocation } from '../utils/storage';

/** Qibla — Prayer-Times-style compass screen (device orientation + bearing). */
interface Props {
  location: AppLocation;
}

const KAABA = { lat: 21.4225, lng: 39.8262 };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function QiblaPage({ location }: Props) {
  const [heading, setHeading] = useState<number | null>(null);
  const [sensorOn, setSensorOn] = useState(false);
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const coords = location.coords ?? [23.8103, 90.4125];
  const lat = coords[0];
  const lng = coords[1];

  const bearing = useMemo(() => {
    const r1 = lat * Math.PI / 180;
    const r2 = KAABA.lat * Math.PI / 180;
    const dLng = (KAABA.lng - lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(r2);
    const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(dLng);
    return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
  }, [lat, lng]);

  const distance = useMemo(() => Math.round(haversineKm(lat, lng, KAABA.lat, KAABA.lng)), [lat, lng]);

  const dirs = ['উত্তর', 'উত্তর-পূর্ব', 'পূর্ব', 'দক্ষিণ-পূর্ব', 'দক্ষিণ', 'দক্ষিণ-পশ্চিম', 'পশ্চিম', 'উত্তর-পশ্চিম'];
  const qiblaDir = dirs[Math.round(bearing / 45) % 8];

  // rotation: arrow points to kaaba relative to device heading
  const rotation = heading !== null ? (bearing - heading + 360) % 360 : bearing;

  const stop = useCallback(() => {
    if (handlerRef.current) {
      window.removeEventListener('deviceorientation', handlerRef.current);
      handlerRef.current = null;
    }
    setHeading(null);
    setSensorOn(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(() => {
    if (sensorOn) { stop(); return; }
    const DOE = (window as unknown as Record<string, unknown>)['DeviceOrientationEvent'] as
      { requestPermission?: () => Promise<string> } | undefined;
    const attach = () => {
      if (handlerRef.current) return;
      const handler = (e: DeviceOrientationEvent) => {
        const wk = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
        const h = (typeof wk === 'number' && !isNaN(wk)) ? wk : e.alpha;
        if (h !== null) setHeading(((Math.round(h) % 360) + 360) % 360);
      };
      handlerRef.current = handler;
      window.addEventListener('deviceorientation', handler);
    };
    if (DOE?.requestPermission) {
      DOE.requestPermission().then(s => { if (s === 'granted') { attach(); setSensorOn(true); } }).catch(() => {});
    } else {
      attach();
      setSensorOn(true);
    }
  }, [sensorOn, stop]);

  // compass tick marks at 30° steps
  const ticks = useMemo(() => {
    const arr: { deg: number; top: string; left: string }[] = [];
    for (let d = 0; d < 360; d += 30) {
      if (d % 90 === 0) continue;
      const rad = (d - 90) * Math.PI / 180;
      const r = 108; // tick radius
      arr.push({ deg: d, top: `${125 + r * Math.sin(rad)}px`, left: `${125 + r * Math.cos(rad)}px` });
    }
    return arr;
  }, []);

  return (
    <div className="fade-in">
      <div className="pt-topbar">
        <div className="pt-loc"><span className="pin">●</span><b>{location.name || 'ঢাকা'}</b></div>
        <div className="pt-topbtn">☰</div>
      </div>

      <div className="qibla-wrap">
        <div className="qibla-lbl">কিবলা দিক</div>
        <div className="qibla-deg">{bearing}°<small> {qiblaDir}</small></div>

        <div className="compass">
          <div className="ring" />
          <div className="card" style={{ top: '10px', left: '50%', transform: 'translateX(-50%)' }}>N</div>
          <div className="card" style={{ bottom: '14px', left: '50%', transform: 'translateX(-50%)' }}>S</div>
          <div className="card" style={{ top: '50%', right: '10px', transform: 'translateY(-50%)' }}>E</div>
          <div className="card" style={{ top: '50%', left: '10px', transform: 'translateY(-50%)' }}>W</div>
          {ticks.map(t => (
            <div key={t.deg} className="tick" style={{ top: t.top, left: t.left, transform: 'translate(-50%,-50%)' }}>
              {((t.deg % 30) === 0 ? t.deg : '').toString()}
            </div>
          ))}
          <div className="arrow" style={{ transform: `rotate(${rotation}deg)` }} />
          <div className="kaaba">কাবা</div>
        </div>

        <div style={{ marginTop: 34, fontSize: '.72rem', color: 'var(--text-dim)' }}>
          কিবলা: <b style={{ color: 'var(--primary)' }}>{bearing}°</b> — {qiblaDir}
        </div>

        <div className="qibla-meta">
          <div className="qm"><div className="k">সেন্সর</div><div className="v" style={{ color: sensorOn ? 'var(--primary)' : 'var(--text-muted)' }}>{sensorOn ? 'চালু' : 'বন্ধ'}</div></div>
          <div className="qm"><div className="k">দূরত্ব</div><div className="v">{distance.toLocaleString('bn-BD')} km</div></div>
          <div className="qm"><div className="k">হেডিং</div><div className="v">{heading !== null ? `${heading}°` : '—'}</div></div>
        </div>

        <div className="qibla-note">
          {sensorOn
            ? `হেডিং: ${heading ?? '—'}° · কিবলা আপেক্ষিক: ${Math.round(rotation)}°`
            : 'সঠিক দিকের জন্য কম্পাস সেন্সর চালু করুন।'}
        </div>

        <button
          onClick={toggle}
          className="btn btn-primary"
          style={{ marginTop: 14, maxWidth: 220 }}
        >
          {sensorOn ? 'কম্পাস বন্ধ করুন' : 'কম্পাস চালু করুন'}
        </button>
      </div>
    </div>
  );
}

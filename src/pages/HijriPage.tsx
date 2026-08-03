import { useMemo, useState } from 'react';
import { gregorianToHijri, hijriToGregorian, formatHijriDate } from '../utils/hijri';

/** Hijri — Prayer-Times-style month calendar + Islamic event notes. */

const MONTHS_BN = ['মুহাররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি', 'জুমাদাল উলা', 'জুমাদাস সানি', 'রজব', 'শাবান', 'রমজান', 'শাওয়াল', 'জুল ক্বাদা', 'জুল হিজ্জা'];

/** Important days: [hijriMonth, hijriDay, name, note, color] — displayed when in the current month. */
const EVENTS: [number, number, string, string, string][] = [
  [1, 1, 'নতুন হিজরি বছর', 'হিজরি নববর্ষ', '#4ADE80'],
  [1, 10, 'আশুরা', 'রোজা রাখা সুন্নত', '#E3B23C'],
  [3, 12, 'ঈদে মিলাদুন্নবী ﷺ', 'রাসূল ﷺ-এর জন্মদিন', '#E3B23C'],
  [7, 27, 'শবে মেরাজ', 'মেরাজের রাত', '#A78BFA'],
  [8, 15, 'শবে বরাত', 'ক্ষমার রাত', '#E3B23C'],
  [9, 1, 'রমজান শুরু', 'রোজার মাস', '#4ADE80'],
  [9, 27, 'লাইলাতুল কদর', 'হাজার মাসের চেয়ে উত্তম', '#4ADE80'],
  [10, 1, 'ঈদুল ফিতর', 'রমজানের ঈদ', '#E3B23C'],
  [12, 9, 'আরাফার দিন', 'রোজা উত্তম', '#E3B23C'],
  [12, 10, 'ঈদুল আযহা', 'কুরবানির ঈদ', '#E3B23C'],
];

export function HijriPage() {
  const today = useMemo(() => gregorianToHijri(new Date()), []);

  // current hijri year + month (1-12)
  const [offset, setOffset] = useState(0);
  const baseMonth = today.m + offset;          // 1..12 math below
  const year = today.y + Math.floor((baseMonth - 1) / 12);
  const month = ((baseMonth - 1) % 12 + 12) % 12 + 1;

  // first gregorian date of this hijri month
  const firstG = useMemo(() => hijriToGregorian({ y: year, m: month, d: 1 }), [year, month]);

  // days in hijri month: try 30, if 30th still same hijri month -> 30 else 29
  const daysInMonth = useMemo(() => {
    const d30 = hijriToGregorian({ y: year, m: month, d: 30 });
    return gregorianToHijri(d30).m === month ? 30 : 29;
  }, [year, month]);

  const firstDow = firstG.getDay(); // 0=Sun
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthEvents = EVENTS.filter(([m]) => m === month);

  const isToday = (d: number) => month === today.m && year === today.y && d === today.d;
  const isEvent = (d: number) => monthEvents.some(([, ed]) => ed === d);

  const nav = (dir: number) => {
    setOffset(o => o + dir);
    // after navigating, keep offset within reasonable range
    setOffset(o => Math.max(-120, Math.min(120, o)));
  };

  return (
    <div className="fade-in">
      <div className="pt-topbar">
        <div className="pt-loc"><span className="pin">●</span><b>{MONTHS_BN[month - 1]} {year}</b></div>
        <div className="pt-topbtn">☰</div>
      </div>

      <div className="cal-head">
        <button className="cal-nav" onClick={() => nav(-1)}>‹</button>
        <div>
          <div className="t">{MONTHS_BN[month - 1]} {year}</div>
          <div className="s">হিজরি মাস · {firstG.toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })}</div>
        </div>
        <button className="cal-nav" onClick={() => nav(1)}>›</button>
      </div>

      <div className="cal-grid">
        <div className="cal-week">
          {['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="cal-days">
          {cells.map((d, i) => (
            <div key={i} className={`d ${d === null ? 'dim' : ''} ${d !== null && isToday(d) ? 'today' : ''} ${d !== null && isEvent(d) ? 'event' : ''}`}>
              {d !== null ? d.toLocaleString('bn-BD') : ''}
            </div>
          ))}
        </div>
      </div>

      <div className="cal-legend">
        <span><span className="dot" style={{ background: 'var(--primary)' }} /> আজ</span>
        <span><span className="dot" style={{ background: 'var(--gold)' }} /> গুরুত্বপূর্ণ দিন</span>
      </div>

      <div className="pt-agenda">
        {monthEvents.length > 0 ? monthEvents.map(([m, d, name, note, color]) => (
          <div key={`${m}-${d}`} className="ev-card">
            <div className="t"><span className="dot" style={{ background: color }} />{name}</div>
            <div className="sub">{note} · {MONTHS_BN[m - 1]} {d.toLocaleString('bn-BD')}, {year}</div>
            <div className="when">
              <span><b>{d.toLocaleString('bn-BD')} {MONTHS_BN[m - 1]}</b></span>
              <span className="left">{d === today.d && m === today.m ? 'আজ' : 'এই মাসে'}</span>
            </div>
          </div>
        )) : (
          <div className="ev-card">
            <div className="t"><span className="dot" style={{ background: 'var(--text-muted)' }} />এই মাসে বিশেষ দিন নেই</div>
            <div className="sub">অন্য মাসে দেখুন — অথবা আজকের তারিখ</div>
            <div className="when"><span><b>আজ: {formatHijriDate(today)}</b></span><span className="left">—</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

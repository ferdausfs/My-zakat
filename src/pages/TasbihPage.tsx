import { useCallback, useEffect, useRef, useState } from 'react';
import { DHIKR_PRESETS, getTodayKey, type DhikrPreset } from '../data/dhikr';
import type { TasbihDayStats } from '../utils/storage';

interface Props {
  stats: Record<string, TasbihDayStats>;
  onUpdateCount: (dateKey: string, dhikrId: string, count: number) => void;
  showToast: (msg: string) => void;
}

export function TasbihPage({ stats, onUpdateCount, showToast }: Props) {
  const [activeDhikr, setActiveDhikr] = useState<DhikrPreset>(DHIKR_PRESETS[0]);
  const [customText, setCustomText] = useState('');
  const [count, setCount] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [showPresets, setShowPresets] = useState(false);
  const [vibrate, setVibrate] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const tapRef = useRef<HTMLButtonElement>(null);
  const todayKey = getTodayKey();
  const todayStats = stats[todayKey] || {};

  useEffect(() => {
    setCount(todayStats[activeDhikr.id] || 0);
  }, [activeDhikr.id]);

  useEffect(() => {
    const total = Object.values(todayStats).reduce((s, c) => s + c, 0);
    setTotalToday(total);
  }, [todayStats]);

  const handleTap = useCallback(() => {
    const newCount = count + 1;
    setCount(newCount);
    onUpdateCount(todayKey, activeDhikr.id, newCount);
    if (vibrate && navigator.vibrate) navigator.vibrate(15);
    if (activeDhikr.target > 0 && newCount === activeDhikr.target) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
      showToast(`${activeDhikr.transliteration} ${activeDhikr.target.toLocaleString('bn-BD')} সম্পন্ন! 🎉`);
    }
  }, [count, activeDhikr, todayKey, vibrate, onUpdateCount, showToast]);

  const handleReset = () => {
    setCount(0);
    onUpdateCount(todayKey, activeDhikr.id, 0);
    showToast('কাউন্টার রিসেট হয়েছে');
  };

  const handleUndo = () => {
    if (count > 0) {
      const newCount = count - 1;
      setCount(newCount);
      onUpdateCount(todayKey, activeDhikr.id, newCount);
    }
  };

  const progress = activeDhikr.target > 0 ? Math.min(count / activeDhikr.target, 1) : 0;
  const circumference = 2 * Math.PI * 110;
  const strokeDashoffset = circumference * (1 - progress);

  const displayName = activeDhikr.id === 'custom' && customText.trim()
    ? customText.trim()
    : activeDhikr.transliteration;

  const completedSets = activeDhikr.target > 0 ? Math.floor(count / activeDhikr.target) : 0;

  return (
    <div className="px-4 pt-5 space-y-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold gradient-text">তাসবীহ</h1>
          <p className="text-xs text-gray-400 mt-0.5">যিকির কাউন্টার</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVibrate(!vibrate)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition ${vibrate ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-500'}`}
            title="ভাইব্রেশন"
          >
            <i className={`fas fa-mobile-alt`} />
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition ${showStats ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-500'}`}
          >
            <i className="fas fa-chart-bar" />
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center" style={{ padding: '10px' }}>
          <p className="text-[10px] text-gray-400">এই যিকির</p>
          <p className="text-xl font-extrabold tabular-nums" style={{ color: activeDhikr.color }}>
            {count.toLocaleString('bn-BD')}
          </p>
        </div>
        <div className="card text-center" style={{ padding: '10px' }}>
          <p className="text-[10px] text-gray-400">লক্ষ্য</p>
          <p className="text-xl font-extrabold tabular-nums text-gray-300">
            {activeDhikr.target > 0 ? activeDhikr.target.toLocaleString('bn-BD') : '∞'}
          </p>
        </div>
        <div className="card text-center" style={{ padding: '10px' }}>
          <p className="text-[10px] text-gray-400">আজ মোট</p>
          <p className="text-xl font-extrabold tabular-nums text-emerald-400">
            {totalToday.toLocaleString('bn-BD')}
          </p>
        </div>
      </div>

      {/* Today's stats */}
      {showStats && (
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 mb-3">আজকের যিকির তালিকা</p>
          {Object.entries(todayStats).filter(([_, c]) => c > 0).length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-2">আজ এখনো কোনো যিকির হয়নি</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(todayStats)
                .filter(([_, c]) => c > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([id, c]) => {
                  const preset = DHIKR_PRESETS.find(p => p.id === id);
                  const pct = preset?.target ? Math.min(100, (c / preset.target) * 100) : 0;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 flex-1">{preset?.transliteration || id}</span>
                      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: preset?.color || 'var(--primary)' }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums" style={{ color: preset?.color || 'var(--primary)' }}>
                        {c.toLocaleString('bn-BD')}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Dhikr selector */}
      <button
        onClick={() => setShowPresets(!showPresets)}
        className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/3 hover:bg-white/6 transition text-sm"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: activeDhikr.color }} />
          <span className="font-medium">{activeDhikr.transliteration}</span>
        </div>
        <i className={`fas fa-chevron-${showPresets ? 'up' : 'down'} text-gray-400 text-xs`} />
      </button>

      {/* Preset selector */}
      {showPresets && (
        <div className="card" style={{ padding: '8px' }}>
          <div className="grid grid-cols-2 gap-1.5">
            {DHIKR_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  setActiveDhikr(preset);
                  setCount(todayStats[preset.id] || 0);
                  setShowPresets(false);
                }}
                className={`p-2.5 rounded-xl text-left border transition ${
                  activeDhikr.id === preset.id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-white/8 bg-white/3 hover:bg-white/6'
                }`}
              >
                <p className="text-xs font-bold truncate" style={{ color: preset.color }}>{preset.transliteration}</p>
                {preset.arabic && <p className="text-[10px] text-gray-500 mt-0.5 truncate font-arabic">{preset.arabic.slice(0, 20)}…</p>}
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {preset.target > 0 ? `${preset.target}x` : '∞'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom text input */}
      {activeDhikr.id === 'custom' && (
        <input
          className="input-field"
          placeholder="নিজের যিকির টাইপ করুন..."
          value={customText}
          onChange={e => setCustomText(e.target.value)}
        />
      )}

      {/* Main counter */}
      <div className="flex flex-col items-center gap-4">
        {/* Progress ring */}
        <div className="relative" style={{ width: 260, height: 260 }}>
          <svg width="260" height="260" className="absolute inset-0">
            <circle cx="130" cy="130" r="110" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
            {activeDhikr.target > 0 && (
              <circle
                cx="130" cy="130" r="110"
                fill="none"
                stroke={activeDhikr.color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 130 130)"
                style={{ transition: 'stroke-dashoffset 0.3s ease', filter: `drop-shadow(0 0 8px ${activeDhikr.color}50)` }}
              />
            )}
          </svg>

          {/* Tap button */}
          <button
            ref={tapRef}
            onClick={handleTap}
            className="absolute inset-0 flex flex-col items-center justify-center rounded-full transition-transform active:scale-95 select-none"
            style={{ background: `radial-gradient(circle, ${activeDhikr.color}15, transparent)` }}
          >
            {activeDhikr.arabic && (
              <p className="font-arabic text-base mb-2 text-center px-8 leading-relaxed" style={{ color: activeDhikr.color }}>
                {activeDhikr.arabic}
              </p>
            )}
            <p className="text-5xl font-extrabold tabular-nums text-white">{count.toLocaleString('bn-BD')}</p>
            <p className="text-xs font-bold mt-2" style={{ color: activeDhikr.color }}>{displayName}</p>
            {activeDhikr.target > 0 && (
              <p className="text-[10px] text-gray-500 mt-1">
                / {activeDhikr.target.toLocaleString('bn-BD')} • {Math.round(progress * 100)}%
                {completedSets > 0 && ` • ${completedSets}x সম্পন্ন`}
              </p>
            )}
            <p className="text-[10px] text-gray-600 mt-2">চাপুন</p>
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleUndo} disabled={count === 0} className="btn btn-secondary text-sm">
          <i className="fas fa-undo" />পূর্বাবস্থা
        </button>
        <button onClick={handleReset} disabled={count === 0} className="btn btn-danger text-sm">
          <i className="fas fa-rotate-right" />রিসেট
        </button>
      </div>

      {/* Meaning */}
      {activeDhikr.meaning && (
        <div className="card text-center" style={{ background: `${activeDhikr.color}08`, borderColor: `${activeDhikr.color}25` }}>
          <p className="text-xs text-gray-300 italic">"{activeDhikr.meaning}"</p>
        </div>
      )}

      {/* Tip */}
      <div className="card text-center" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
        <p className="text-xs text-emerald-400">
          💡 সালাতের পর ৩৩+৩৩+৩৪ = ১০০ বার যিকির করা সুন্নাত
        </p>
      </div>
    </div>
  );
}

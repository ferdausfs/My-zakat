import { useCallback, useEffect, useRef, useState } from 'react';
import { DHIKR_PRESETS, getTodayKey, type DhikrPreset } from '../utils/tasbih';
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
  const tapRef = useRef<HTMLDivElement>(null);
  const todayKey = getTodayKey();
  const todayStats = stats[todayKey] || {};

  // Load today's count for active dhikr
  useEffect(() => {
    setCount(todayStats[activeDhikr.id] || 0);
  }, [activeDhikr.id, todayStats]);

  // Calculate total today
  useEffect(() => {
    const total = Object.values(todayStats).reduce((s, c) => s + c, 0);
    setTotalToday(total);
  }, [todayStats]);

  const handleTap = useCallback(() => {
    const newCount = count + 1;
    setCount(newCount);
    onUpdateCount(todayKey, activeDhikr.id, newCount);

    // Haptic feedback
    if (vibrate && navigator.vibrate) {
      navigator.vibrate(15);
    }

    // Check target
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

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">তাসবীহ</h1>
        <p className="text-sm text-gray-400">যিকির কাউন্টার</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setShowStats(!showStats)}
          className="card mb-0 p-2 text-center"
        >
          <p className="text-xs text-gray-400">আজকের মোট</p>
          <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
            {totalToday.toLocaleString('bn-BD')}
          </p>
        </button>
        <div className="card mb-0 p-2 text-center">
          <p className="text-xs text-gray-400">এই যিকির</p>
          <p className="text-lg font-bold text-emerald-400">
            {count.toLocaleString('bn-BD')}
          </p>
        </div>
        <div className="card mb-0 p-2 text-center">
          <p className="text-xs text-gray-400">লক্ষ্য</p>
          <p className="text-lg font-bold text-amber-400">
            {activeDhikr.target > 0 ? activeDhikr.target.toLocaleString('bn-BD') : '∞'}
          </p>
        </div>
      </div>

      {/* Today's stats detail */}
      {showStats && (
        <div className="card mb-4 max-h-48 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2 text-gray-300">আজকের যিকির তালিকা</h3>
          {Object.entries(todayStats).filter(([_, c]) => c > 0).length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">আজ এখনো কোনো যিকির হয়নি</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(todayStats)
                .filter(([_, c]) => c > 0)
                .map(([id, c]) => {
                  const preset = DHIKR_PRESETS.find(p => p.id === id);
                  return (
                    <div key={id} className="flex justify-between text-sm py-1">
                      <span className="text-gray-300 truncate flex-1">
                        {preset?.transliteration || id}
                      </span>
                      <span className="font-semibold ml-2">{c.toLocaleString('bn-BD')}</span>
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
        className="w-full card mb-4 text-center"
        style={{ padding: '12px' }}
      >
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl">{activeDhikr.arabic ? '' : '📿'}</span>
          <div>
            {activeDhikr.arabic && (
              <p className="text-2xl leading-tight font-arabic">{activeDhikr.arabic}</p>
            )}
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="text-xs text-gray-400">{activeDhikr.meaning.substring(0, 50)}...</p>
          </div>
          <i className={`fas fa-chevron-${showPresets ? 'up' : 'down'} text-gray-400`} />
        </div>
      </button>

      {/* Custom text input */}
      {activeDhikr.id === 'custom' && (
        <div className="mb-4">
          <input
            type="text"
            className="input-field text-center"
            placeholder="আপনার নিজস্ব যিকির লিখুন..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />
        </div>
      )}

      {/* Preset selector */}
      {showPresets && (
        <div className="card mb-4 max-h-64 overflow-y-auto" style={{ padding: '8px' }}>
          <div className="space-y-1">
            {DHIKR_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  setActiveDhikr(preset);
                  setShowPresets(false);
                  setCount(todayStats[preset.id] || 0);
                }}
                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition ${
                  activeDhikr.id === preset.id
                    ? 'bg-indigo-500/20 border border-indigo-400/40'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="w-10 text-center">
                  {preset.arabic ? (
                    <span className="text-xl">{preset.arabic.charAt(0)}</span>
                  ) : (
                    <i className="fas fa-plus text-gray-400" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-semibold text-sm">{preset.transliteration}</p>
                  <p className="text-xs text-gray-400 truncate">{preset.meaning}</p>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {preset.target > 0 ? `×${preset.target}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main counter — big tap area */}
      <div className="relative flex items-center justify-center mb-6">
        {/* Progress ring */}
        <svg className="absolute" width="260" height="260" viewBox="0 0 260 260">
          <circle
            cx="130" cy="130" r="110"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
          />
          {activeDhikr.target > 0 && (
            <circle
              cx="130" cy="130" r="110"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 130 130)"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          )}
        </svg>

        {/* Tap target */}
        <div
          ref={tapRef}
          onClick={handleTap}
          className="relative z-10 w-56 h-56 rounded-full flex flex-col items-center justify-center cursor-pointer select-none transition-transform active:scale-95"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.15), rgba(99,102,241,0.05))',
            border: '2px solid rgba(129,140,248,0.2)',
            boxShadow: '0 0 40px rgba(129,140,248,0.1)',
          }}
          role="button"
          aria-label="Tap to count"
        >
          {activeDhikr.arabic && (
            <p className="text-lg mb-1 opacity-80" dir="rtl">{activeDhikr.arabic}</p>
          )}
          <p className="text-5xl font-extrabold" style={{ color: 'var(--primary)' }}>
            {count.toLocaleString('bn-BD')}
          </p>
          {activeDhikr.target > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              / {activeDhikr.target.toLocaleString('bn-BD')}
              {' • '}
              {Math.round(progress * 100)}%
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={handleUndo}
          disabled={count === 0}
          className="p-3 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 transition"
          aria-label="Undo"
        >
          <i className="fas fa-undo text-lg" />
        </button>
        <button
          onClick={handleReset}
          disabled={count === 0}
          className="p-3 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 transition"
          aria-label="Reset"
        >
          <i className="fas fa-redo text-lg" />
        </button>
        <button
          onClick={() => setVibrate(!vibrate)}
          className={`p-3 rounded-full transition ${vibrate ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5'}`}
          aria-label="Toggle vibration"
        >
          <i className={`fas ${vibrate ? 'fa-mobile-alt' : 'fa-mobile'} text-lg`} />
        </button>
      </div>

      {/* Tip */}
      <div className="mt-6 text-center text-xs text-gray-500">
        <p>💡 সালাতের পর বসে ৩৩+৩৩+৩৪ = ১০০ বার যিকির করা সুন্নাত</p>
      </div>
    </div>
  );
}

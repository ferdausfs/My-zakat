import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { gregorianToHijri, formatHijriDate, getAdjustedDateForHijri } from '../utils/hijri';
import {
  ASSET_META, LIABILITY_META, calculateZakat, fmtBDT, fmtBDT2,
  GOLD_NISAB_GRAMS, SILVER_NISAB_GRAMS,
  type Asset, type AssetType, type Liability, type LiabilityType, type NisabStandard, type Prices, ZAKAT_RATE
} from '../utils/zakat';

type AddAssetInput = { type: AssetType; label: string; value: number; date: string };
type AddLiabilityInput = { type: LiabilityType; label: string; amount: number; date?: string };

interface Props {
  assets: Asset[];
  liabilities: Liability[];
  prices: Prices;
  standard: NisabStandard;
  onAddAsset: (a: AddAssetInput) => void;
  onUpdateAsset: (id: string, a: AddAssetInput) => void;
  onDeleteAsset: (id: string) => void;
  onAddLiability: (l: AddLiabilityInput) => void;
  onUpdateLiability: (id: string, l: AddLiabilityInput) => void;
  onDeleteLiability: (id: string) => void;
  onUpdatePrices: (p: Prices) => void;
  onChangeStandard: (s: NisabStandard) => void;
  showToast: (msg: string) => void;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Asset Modal ───
function AssetModal({ editing, onSave }: {
  editing?: Asset;
  onSave: (data: AddAssetInput) => void;
  onClose?: () => void;
}) {
  const [type, setType] = useState<AssetType>(editing?.type || 'cash');
  const [label, setLabel] = useState(editing?.label || '');
  const [value, setValue] = useState(editing ? String(editing.value) : '');
  const [date, setDate] = useState(editing ? editing.createdAt.split('T')[0] : todayStr());

  const meta = ASSET_META[type];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 mb-2 block">সম্পদের ধরন</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(ASSET_META) as [AssetType, typeof ASSET_META[AssetType]][]).map(([k, m]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={`p-2 rounded-xl border text-xs font-medium transition flex flex-col items-center gap-1 ${
                type === k ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300' : 'border-white/10 bg-white/3 text-gray-400 hover:border-white/20'
              }`}
            >
              <i className={`fas ${m.icon} ${type === k ? 'text-indigo-400' : m.color} text-sm`} />
              <span className="leading-tight text-center">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20 text-xs text-indigo-300">
        <i className="fas fa-info-circle mr-1" />{meta.help}
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">লেবেল</label>
        <input
          className="input-field"
          placeholder={`যেমন: ${meta.name}`}
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">
          পরিমাণ ({meta.unit === 'GRAM' ? 'গ্রাম' : '৳ টাকা'})
        </label>
        <input
          className="input-field"
          type="number"
          min="0"
          step={meta.unit === 'GRAM' ? '0.01' : '1'}
          placeholder="0"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">তারিখ (কবে থেকে আছে?)</label>
        <input
          className="input-field"
          type="date"
          value={date}
          max={todayStr()}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={() => {
          const v = parseFloat(value);
          if (!label.trim()) return alert('লেবেল দিন');
          if (isNaN(v) || v < 0) return alert('সঠিক পরিমাণ দিন');
          onSave({ type, label: label.trim(), value: v, date });
        }}
      >
        <i className="fas fa-check" />
        {editing ? 'আপডেট করুন' : 'যোগ করুন'}
      </button>
    </div>
  );
}

// ─── Liability Modal ───
function LiabModal({ editing, onSave }: {
  editing?: Liability;
  onSave: (data: AddLiabilityInput) => void;
  onClose?: () => void;
}) {
  const [type, setType] = useState<LiabilityType>(editing?.type || 'debt');
  const [label, setLabel] = useState(editing?.label || '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [date, setDate] = useState(editing ? editing.createdAt.split('T')[0] : todayStr());

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-400 mb-2 block">দায়ের ধরন</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(LIABILITY_META) as [LiabilityType, typeof LIABILITY_META[LiabilityType]][]).map(([k, m]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={`p-2 rounded-xl border text-xs font-medium transition flex items-center gap-2 ${
                type === k ? 'border-red-500 bg-red-500/15 text-red-300' : 'border-white/10 bg-white/3 text-gray-400 hover:border-white/20'
              }`}
            >
              <i className={`fas ${m.icon} ${type === k ? 'text-red-400' : m.color}`} />
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">লেবেল</label>
        <input className="input-field" placeholder="যেমন: ব্যাংক লোন" value={label} onChange={e => setLabel(e.target.value)} />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">পরিমাণ (৳ টাকা)</label>
        <input className="input-field" type="number" min="0" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">তারিখ</label>
        <input className="input-field" type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
      </div>

      <button
        className="btn btn-primary"
        onClick={() => {
          const v = parseFloat(amount);
          if (!label.trim()) return alert('লেবেল দিন');
          if (isNaN(v) || v < 0) return alert('সঠিক পরিমাণ দিন');
          onSave({ type, label: label.trim(), amount: v, date });
        }}
      >
        <i className="fas fa-check" />{editing ? 'আপডেট করুন' : 'যোগ করুন'}
      </button>
    </div>
  );
}

// ─── Status Card ───
function StatusCard({ bd, noAssets }: { bd: ReturnType<typeof calculateZakat>; noAssets: boolean }) {
  const { hawl } = bd;

  const statusConfig = {
    'no-prices': { label: 'মূল্য অনির্ধারিত', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: 'fa-circle-question' },
    'no-nisab':  { label: 'নিসাব পূর্ণ হয়নি', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: 'fa-circle-minus' },
    'awaiting':  { label: 'হাওল গণনা শুরু', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', icon: 'fa-hourglass-start' },
    'in-progress': { label: 'হাওল চলছে', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', icon: 'fa-hourglass-half' },
    'due': { label: '✅ যাকাত প্রদেয়!', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'fa-check-circle' },
  };

  const cfg = statusConfig[hawl.status];

  return (
    <div className={`card border ${cfg.border} overflow-hidden`} style={{ padding: 0 }}>
      {/* Header */}
      <div className={`${cfg.bg} px-4 py-5 text-center`}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <i className={`fas ${cfg.icon} ${cfg.color} text-xl`} />
          <span className={`font-bold text-lg ${cfg.color}`}>{cfg.label}</span>
        </div>

        {hawl.status === 'due' && (
          <div className="mt-2">
            <p className="text-xs text-gray-400 mb-1">প্রদেয় যাকাতের পরিমাণ</p>
            <p className="text-4xl font-extrabold text-emerald-300">{fmtBDT2(bd.zakatDue)}</p>
            <p className="text-xs text-emerald-500 mt-1">{(ZAKAT_RATE * 100)}% হারে</p>
          </div>
        )}

        {(hawl.status === 'in-progress' || hawl.status === 'awaiting') && (
          <div className="mt-2">
            <p className="text-xs text-gray-400 mb-1">যাকাত দেওয়ার যোগ্য সম্পদ</p>
            <p className="text-3xl font-extrabold text-indigo-200">{fmtBDT(bd.netWealth)}</p>
          </div>
        )}

        {hawl.status === 'no-nisab' && noAssets && (
          <p className="text-sm text-gray-500 mt-2">সম্পদ যোগ করুন হিসাব শুরু করতে</p>
        )}
        {hawl.status === 'no-nisab' && !noAssets && (
          <div className="mt-2">
            <p className="text-xs text-gray-400 mb-1">আপনার নিট সম্পদ</p>
            <p className="text-2xl font-bold text-gray-300">{fmtBDT(bd.netWealth)}</p>
            <p className="text-xs text-gray-500 mt-1">নিসাব: {fmtBDT(bd.effectiveNisab)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini stat card ───
function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="card" style={{ padding: '12px' }}>
      <div className="flex items-center gap-2 mb-1">
        <i className={`fas ${icon} ${color} text-sm`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}

export function ZakatPage(p: Props) {
  const { assets, liabilities, prices, standard } = p;
  const [assetModal, setAssetModal] = useState<{ open: boolean; editing?: Asset }>({ open: false });
  const [liabModal, setLiabModal] = useState<{ open: boolean; editing?: Liability }>({ open: false });
  const [pricesModal, setPricesModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'liabilities'>('assets');
  const [detailOpen, setDetailOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Prices form
  const [goldPrice, setGoldPrice] = useState(String(prices.goldPerGram));
  const [silverPrice, setSilverPrice] = useState(String(prices.silverPerGram));
  useEffect(() => { setGoldPrice(String(prices.goldPerGram)); setSilverPrice(String(prices.silverPerGram)); }, [prices]);

  const bd = useMemo(() => calculateZakat(assets, liabilities, prices, standard), [assets, liabilities, prices, standard]);
  const today = useMemo(() => new Date(), []);
  const hijriToday = useMemo(() => gregorianToHijri(getAdjustedDateForHijri(today)), [today]);
  const greeting = useMemo(() => {
    const h = today.getHours();
    return h < 5 ? 'শুভ রাত্রি' : h < 12 ? 'শুভ সকাল' : h < 17 ? 'শুভ দুপুর' : h < 20 ? 'শুভ সন্ধ্যা' : 'শুভ রাত্রি';
  }, [today]);

  const hawl = bd.hawl;

  return (
    <div className="px-4 pt-5 space-y-4 page-enter">
      {/* Header */}
      <div className="text-center">
        <p className="text-xs text-gray-500 mb-1">{greeting} 🌙</p>
        <h1 className="text-2xl font-bold tracking-tight gradient-text">আমার যাকাত</h1>
        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--primary)' }}>{formatHijriDate(hijriToday)}</p>
        <p className="text-xs text-gray-500">
          {today.toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Status Card */}
      <StatusCard bd={bd} noAssets={assets.length === 0} />

      {/* Hawl Tracker */}
      {(hawl.status === 'in-progress' || hawl.status === 'due' || hawl.status === 'awaiting') && (
        <div className="card overflow-hidden" style={{ padding: 0 }}>
          <div className="p-4" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <i className="fas fa-hourglass-half text-indigo-300 text-sm" />
                </div>
                <span className="font-bold text-sm">হাওল ট্র্যাকার</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                {hawl.daysSinceStart} / ৩৫৪ দিন
              </span>
            </div>

            <div className="w-full h-2.5 bg-black/30 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, (hawl.daysSinceStart / 354) * 100)}%`,
                  background: hawl.status === 'due'
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #818cf8, #a78bfa)',
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-gray-400">শুরু হয়েছে</p>
                <p className="text-xs font-semibold">{hawl.hawlStartHijri?.split(',')[0]}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">বাকি দিন</p>
                <p className="text-2xl font-extrabold" style={{ color: hawl.status === 'due' ? '#34d399' : 'var(--primary)' }}>
                  {hawl.daysLeft}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">পূর্ণ হবে</p>
                <p className="text-xs font-semibold">{hawl.hawlDueHijri?.split(',')[0]}</p>
              </div>
            </div>
          </div>

          {hawl.timeline.length > 0 && (
            <button
              onClick={() => setTimelineOpen(!timelineOpen)}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-300 border-t border-white/5 transition"
            >
              <i className={`fas fa-chevron-${timelineOpen ? 'up' : 'down'} mr-1`} />
              {timelineOpen ? 'টাইমলাইন লুকান' : 'ব্যালেন্স টাইমলাইন দেখুন'}
            </button>
          )}
          {timelineOpen && (
            <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
              {hawl.timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-white/5 last:border-0">
                  <span className="text-gray-500 w-20 flex-shrink-0 tabular-nums">{t.date}</span>
                  <span className="font-semibold w-24 text-right flex-shrink-0 tabular-nums">{fmtBDT(t.balance)}</span>
                  <span className="text-gray-400 flex-1">{t.event}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="মোট সম্পদ"       value={fmtBDT(bd.totalAssets)}      icon="fa-arrow-trend-up"   color="text-emerald-400" />
        <MiniStat label="মোট দায়"         value={fmtBDT(bd.totalLiabilities)} icon="fa-arrow-trend-down" color="text-rose-400" />
        <MiniStat label="নিট সম্পদ"       value={fmtBDT(bd.netWealth)}        icon="fa-scale-balanced"   color="text-sky-400" />
        <MiniStat label={`নিসাব (${standard === 'gold' ? 'সোনা' : 'রূপা'})`} value={fmtBDT(bd.effectiveNisab)} icon="fa-shield-halved" color="text-amber-400" />
      </div>

      {/* Nisab standard switcher */}
      <div className="card" style={{ padding: '12px' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-medium">নিসাবের মানদণ্ড</span>
          <button
            onClick={() => setPricesModal(true)}
            className="text-xs text-indigo-400 flex items-center gap-1"
          >
            <i className="fas fa-pen text-[10px]" />সোনা/রূপার দাম আপডেট
          </button>
        </div>
        <div className="flex gap-2">
          {(['silver', 'gold'] as NisabStandard[]).map(s => (
            <button
              key={s}
              onClick={() => p.onChangeStandard(s)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                standard === s
                  ? s === 'silver' ? 'bg-slate-500/20 border-slate-400 text-slate-200' : 'bg-yellow-500/15 border-yellow-500 text-yellow-300'
                  : 'border-white/10 text-gray-500'
              }`}
            >
              {s === 'silver' ? `🪙 রূপা (${SILVER_NISAB_GRAMS}g)` : `💍 সোনা (${GOLD_NISAB_GRAMS}g)`}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 rounded-lg bg-white/3">
            <p className="text-gray-500">সোনার নিসাব</p>
            <p className="font-bold text-yellow-400">{fmtBDT(bd.goldNisabBDT)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/3">
            <p className="text-gray-500">রূপার নিসাব</p>
            <p className="font-bold text-slate-300">{fmtBDT(bd.silverNisabBDT)}</p>
          </div>
        </div>
      </div>

      {/* Asset Breakdown Detail */}
      {bd.assetBreakdown.length > 0 && (
        <button onClick={() => setDetailOpen(!detailOpen)} className="btn btn-secondary text-sm">
          <i className={`fas fa-chevron-${detailOpen ? 'up' : 'down'}`} />
          বিস্তারিত হিসাব
        </button>
      )}
      {detailOpen && (
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-gray-400 mb-3">সম্পদের বিবরণ</p>
          {bd.assetBreakdown.map((a, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
              <span className="text-gray-300 flex items-center gap-2">
                <i className={`fas ${ASSET_META[a.type].icon} ${ASSET_META[a.type].color} text-sm`} />
                {a.label}
              </span>
              <span className="font-semibold">{fmtBDT(a.bdt)}</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
            <span className="text-gray-300">নিট যাকাতযোগ্য</span>
            <span className="text-sky-400">{fmtBDT(bd.netWealth)}</span>
          </div>
          {bd.meetsNisab && (
            <div className="flex justify-between font-bold text-lg" style={{ color: 'var(--primary)' }}>
              <span>প্রদেয় যাকাত (২.৫%)</span>
              <span>{fmtBDT2(bd.zakatDue || bd.netWealth * 0.025)}</span>
            </div>
          )}
        </div>
      )}

      {/* Assets & Liabilities */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex p-1 gap-1 bg-black/20">
          <button
            onClick={() => setActiveTab('assets')}
            className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
          >
            <i className="fas fa-arrow-trend-up mr-1" />সম্পদ ({assets.length})
          </button>
          <button
            onClick={() => setActiveTab('liabilities')}
            className={`tab-btn ${activeTab === 'liabilities' ? 'active' : ''}`}
          >
            <i className="fas fa-arrow-trend-down mr-1" />দায় ({liabilities.length})
          </button>
        </div>

        <div className="p-3 space-y-2">
          {activeTab === 'assets' && (
            <>
              {assets.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <i className="fas fa-wallet text-3xl mb-2 opacity-30 block" />
                  <p className="text-sm">কোনো সম্পদ নেই</p>
                  <p className="text-xs mt-1">নিচের বোতামে চাপুন</p>
                </div>
              )}
              {assets.map(a => {
                const m = ASSET_META[a.type];
                const bdt = a.type === 'gold' ? a.value * prices.goldPerGram : a.type === 'silver' ? a.value * prices.silverPerGram : a.value;
                return (
                  <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.bg} border border-white/5`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-black/20`}>
                      <i className={`fas ${m.icon} ${m.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.label}</p>
                      <p className="text-xs text-gray-400">
                        {a.type === 'gold' || a.type === 'silver' ? `${a.value}g → ` : ''}
                        {fmtBDT(bdt)}
                      </p>
                      <p className="text-[10px] text-gray-600">{a.createdAt.split('T')[0]}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => setAssetModal({ open: true, editing: a })}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-indigo-400 transition"
                      >
                        <i className="fas fa-pen text-xs" />
                      </button>
                      <button
                        onClick={() => { if (confirm('মুছে ফেলবেন?')) { p.onDeleteAsset(a.id); p.showToast('সম্পদ মুছা হয়েছে'); } }}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 transition"
                      >
                        <i className="fas fa-trash text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setAssetModal({ open: true })}
                className="btn btn-primary text-sm mt-2"
              >
                <i className="fas fa-plus" />সম্পদ যোগ করুন
              </button>
            </>
          )}

          {activeTab === 'liabilities' && (
            <>
              {liabilities.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <i className="fas fa-file-invoice-dollar text-3xl mb-2 opacity-30 block" />
                  <p className="text-sm">কোনো দায় নেই</p>
                </div>
              )}
              {liabilities.map(l => {
                const m = LIABILITY_META[l.type];
                return (
                  <div key={l.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.bg} border border-white/5`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-black/20">
                      <i className={`fas ${m.icon} ${m.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{l.label}</p>
                      <p className="text-xs text-red-400">{fmtBDT(l.amount)}</p>
                      <p className="text-[10px] text-gray-600">{l.createdAt.split('T')[0]}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => setLiabModal({ open: true, editing: l })}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-indigo-400 transition"
                      >
                        <i className="fas fa-pen text-xs" />
                      </button>
                      <button
                        onClick={() => { if (confirm('মুছে ফেলবেন?')) { p.onDeleteLiability(l.id); p.showToast('দায় মুছা হয়েছে'); } }}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 transition"
                      >
                        <i className="fas fa-trash text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setLiabModal({ open: true })} className="btn btn-danger text-sm mt-2">
                <i className="fas fa-plus" />দায় যোগ করুন
              </button>
            </>
          )}
        </div>
      </div>

      {/* Zakat distribution guide - shown when due */}
      {bd.hawl.status === 'due' && bd.zakatDue > 0 && (
        <div className="card" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)', padding: 0, overflow: 'hidden' }}>
          <div className="p-4 border-b border-emerald-500/15">
            <p className="font-bold text-sm text-emerald-400 flex items-center gap-2">
              <i className="fas fa-hand-holding-heart" />যাকাত বিতরণ গাইড
            </p>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs text-gray-400 mb-3">যাকাত যাদের দেওয়া যায় (সূরা তাওবা: ৬০)</p>
            {[
              { icon: 'fa-user-minus', label: 'ফকির (অতিদরিদ্র)', color: 'text-rose-400' },
              { icon: 'fa-hand-holding', label: 'মিসকিন (দরিদ্র)', color: 'text-orange-400' },
              { icon: 'fa-person-walking-luggage', label: 'মুসাফির (বিপদগ্রস্ত)', color: 'text-amber-400' },
              { icon: 'fa-link-slash', label: 'ঋণগ্রস্ত ব্যক্তি', color: 'text-yellow-400' },
              { icon: 'fa-flag', label: 'ইসলামের পথে', color: 'text-emerald-400' },
              { icon: 'fa-person-rays', label: 'দাস মুক্তি', color: 'text-sky-400' },
              { icon: 'fa-people-roof', label: 'নতুন মুসলিম', color: 'text-indigo-400' },
              { icon: 'fa-building-user', label: 'যাকাত কর্মী', color: 'text-violet-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <i className={`fas ${item.icon} ${item.color} w-4 text-center`} />
                <span className="text-gray-300">{item.label}</span>
              </div>
            ))}
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 font-bold text-center">
                মোট যাকাত: {fmtBDT2(bd.zakatDue)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Islamic tip */}
      <div className="card text-center" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
        <p className="text-xs text-emerald-400 italic">
          "যাকাত ইসলামের পাঁচটি স্তম্ভের একটি — এটি সম্পদ পবিত্র করে।"
        </p>
      </div>

      {/* Modals */}
      <Modal open={assetModal.open} onClose={() => setAssetModal({ open: false })} title={assetModal.editing ? 'সম্পদ আপডেট' : 'নতুন সম্পদ'}>
        <AssetModal
          editing={assetModal.editing}
          onSave={data => {
            if (assetModal.editing) { p.onUpdateAsset(assetModal.editing.id, data); p.showToast('সম্পদ আপডেট হয়েছে'); }
            else { p.onAddAsset(data); p.showToast('সম্পদ যোগ হয়েছে'); }
            setAssetModal({ open: false });
          }}
          onClose={() => setAssetModal({ open: false })}
        />
      </Modal>

      <Modal open={liabModal.open} onClose={() => setLiabModal({ open: false })} title={liabModal.editing ? 'দায় আপডেট' : 'নতুন দায়'}>
        <LiabModal
          editing={liabModal.editing}
          onSave={data => {
            if (liabModal.editing) { p.onUpdateLiability(liabModal.editing.id, data); p.showToast('দায় আপডেট হয়েছে'); }
            else { p.onAddLiability(data); p.showToast('দায় যোগ হয়েছে'); }
            setLiabModal({ open: false });
          }}
          onClose={() => setLiabModal({ open: false })}
        />
      </Modal>

      <Modal open={pricesModal} onClose={() => setPricesModal(false)} title="সোনা/রূপার বর্তমান দাম">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
            <i className="fas fa-info-circle mr-1" />বাজারের সর্বশেষ দাম দিন। সঠিক নিসাব নির্ধারণে গুরুত্বপূর্ণ।
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">💍 সোনার দাম (টাকা/গ্রাম)</label>
            <input className="input-field" type="number" value={goldPrice} onChange={e => setGoldPrice(e.target.value)} placeholder="১৩৫০০" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">🪙 রূপার দাম (টাকা/গ্রাম)</label>
            <input className="input-field" type="number" value={silverPrice} onChange={e => setSilverPrice(e.target.value)} placeholder="১৬৫" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-gray-400">সোনার নিসাব ({GOLD_NISAB_GRAMS}g)</p>
              <p className="font-bold text-yellow-400">{fmtBDT(GOLD_NISAB_GRAMS * (parseFloat(goldPrice) || 0))}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
              <p className="text-gray-400">রূপার নিসাব ({SILVER_NISAB_GRAMS}g)</p>
              <p className="font-bold text-slate-300">{fmtBDT(SILVER_NISAB_GRAMS * (parseFloat(silverPrice) || 0))}</p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              const gp = parseFloat(goldPrice);
              const sp = parseFloat(silverPrice);
              if (isNaN(gp) || isNaN(sp) || gp < 0 || sp < 0) return alert('সঠিক দাম দিন');
              p.onUpdatePrices({ goldPerGram: gp, silverPerGram: sp });
              p.showToast('দাম আপডেট হয়েছে ✅');
              setPricesModal(false);
            }}
          >
            <i className="fas fa-check" />সংরক্ষণ করুন
          </button>
        </div>
      </Modal>
    </div>
  );
}

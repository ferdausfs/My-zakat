import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { gregorianToHijri, formatHijriDate, getAdjustedDateForHijri } from '../utils/hijri';
import {
  ASSET_META, LIABILITY_META, calculateZakat, fmtBDT, fmtBDT2,
  GOLD_NISAB_GRAMS, SILVER_NISAB_GRAMS,
  type Asset, type AssetType, type Liability, type LiabilityType, type NisabStandard, type Prices
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

export function ZakatPage(p: Props) {
  const { assets, liabilities, prices, standard, onAddAsset, onUpdateAsset, onDeleteAsset,
    onAddLiability, onUpdateLiability, onDeleteLiability, onUpdatePrices, onChangeStandard, showToast } = p;

  const [assetModal, setAssetModal] = useState<{ open: boolean; editing?: Asset }>({ open: false });
  const [liabModal, setLiabModal] = useState<{ open: boolean; editing?: Liability }>({ open: false });
  const [pricesModal, setPricesModal] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const bd = useMemo(() => calculateZakat(assets, liabilities, prices, standard),
    [assets, liabilities, prices, standard]);

  const today = useMemo(() => new Date(), []);
  const hijriToday = useMemo(() => gregorianToHijri(getAdjustedDateForHijri(today)), [today]);
  const greeting = useMemo(() => {
    const h = today.getHours();
    return h < 12 ? 'শুভ সকাল' : h < 17 ? 'শুভ দুপুর' : h < 20 ? 'শুভ সন্ধ্যা' : 'শুভ রাত্রি';
  }, [today]);

  const hawl = bd.hawl;

  return (
    <div className="px-4 pt-5 space-y-4">
      {/* ─── Header ─── */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--primary)' }}>{formatHijriDate(hijriToday)}</p>
        <p className="text-xs text-gray-500">
          {today.toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ─── Zakat Status ─── */}
      <StatusCard bd={bd} />

      {/* ─── Hawl Timeline ─── */}
      {(hawl.status === 'in-progress' || hawl.status === 'due') && (
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
                {hawl.daysSinceStart} / {354} দিন
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden mb-3">
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
                <p className="text-[10px] text-gray-400">শুরু</p>
                <p className="text-xs font-semibold">{hawl.hawlStartHijri?.split(',')[0]}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">বাকি</p>
                <p className="text-xl font-extrabold" style={{ color: hawl.status === 'due' ? '#34d399' : 'var(--primary)' }}>
                  {hawl.daysLeft}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">পূর্ণ হবে</p>
                <p className="text-xs font-semibold">{hawl.hawlDueHijri?.split(',')[0]}</p>
              </div>
            </div>
          </div>

          {/* Timeline toggle */}
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
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-white/5 last:border-0">
                  <span className="text-gray-500 w-20 flex-shrink-0">{t.date}</span>
                  <span className="font-semibold w-20 text-right flex-shrink-0">{fmtBDT(t.balance)}</span>
                  <span className="text-gray-400 flex-1">{t.event}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Stats Grid ─── */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="মোট সম্পদ" value={fmtBDT(bd.totalAssets)} icon="fa-arrow-trend-up" color="text-emerald-400" />
        <MiniStat label="মোট দায়" value={fmtBDT(bd.totalLiabilities)} icon="fa-arrow-trend-down" color="text-rose-400" />
        <MiniStat label="নিট সম্পদ" value={fmtBDT(bd.netWealth)} icon="fa-scale-balanced" color="text-sky-400" />
        <MiniStat label={`নিসাব (${standard === 'gold' ? 'সোনা' : 'রূপা'})`} value={fmtBDT(bd.effectiveNisab)} icon="fa-shield-halved" color="text-amber-400" />
      </div>

      {/* ─── Detail Toggle ─── */}
      {bd.assetBreakdown.length > 0 && (
        <button onClick={() => setDetailOpen(!detailOpen)} className="btn btn-secondary text-sm">
          <i className={`fas fa-chevron-${detailOpen ? 'up' : 'down'}`} />
          বিস্তারিত হিসাব
        </button>
      )}
      {detailOpen && (
        <div className="card space-y-2">
          {bd.assetBreakdown.map((a, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-300">
                <i className={`fas ${ASSET_META[a.type].icon} mr-2 ${ASSET_META[a.type].color}`} />{a.label}
              </span>
              <span className="font-semibold">{fmtBDT(a.bdt)}</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
            <span>নিট যাকাতযোগ্য</span>
            <span className="text-sky-400">{fmtBDT(bd.netWealth)}</span>
          </div>
          {bd.meetsNisab && (
            <div className="flex justify-between font-bold text-lg" style={{ color: 'var(--primary)' }}>
              <span>প্রদেয় যাকাত (২.৫%)</span>
              <span>{fmtBDT2(bd.zakatDue)}</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Assets ─── */}
      <div className="card" style={{ padding: 0 }}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-bold flex items-center gap-2">
            <i className="fas fa-coins text-emerald-400" /> সম্পদ ({assets.length})
          </h2>
          <button onClick={() => setAssetModal({ open: true })}
            className="text-xs px-3 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition font-semibold">
            <i className="fas fa-plus mr-1" /> যোগ
          </button>
        </div>
        {assets.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-4xl mb-3 opacity-30">💰</div>
            <p className="text-gray-400 text-sm">কোনো সম্পদ যোগ করা হয়নি</p>
            <p className="text-gray-500 text-xs mt-1">প্রতিটি লেনদেনে তারিখ দিন — হাওল স্বয়ংক্রিয় হিসাব হবে</p>
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-1">
            {assets.map(a => {
              const m = ASSET_META[a.type];
              const bdt = a.type === 'gold' ? a.value * prices.goldPerGram : a.type === 'silver' ? a.value * prices.silverPerGram : a.value;
              const dStr = a.createdAt ? new Date(a.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
              return (
                <button key={a.id} onClick={() => setAssetModal({ open: true, editing: a })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left">
                  <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center ${m.color}`}>
                    <i className={`fas ${m.icon}`} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-semibold text-sm truncate">{a.label}</p>
                    <p className="text-[11px] text-gray-500">
                      {m.name}{m.unit === 'GRAM' && ` • ${a.value}গ্রাম`}{dStr && ` • 📅 ${dStr}`}
                    </p>
                  </div>
                  <p className="font-bold text-sm text-emerald-400 whitespace-nowrap">{fmtBDT(bdt)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Liabilities ─── */}
      <div className="card" style={{ padding: 0 }}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-bold flex items-center gap-2">
            <i className="fas fa-file-invoice text-rose-400" /> দায়/ঋণ ({liabilities.length})
          </h2>
          <button onClick={() => setLiabModal({ open: true })}
            className="text-xs px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition font-semibold">
            <i className="fas fa-plus mr-1" /> যোগ
          </button>
        </div>
        {liabilities.length === 0 ? (
          <div className="text-center py-6 px-4">
            <p className="text-gray-500 text-sm">কোনো দায় বা ঋণ নেই</p>
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-1">
            {liabilities.map(l => {
              const m = LIABILITY_META[l.type];
              return (
                <button key={l.id} onClick={() => setLiabModal({ open: true, editing: l })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left">
                  <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center ${m.color}`}>
                    <i className={`fas ${m.icon}`} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-semibold text-sm truncate">{l.label}</p>
                    <p className="text-[11px] text-gray-500">{m.name}</p>
                  </div>
                  <p className="font-bold text-sm text-rose-400 whitespace-nowrap">{fmtBDT(l.amount)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Nisab Settings ─── */}
      <div className="card">
        <h2 className="font-bold flex items-center gap-2 mb-3">
          <i className="fas fa-sliders text-indigo-300" /> নিসাব সেটিংস
        </h2>
        <div className="flex gap-2 p-1 bg-black/30 rounded-full mb-3">
          <button onClick={() => onChangeStandard('silver')} className={`tab-btn ${standard === 'silver' ? 'active' : ''}`}>
            রূপা ({SILVER_NISAB_GRAMS}g)
          </button>
          <button onClick={() => onChangeStandard('gold')} className={`tab-btn ${standard === 'gold' ? 'active' : ''}`}>
            সোনা ({GOLD_NISAB_GRAMS}g)
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div className="bg-black/20 p-2 rounded-lg text-center">
            <p className="text-[10px] text-gray-500">সোনা/গ্রাম</p>
            <p className="font-bold text-yellow-400">{fmtBDT(prices.goldPerGram)}</p>
          </div>
          <div className="bg-black/20 p-2 rounded-lg text-center">
            <p className="text-[10px] text-gray-500">রূপা/গ্রাম</p>
            <p className="font-bold text-gray-300">{fmtBDT(prices.silverPerGram)}</p>
          </div>
        </div>
        <button onClick={() => setPricesModal(true)} className="btn btn-secondary text-sm">
          <i className="fas fa-edit" /> মূল্য আপডেট
        </button>
      </div>

      {/* ─── Info ─── */}
      <div className="card text-xs text-gray-400 leading-relaxed space-y-2">
        <p className="font-bold text-sm text-gray-300"><i className="fas fa-clock mr-2 text-indigo-300" />হাওল কিভাবে কাজ করে?</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>প্রতিটি লেনদেনের <strong>তারিখ</strong> অনুযায়ী প্রতিটি দিনের ব্যালেন্স হিসাব হয়</li>
          <li>প্রথম যেদিন সম্পদ নিসাব ছুঁইয়েছে → সেদিন থেকে ৩৫৪ দিন গণনা</li>
          <li>সম্পদ শূন্য হলে → হাওল রিসেট। আবার নিসাব ছুঁইলে → নতুন হাওল</li>
          <li>নিসাবের নিচে কিন্তু উপরে → হাওল চলতে থাকে (হানাফি মত)</li>
        </ul>
        <p className="text-center text-gray-500 pt-2">
          📖 "তোমরা সালাত কায়েম কর এবং যাকাত প্রদান কর।" — সূরা বাকারা: ৪৩
        </p>
      </div>

      {/* ─── Modals ─── */}
      <AssetModal open={assetModal.open} editing={assetModal.editing}
        onClose={() => setAssetModal({ open: false })}
        onSave={(data) => {
          if (assetModal.editing) { onUpdateAsset(assetModal.editing.id, data); showToast('সম্পদ আপডেট হয়েছে'); }
          else { onAddAsset(data); showToast('সম্পদ যোগ হয়েছে'); }
          setAssetModal({ open: false });
        }}
        onDelete={() => { if (assetModal.editing) { onDeleteAsset(assetModal.editing.id); showToast('মুছে ফেলা হয়েছে'); setAssetModal({ open: false }); } }}
      />
      <LiabModal open={liabModal.open} editing={liabModal.editing}
        onClose={() => setLiabModal({ open: false })}
        onSave={(data) => {
          if (liabModal.editing) { onUpdateLiability(liabModal.editing.id, data); showToast('দায় আপডেট হয়েছে'); }
          else { onAddLiability(data); showToast('দায় যোগ হয়েছে'); }
          setLiabModal({ open: false });
        }}
        onDelete={() => { if (liabModal.editing) { onDeleteLiability(liabModal.editing.id); showToast('মুছে ফেলা হয়েছে'); setLiabModal({ open: false }); } }}
      />
      <PricesModal open={pricesModal} prices={prices}
        onClose={() => setPricesModal(false)}
        onSave={(pr) => { onUpdatePrices(pr); setPricesModal(false); showToast('মূল্য আপডেট হয়েছে'); }}
      />
    </div>
  );
}

// ═══════════════════════════════════════
// STATUS CARD
// ═══════════════════════════════════════
function StatusCard({ bd }: { bd: ReturnType<typeof calculateZakat> }) {
  const h = bd.hawl;

  if (h.status === 'no-prices') {
    return (
      <div className="card border border-amber-500/30" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))' }}>
        <div className="flex items-center gap-3">
          <i className="fas fa-exclamation-triangle text-2xl text-amber-400" />
          <div>
            <p className="font-bold text-amber-300">সোনা/রূপার মূল্য দিন</p>
            <p className="text-xs text-gray-400">নিসাব হিসাবের জন্য নিচের সেটিংস থেকে মূল্য আপডেট করুন।</p>
          </div>
        </div>
      </div>
    );
  }
  if (h.status === 'no-nisab') {
    return (
      <div className="card border border-gray-700/50" style={{ background: 'linear-gradient(135deg, rgba(107,114,128,0.1), transparent)' }}>
        <div className="flex items-center gap-3">
          <i className="fas fa-circle-info text-2xl text-gray-500" />
          <div>
            <p className="font-bold">যাকাত প্রযোজ্য নয়</p>
            <p className="text-xs text-gray-400">
              নিট {fmtBDT(bd.netWealth)} &lt; নিসাব {fmtBDT(bd.effectiveNisab)}
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (h.status === 'awaiting') {
    return (
      <div className="card border border-indigo-500/30" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))' }}>
        <div className="text-center">
          <div className="text-3xl mb-2">⭐</div>
          <p className="font-bold text-lg">আপনি নিসাবের মালিক!</p>
          <p className="text-xs text-gray-300 mt-1">আজ থেকে ৩৫৪ দিনের হাওল গণনা শুরু।</p>
        </div>
      </div>
    );
  }
  if (h.status === 'due') {
    return (
      <div className="card border-0" style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: '#fff' }}>
        <div className="text-center">
          <div className="text-3xl mb-2">🤲</div>
          <p className="text-sm opacity-80 font-medium">যাকাত ফরজ হয়েছে</p>
          <p className="text-4xl font-extrabold my-2">{fmtBDT2(bd.zakatDue)}</p>
          <div className="border-t border-white/20 pt-2 text-xs space-y-0.5 opacity-80">
            <p>হাওল শুরু: {h.hawlStartHijri}</p>
            <p className="font-semibold">প্রদানের তারিখ: {h.hawlDueHijri}</p>
          </div>
        </div>
      </div>
    );
  }
  // in-progress is handled by the Hawl Tracker card above
  return null;
}

// ═══════════════════════════════════════
// MINI STAT
// ═══════════════════════════════════════
function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="card p-3" style={{ marginBottom: 0 }}>
      <p className="text-[10px] text-gray-500 mb-0.5"><i className={`fas ${icon} mr-1 ${color}`} />{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════
// ASSET MODAL
// ═══════════════════════════════════════
function AssetModal({ open, editing, onClose, onSave, onDelete }: {
  open: boolean; editing?: Asset; onClose: () => void;
  onSave: (d: AddAssetInput) => void; onDelete: () => void;
}) {
  const [type, setType] = useState<AssetType>(editing?.type || 'cash');
  const [label, setLabel] = useState(editing?.label || '');
  const [value, setValue] = useState(editing?.value?.toString() || '');
  const [date, setDate] = useState(
    editing?.createdAt ? new Date(editing.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (open) {
      setType(editing?.type || 'cash');
      setLabel(editing?.label || '');
      setValue(editing?.value?.toString() || '');
      setDate(editing?.createdAt ? new Date(editing.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    }
  }, [open, editing]);

  if (!open) return null;
  const meta = ASSET_META[type];

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'সম্পদ এডিট' : 'নতুন সম্পদ'}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const v = parseFloat(value);
        if (isNaN(v) || v < 0 || !date) return;
        onSave({ type, label: label.trim() || meta.name, value: v, date });
      }}>
        <div>
          <label className="block text-xs text-gray-400 mb-2">ধরন</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ASSET_META) as AssetType[]).map(t => (
              <button type="button" key={t} onClick={() => setType(t)}
                className={`p-2 rounded-xl border text-xs transition ${type === t ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <i className={`fas ${ASSET_META[t].icon} block mb-1 ${ASSET_META[t].color}`} />
                {ASSET_META[t].name}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
          <i className="fas fa-calendar-day mr-1" />
          <strong>তারিখ দিন</strong> — কোন তারিখে এই সম্পদ আপনার হাতে এসেছে? হাওল এই তারিখ থেকে গণনা হবে।
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">লেনদেনের তারিখ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">বিবরণ</label>
          <input type="text" className="input-field" placeholder={meta.name} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">পরিমাণ ({meta.unit === 'GRAM' ? 'গ্রাম' : '৳ টাকা'})</label>
          <input type="number" className="input-field" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} step="any" required inputMode="decimal" />
        </div>
        <p className="text-[11px] text-gray-500 bg-black/20 p-2 rounded-lg"><i className="fas fa-info-circle mr-1" />{meta.help}</p>
        <button type="submit" className="btn btn-primary">
          <i className="fas fa-check" /> {editing ? 'আপডেট' : 'যোগ করুন'}
        </button>
        {editing && <button type="button" onClick={onDelete} className="btn btn-danger"><i className="fas fa-trash" /> ডিলিট</button>}
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════
// LIABILITY MODAL
// ═══════════════════════════════════════
function LiabModal({ open, editing, onClose, onSave, onDelete }: {
  open: boolean; editing?: Liability; onClose: () => void;
  onSave: (d: AddLiabilityInput) => void; onDelete: () => void;
}) {
  const [type, setType] = useState<LiabilityType>(editing?.type || 'debt');
  const [label, setLabel] = useState(editing?.label || '');
  const [amount, setAmount] = useState(editing?.amount?.toString() || '');
  const [date, setDate] = useState(
    editing?.createdAt ? new Date(editing.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (open) {
      setType(editing?.type || 'debt');
      setLabel(editing?.label || '');
      setAmount(editing?.amount?.toString() || '');
      setDate(editing?.createdAt ? new Date(editing.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    }
  }, [open, editing]);

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'দায় এডিট' : 'নতুন দায়'}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const v = parseFloat(amount);
        if (isNaN(v) || v < 0) return;
        onSave({ type, label: label.trim() || LIABILITY_META[type].name, amount: v, date });
      }}>
        <div>
          <label className="block text-xs text-gray-400 mb-2">ধরন</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(LIABILITY_META) as LiabilityType[]).map(t => (
              <button type="button" key={t} onClick={() => setType(t)}
                className={`p-3 rounded-xl border text-sm transition ${type === t ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <i className={`fas ${LIABILITY_META[t].icon} mr-2 ${LIABILITY_META[t].color}`} />{LIABILITY_META[t].name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">তারিখ</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">বিবরণ</label>
          <input type="text" className="input-field" placeholder="যেমন: বন্ধুর কাছে ঋণ" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">পরিমাণ (৳)</label>
          <input type="number" className="input-field" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} step="any" required inputMode="decimal" />
        </div>
        <button type="submit" className="btn btn-primary"><i className="fas fa-check" /> {editing ? 'আপডেট' : 'যোগ করুন'}</button>
        {editing && <button type="button" onClick={onDelete} className="btn btn-danger"><i className="fas fa-trash" /> ডিলিট</button>}
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════
// PRICES MODAL
// ═══════════════════════════════════════
function PricesModal({ open, prices, onClose, onSave }: {
  open: boolean; prices: Prices; onClose: () => void; onSave: (p: Prices) => void;
}) {
  const [gold, setGold] = useState(prices.goldPerGram.toString());
  const [silver, setSilver] = useState(prices.silverPerGram.toString());

  useEffect(() => {
    if (open) { setGold(prices.goldPerGram.toString()); setSilver(prices.silverPerGram.toString()); }
  }, [open, prices]);

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="সোনা/রূপার মূল্য">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        onSave({ goldPerGram: parseFloat(gold) || 0, silverPerGram: parseFloat(silver) || 0 });
      }}>
        <p className="text-xs text-gray-400 bg-black/20 p-3 rounded-lg">
          <i className="fas fa-info-circle mr-1 text-amber-300" /> প্রতি গ্রামের বর্তমান বাজার মূল্য দিন (২৪ ক্যারেট)
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1"><i className="fas fa-ring text-yellow-400 mr-1" /> সোনা/গ্রাম (৳)</label>
          <input type="number" className="input-field" value={gold} onChange={(e) => setGold(e.target.value)} step="any" required />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1"><i className="fas fa-coins text-gray-300 mr-1" /> রূপা/গ্রাম (৳)</label>
          <input type="number" className="input-field" value={silver} onChange={(e) => setSilver(e.target.value)} step="any" required />
        </div>
        <button type="submit" className="btn btn-primary"><i className="fas fa-save" /> সেভ করুন</button>
      </form>
    </Modal>
  );
}

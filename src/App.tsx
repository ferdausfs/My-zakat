import { useCallback, useEffect, useRef, useState } from 'react';
import { ZakatPage } from './pages/ZakatPage';
import { SalatPage } from './pages/SalatPage';
import { TasbihPage } from './pages/TasbihPage';
import { DuaPage } from './pages/DuaPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  loadState, saveState, DEFAULT_STATE,
  type AppState, type AppLocation, type SalatLogEntry
} from './utils/storage';
import { type Asset, type Liability, type NisabStandard, type Prices } from './utils/zakat';
import type { PrayerKey } from './utils/prayerTimes';
import { setAccessToken } from './utils/googleDrive';
import { isRamadan, ramadanDaysInfo } from './utils/hijri';

type Page = 'zakat' | 'salat' | 'tasbih' | 'dua' | 'settings';

const NAV: readonly { key: Page; label: string; icon: string }[] = [
  { key: 'zakat',    label: 'যাকাত',  icon: 'fa-shield-halved' },
  { key: 'salat',    label: 'সালাত',  icon: 'fa-mosque' },
  { key: 'tasbih',   label: 'তাসবীহ', icon: 'fa-hands-praying' },
  { key: 'dua',      label: 'দোয়া',   icon: 'fa-book-quran' },
  { key: 'settings', label: 'সেটিংস', icon: 'fa-gear' },
] as const;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function useDebouncedSave(state: AppState) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveState(state); }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state]);
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [page, setPage] = useState<Page>('zakat');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDebouncedSave(state);

  useEffect(() => {
    if (state.googleAccessToken) setAccessToken(state.googleAccessToken);
  }, [state.googleAccessToken]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ─── Asset callbacks ───
  const addAsset = useCallback((data: { type: Asset['type']; label: string; value: number; date: string }) => {
    const createdAt = new Date(data.date + 'T12:00:00').toISOString();
    setState(s => ({
      ...s,
      assets: [...s.assets, { type: data.type, label: data.label, value: data.value, id: genId(), createdAt }],
    }));
  }, []);

  const updateAsset = useCallback((id: string, data: { type: Asset['type']; label: string; value: number; date: string }) => {
    const createdAt = new Date(data.date + 'T12:00:00').toISOString();
    setState(s => ({
      ...s,
      assets: s.assets.map(a => a.id === id ? { ...a, type: data.type, label: data.label, value: data.value, createdAt } : a),
    }));
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setState(s => ({ ...s, assets: s.assets.filter(a => a.id !== id) }));
  }, []);

  // ─── Liability callbacks ───
  const addLiability = useCallback((data: { type: Liability['type']; label: string; amount: number; date?: string }) => {
    const createdAt = data.date ? new Date(data.date + 'T12:00:00').toISOString() : new Date().toISOString();
    setState(s => ({ ...s, liabilities: [...s.liabilities, { ...data, id: genId(), createdAt }] }));
  }, []);

  const updateLiability = useCallback((id: string, data: { type: Liability['type']; label: string; amount: number; date?: string }) => {
    const createdAt = data.date ? new Date(data.date + 'T12:00:00').toISOString() : new Date().toISOString();
    setState(s => ({
      ...s,
      liabilities: s.liabilities.map(l => l.id === id ? { ...l, ...data, createdAt } : l),
    }));
  }, []);

  const deleteLiability = useCallback((id: string) => {
    setState(s => ({ ...s, liabilities: s.liabilities.filter(l => l.id !== id) }));
  }, []);

  const updatePrices = useCallback((p: Prices) => setState(s => ({ ...s, prices: p })), []);
  const changeStandard = useCallback((std: NisabStandard) => setState(s => ({ ...s, nisabStandard: std })), []);

  const updateSalatLog = useCallback((dateISO: string, prayerKey: PrayerKey, entry: SalatLogEntry) => {
    setState(s => ({
      ...s,
      salatLog: { ...s.salatLog, [dateISO]: { ...(s.salatLog[dateISO] || {}), [prayerKey]: entry } },
    }));
  }, []);

  const changeLocation = useCallback((loc: AppLocation) => setState(s => ({ ...s, location: loc })), []);

  const updateTasbihCount = useCallback((dateKey: string, dhikrId: string, count: number) => {
    setState(s => ({
      ...s,
      tasbihStats: { ...s.tasbihStats, [dateKey]: { ...(s.tasbihStats[dateKey] || {}), [dhikrId]: count } },
    }));
  }, []);

  const setPin = useCallback((pin: string) => setState(s => ({ ...s, pin: pin || null })), []);
  const importState = useCallback((newState: AppState) => setState({ ...DEFAULT_STATE, ...newState }), []);
  const clearAll = useCallback(() => setState(DEFAULT_STATE), []);
  const setGoogleClientId = useCallback((clientId: string | null) => setState(s => ({ ...s, googleClientId: clientId })), []);
  const setGoogleAccessToken = useCallback((token: string | null) => setState(s => ({ ...s, googleAccessToken: token })), []);
  const setLastBackupTime = useCallback((time: string) => setState(s => ({ ...s, lastBackupTime: time })), []);

  // Ramadan banner
  const inRamadan = isRamadan();
  const ramadanInfo = ramadanDaysInfo();

  return (
    <div className="app-container">
      {/* Ramadan Banner */}
      {inRamadan && ramadanInfo && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))',
          borderBottom: '1px solid rgba(139,92,246,0.2)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
        }}>
          <span style={{ color: '#a78bfa' }}>
            🌙 রমজান মুবারক! {ramadanInfo.daysGone} রোজা সম্পন্ন
          </span>
          <span style={{ color: '#818cf8' }}>
            আর {ramadanInfo.daysLeft} দিন বাকি
          </span>
        </div>
      )}

      {/* Page Content */}
      {page === 'zakat' && (
        <ZakatPage
          assets={state.assets}
          liabilities={state.liabilities}
          prices={state.prices}
          standard={state.nisabStandard}
          onAddAsset={addAsset}
          onUpdateAsset={updateAsset}
          onDeleteAsset={deleteAsset}
          onAddLiability={addLiability}
          onUpdateLiability={updateLiability}
          onDeleteLiability={deleteLiability}
          onUpdatePrices={updatePrices}
          onChangeStandard={changeStandard}
          showToast={showToast}
        />
      )}

      {page === 'salat' && (
        <SalatPage
          location={state.location}
          salatLog={state.salatLog}
          onUpdateLog={updateSalatLog}
          onChangeLocation={changeLocation}
          showToast={showToast}
        />
      )}

      {page === 'tasbih' && (
        <TasbihPage
          stats={state.tasbihStats}
          onUpdateCount={updateTasbihCount}
          showToast={showToast}
        />
      )}

      {page === 'dua' && (
        <DuaPage showToast={showToast} />
      )}

      {page === 'settings' && (
        <SettingsPage
          state={state}
          onImport={importState}
          onClearAll={clearAll}
          onSetPin={setPin}
          onSetGoogleClientId={setGoogleClientId}
          onSetGoogleAccessToken={setGoogleAccessToken}
          onSetLastBackupTime={setLastBackupTime}
          showToast={showToast}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.key}
            onClick={() => setPage(n.key)}
            className={`nav-item ${page === n.key ? 'active' : ''}`}
            aria-label={n.label}
          >
            <i className={`fas ${n.icon}`} />
            {n.label}
          </button>
        ))}
      </nav>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

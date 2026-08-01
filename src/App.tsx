import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZakatPage } from './pages/ZakatPage';
import { SalatPage } from './pages/SalatPage';
import { TasbihPage } from './pages/TasbihPage';
import { DuaPage } from './pages/DuaPage';
import { SettingsPage } from './pages/SettingsPage';
import { PinGate } from './components/PinGate';
import {
  loadState, saveState, DEFAULT_STATE, normalizeState,
  type AppState, type AppLocation, type SalatLogEntry
} from './utils/storage';
import { type Asset, type Liability, type NisabStandard, type Prices } from './utils/zakat';
import type { PrayerKey } from './utils/prayerTimes';
import {
  backupToGoogleDrive, restoreFromGoogleDrive, getBackupInfo,
  isTokenValid, silentRefreshToken
} from './utils/googleDrive';
import { GOOGLE_SYNC_ENABLED } from './config';
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
  const [unlocked, setUnlocked] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDebouncedSave(state);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ─── Google auto-sync engine ───
  // Latest-state ref so async sync logic always reads fresh data.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const syncingRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  /** Signature of the data that should trigger a cloud sync when it changes. */
  const contentKey = useMemo(() => JSON.stringify({
    a: state.assets, l: state.liabilities, p: state.prices, n: state.nisabStandard,
    s: state.salatLog, loc: state.location, t: state.tasbihStats, pin: state.pin,
  }), [state.assets, state.liabilities, state.prices, state.nisabStandard,
       state.salatLog, state.location, state.tasbihStats, state.pin]);

  /** Get a usable access token, silently refreshing when near expiry (B6). */
  const ensureFreshToken = useCallback(async (): Promise<string> => {
    const s = stateRef.current;
    if (isTokenValid(s.googleAccessToken, s.googleTokenExpiry)) return s.googleAccessToken as string;
    const tr = await silentRefreshToken().catch((e: unknown) => {
      throw new Error(`silent_refresh:${e instanceof Error ? e.message : String(e)}`);
    });
    setState(prev => ({ ...prev, googleAccessToken: tr.token, googleTokenExpiry: tr.expiresAt }));
    return tr.token;
  }, []);

  /** Map a sync failure to a user-facing code (see Settings SYNC_ERROR_TEXT). */
  const classifySyncError = useCallback((err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('silent_refresh') || /:401(:|$)/.test(msg)) return 'auth';
    if (msg.includes('accessNotConfigured')) return 'api_disabled';
    if (msg.includes('insufficientPermissions') || /:403(:|$)/.test(msg)) return 'scope_or_api';
    return 'network';
  }, []);

  /** Push current state to the signed-in user's Google Drive. */
  const pushToDrive = useCallback(async (): Promise<boolean> => {
    if (!GOOGLE_SYNC_ENABLED || syncingRef.current) return false;
    if (!stateRef.current.googleAccessToken) return false;
    syncingRef.current = true;
    try {
      const token = await ensureFreshToken();
      await backupToGoogleDrive(token, JSON.stringify(stateRef.current));
      setState(prev => ({ ...prev, lastSyncTime: new Date().toISOString(), lastSyncError: null }));
      return true;
    } catch (err) {
      // ⚠️ কখনোই এররের কারণে সেশন মুছি না — শুধু কারণটা রেকর্ড করি যাতে
      // সেটিংসে দেখা যায়। নেটওয়ার্ক ফিরলে পরের পরিবর্তনে আবার চেষ্টা হবে।
      const code = classifySyncError(err);
      setState(prev => ({ ...prev, lastSyncError: code }));
      return false;
    } finally {
      syncingRef.current = false;
    }
  }, [ensureFreshToken, classifySyncError]);

  /** Pull from Drive when the remote copy is newer than our last sync. */
  const pullFromDrive = useCallback(async (force = false): Promise<boolean> => {
    if (!GOOGLE_SYNC_ENABLED || !stateRef.current.googleAccessToken) return false;
    try {
      const token = await ensureFreshToken();
      const info = await getBackupInfo(token);
      if (!info.exists) return false;
      const localSync = stateRef.current.lastSyncTime;
      const remoteNewer = info.modifiedTime && new Date(info.modifiedTime).getTime() > new Date(localSync || 0).getTime() + 5000;
      if (!force && !remoteNewer) return false;
      const content = await restoreFromGoogleDrive(token);
      if (!content) return false;
      const parsed = JSON.parse(content);
      // Never inherit auth credentials from the pulled copy
      const remote = normalizeState(parsed);
      setState(prev => ({
        ...remote,
        googleAccessToken: prev.googleAccessToken,
        googleTokenExpiry: prev.googleTokenExpiry,
        googleEmail: prev.googleEmail,
        lastSyncTime: new Date().toISOString(),
      }));
      showToast('☁️ Google Drive থেকে সর্বশেষ ডেটা এসেছে');
      setState(prev => ({ ...prev, lastSyncError: null }));
      return true;
    } catch (err) {
      setState(prev => ({ ...prev, lastSyncError: classifySyncError(err) }));
      return false; // stay on local data — session is kept
    }
  }, [ensureFreshToken, classifySyncError, showToast]);

  // Auto-push: 3s after any real content change while signed in.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; } // skip first render (bootstrap handles it)
    if (!state.googleAccessToken) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => { pushToDrive(); }, 3000);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [contentKey, state.googleAccessToken, pushToDrive]);

  // Bootstrap: on app start, if we have a saved session → pull if remote is newer.
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (stateRef.current.googleAccessToken) { pullFromDrive(); }
  }, [pullFromDrive]);

  // Called by Settings after an interactive Google sign-in.
  const handleGoogleSignedIn = useCallback((auth: { token: string; expiresAt: number; email: string | null }) => {
    setState(s => ({ ...s, googleAccessToken: auth.token, googleTokenExpiry: auth.expiresAt, googleEmail: auth.email, lastSyncError: null }));
    // After the state settles, pull newer remote data (fresh device → gets its data back)
    setTimeout(() => {
      pullFromDrive().then(pulled => {
        if (!pulled) showToast('সাইন ইন সফল ✅ ডেটা অটো-সিঙ্ক চালু');
      });
    }, 50);
  }, [pullFromDrive, showToast]);

  const handleGoogleSignedOut = useCallback(() => {
    setState(s => ({ ...s, googleAccessToken: null, googleTokenExpiry: null, googleEmail: null, lastSyncError: null }));
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
  const importState = useCallback((newState: AppState) =>
    setState(prev => ({
      ...normalizeState(newState as unknown as Record<string, unknown>),
      // keep the current session's Google auth — restore files may predate it
      googleAccessToken: prev.googleAccessToken,
      googleTokenExpiry: prev.googleTokenExpiry,
      googleEmail: prev.googleEmail,
    })), []);
  const clearAll = useCallback(() => setState(s => ({
    ...DEFAULT_STATE,
    googleAccessToken: s.googleAccessToken,
    googleTokenExpiry: s.googleTokenExpiry,
    googleEmail: s.googleEmail,
  })), []);

  // Ramadan banner
  const inRamadan = isRamadan();
  const ramadanInfo = ramadanDaysInfo();

  // PIN lock — gate the entire app until the correct PIN is entered
  if (state.pin && !unlocked) {
    return (
      <PinGate
        expected={state.pin}
        onUnlock={() => setUnlocked(true)}
        onResetAll={() => { clearAll(); setUnlocked(true); }}
      />
    );
  }

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
          onGoogleSignedIn={handleGoogleSignedIn}
          onGoogleSignedOut={handleGoogleSignedOut}
          onSyncNow={pushToDrive}
          onPullNow={pullFromDrive}
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

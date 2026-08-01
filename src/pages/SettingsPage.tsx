import { useCallback, useState } from 'react';
import { Modal } from '../components/Modal';
import type { AppState } from '../utils/storage';
import { signInWithGoogle, revokeGoogleToken } from '../utils/googleDrive';
import { GOOGLE_SYNC_ENABLED } from '../config';

/** আসল কারণ বাংলায় — App-এর classifySyncError কোড অনুযায়ী। */
const SYNC_ERROR_TEXT: Record<string, string> = {
  auth: 'Google সেশনের মেয়াদ শেষ হয়েছে — একবার আবার সাইন ইন করলেই ঠিক হয়ে যাবে। আপনার ডেটা নিরাপদ আছে, কিছু হারাবে না।',
  api_disabled: 'অ্যাপ-মালিকের Google Console প্রজেক্টে Google Drive API Enable করা নেই। সমাধান: GOOGLE_SETUP.md-এর ধাপ ২ দেখুন।',
  scope_or_api: 'OAuth consent screen-এ drive.file scope যোগ করা নেই — অথবা Google Drive API Enable হয়নি। সমাধান: GOOGLE_SETUP.md-এর ধাপ ২ ও ৩ দেখুন।',
  network: 'মুহূর্তের জন্য ইন্টারনেটে সমস্যা মনে হচ্ছে — সংযোগ ফিরলেই আবার সিঙ্ক হবে।',
};

interface Props {
  state: AppState;
  onImport: (s: AppState) => void;
  onClearAll: () => void;
  onSetPin: (pin: string) => void;
  onGoogleSignedIn: (auth: { token: string; expiresAt: number; email: string | null }) => void;
  onGoogleSignedOut: () => void;
  onSyncNow: () => Promise<boolean>;
  onPullNow: (force?: boolean) => Promise<boolean>;
  showToast: (msg: string) => void;
}

export function SettingsPage({
  state, onImport, onClearAll, onSetPin,
  onGoogleSignedIn, onGoogleSignedOut, onSyncNow, onPullNow, showToast
}: Props) {
  const [clearConfirm, setClearConfirm] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [syncBusy, setSyncBusy] = useState<'signin' | 'sync' | 'pull' | null>(null);
  const [showPasteRestore, setShowPasteRestore] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pullConfirm, setPullConfirm] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const jsonStr = JSON.stringify(state, null, 2);
  const assetCount = state.assets.length;
  const liabCount = state.liabilities.length;
  const salatDays = Object.keys(state.salatLog).length;
  const signedIn = !!state.googleAccessToken;

  // ─── Local backup ───
  const handleDownloadBackup = useCallback(() => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amar_zakat_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ব্যাকআপ ডাউনলোড হয়েছে ✅');
  }, [jsonStr, showToast]);

  const handleCopyBackup = useCallback(() => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast('ব্যাকআপ টেক্সট কপি হয়েছে 📋');
    }).catch(() => showToast('কপি হয়নি'));
  }, [jsonStr, showToast]);

  const handleFileRestore = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        onImport(parsed); // App normalizes via normalizeState
        showToast('ডেটা রিস্টোর হয়েছে ✅');
      } catch {
        showToast('ফাইল পড়তে পারিনি ❌');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [onImport, showToast]);

  const handlePasteRestore = useCallback(() => {
    try {
      const parsed = JSON.parse(pasteText);
      onImport(parsed); // App normalizes via normalizeState
      showToast('ডেটা রিস্টোর হয়েছে ✅');
      setShowPasteRestore(false);
      setPasteText('');
    } catch {
      showToast('JSON পার্স করতে পারিনি ❌');
    }
  }, [pasteText, onImport, showToast]);

  // ─── Google সাইন-ইন / অটো-সিঙ্ক ───
  const handleSignIn = useCallback(async () => {
    setSyncBusy('signin');
    try {
      const res = await signInWithGoogle();   // বিল্ট-ইন Client ID দিয়ে
      onGoogleSignedIn({ token: res.token, expiresAt: res.expiresAt, email: res.user?.email || null });
      // সফল টোস্ট App দেখায় (pull ফলাফল অনুযায়ী)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup')) showToast('পপআপ ব্লক হয়েছে — পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন');
      else showToast('সাইন ইন হয়নি — ইন্টারনেট দেখে আবার চেষ্টা করুন');
    } finally {
      setSyncBusy(null);
    }
  }, [onGoogleSignedIn, showToast]);

  const handleSignOut = useCallback(() => {
    revokeGoogleToken(state.googleAccessToken);
    onGoogleSignedOut();
    showToast('Google সাইন আউট হয়েছে');
  }, [state.googleAccessToken, onGoogleSignedOut, showToast]);

  const handleSyncNow = useCallback(async () => {
    setSyncBusy('sync');
    const ok = await onSyncNow();
    setSyncBusy(null);
    showToast(ok ? '☁️ Google Drive-এ সিঙ্ক হয়েছে ✅' : 'সিঙ্ক হয়নি — আবার চেষ্টা করুন');
  }, [onSyncNow, showToast]);

  const handlePullNow = useCallback(async () => {
    setSyncBusy('pull');
    const ok = await onPullNow(true);
    setSyncBusy(null);
    setPullConfirm(false);
    showToast(ok ? '☁️ ক্লাউডের ডেটা এনে লাগানো হয়েছে ✅' : 'ক্লাউডে কোনো ডেটা পাওয়া যায়নি');
  }, [onPullNow, showToast]);

  return (
    <div className="px-4 pt-5 space-y-4 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold gradient-text">সেটিংস</h1>
        <p className="text-xs text-gray-400 mt-0.5">ব্যাকআপ, রিস্টোর ও অ্যাপ কনফিগার</p>
      </div>

      {/* Data overview */}
      <div className="card">
        <p className="card-title text-sm">
          <i className="fas fa-database text-indigo-400" />আপনার ডেটা
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-white/3">
            <p className="text-2xl font-extrabold text-emerald-400">{assetCount}</p>
            <p className="text-[10px] text-gray-400">সম্পদ</p>
          </div>
          <div className="p-2 rounded-xl bg-white/3">
            <p className="text-2xl font-extrabold text-rose-400">{liabCount}</p>
            <p className="text-[10px] text-gray-400">দায়</p>
          </div>
          <div className="p-2 rounded-xl bg-white/3">
            <p className="text-2xl font-extrabold text-sky-400">{salatDays}</p>
            <p className="text-[10px] text-gray-400">সালাত দিন</p>
          </div>
        </div>
        {state.lastBackupTime && (
          <p className="text-[10px] text-gray-500 text-center mt-3">
            <i className="fas fa-clock mr-1" />সর্বশেষ ব্যাকআপ: {new Date(state.lastBackupTime).toLocaleString('bn-BD')}
          </p>
        )}
      </div>

      {/* Local Backup */}
      <div className="card">
        <p className="card-title text-sm">
          <i className="fas fa-hard-drive text-sky-400" />লোকাল ব্যাকআপ
        </p>
        <div className="space-y-2">
          <button onClick={handleDownloadBackup} className="btn btn-secondary text-sm">
            <i className="fas fa-download" />JSON ফাইল ডাউনলোড
          </button>
          <button onClick={handleCopyBackup} className="btn btn-secondary text-sm">
            <i className="fas fa-copy" />ব্যাকআপ টেক্সট কপি
          </button>
          <label className="btn btn-secondary text-sm cursor-pointer">
            <i className="fas fa-upload" />JSON ফাইল থেকে রিস্টোর
            <input type="file" accept=".json" className="hidden" onChange={handleFileRestore} />
          </label>
          <button
            onClick={() => setShowPasteRestore(!showPasteRestore)}
            className="btn btn-secondary text-sm"
          >
            <i className="fas fa-paste" />টেক্সট পেস্ট করে রিস্টোর
          </button>
          {showPasteRestore && (
            <div className="space-y-2 mt-2">
              <textarea
                className="input-field h-28 resize-none"
                placeholder="এখানে JSON ব্যাকআপ পেস্ট করুন..."
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <button onClick={handlePasteRestore} disabled={!pasteText.trim()} className="btn btn-primary text-sm">
                <i className="fas fa-check" />রিস্টোর করুন
              </button>
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-500 mt-3 text-center">
          <i className="fas fa-info-circle mr-1" />সব ডেটা আপনার browser-এ সংরক্ষিত
        </p>
      </div>

      {/* Google সাইন-ইন + অটো-সিঙ্ক */}
      <div className="card">
        <p className="card-title text-sm">
          <i className="fas fa-cloud text-blue-400" />Google সাইন-ইন (অটো-সিঙ্ক)
        </p>

        {!GOOGLE_SYNC_ENABLED ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <i className="fas fa-screwdriver-wrench mr-1" />
            এই বিল্ডে Google সাইন-ইন এখনো কনফিগার হয়নি — অ্যাপ-মালিকের একবার
            <code> src/config.ts</code>-এ Client ID বসাতে হবে
            (নির্দেশিকা: <code>GOOGLE_SETUP.md</code>)। ততক্ষণ লোকাল ব্যাকআপ ব্যবহার করুন।
          </div>
        ) : !signedIn ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              আপনার Google অ্যাকাউন্ট দিয়ে লগিন করুন — যেকোনো পরিবর্তনের
              <span className="text-emerald-300"> কয়েক সেকেন্ড পরেই ডেটা স্বয়ংক্রিয়ভাবে আপনার
              Google Drive-এ সেভ</span> হবে। নতুন ফোনে লগিন করলেই সব ডেটা ফিরে আসবে।
            </p>
            <button
              onClick={handleSignIn}
              disabled={syncBusy !== null}
              className="btn text-sm w-full justify-center"
              style={{
                background: '#ffffff', color: '#1f2937',
                border: '1px solid rgba(255,255,255,0.25)', fontWeight: 600,
              }}
            >
              {syncBusy === 'signin'
                ? <><i className="fas fa-spinner spin" />Google-এ যাচ্ছে…</>
                : <><svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
                Google দিয়ে সাইন ইন করুন</>}
            </button>
            <p className="text-[10px] text-gray-500 text-center">
              🔒 আপনার ডেটা শুধু <span className="text-gray-400">আপনার নিজের</span> Google Drive-এ থাকে — অ্যাপ-মালিক বা অন্য কেউ দেখতে পায় না।
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-check text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-300 truncate">{state.googleEmail || 'Google অ্যাকাউন্ট'}</p>
                <p className="text-[10px] text-gray-400">
                  {state.lastSyncError ? 'সাইন ইন আছে · সিঙ্ক আটকে আছে' : 'অটো-সিঙ্ক চালু'}
                  {state.lastSyncTime ? ` · শেষ সিঙ্ক: ${new Date(state.lastSyncTime).toLocaleString('bn-BD')}` : ''}
                </p>
              </div>
            </div>

            {/* সিঙ্ক এরর — আসল কারণ স্পষ্ট করে */}
            {state.lastSyncError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                <p className="text-xs text-red-300 font-semibold">⚠️ সিঙ্কে সমস্যা হচ্ছে</p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {SYNC_ERROR_TEXT[state.lastSyncError] || SYNC_ERROR_TEXT.network}
                </p>
                {state.lastSyncError === 'auth' ? (
                  <button onClick={handleSignIn} disabled={syncBusy !== null} className="btn btn-primary text-xs">
                    <i className={`fas ${syncBusy === 'signin' ? 'fa-spinner spin' : 'fa-rotate-right'}`} />আবার সাইন ইন করুন
                  </button>
                ) : (
                  <p className="text-[10px] text-gray-500">স্থায়ী সমাধান হলে পরের পরিবর্তনে আবার সিঙ্ক হবে — অথবা নিচের <b>এখনই সিঙ্ক</b> চাপুন।</p>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-500">
              <i className="fas fa-bolt mr-1 text-emerald-400" />
              যেকোনো পরিবর্তনের কয়েক সেকেন্ড পরেই ডেটা স্বয়ংক্রিয়ভাবে আপনার Drive-এ সেভ হয়।
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleSyncNow} disabled={syncBusy !== null} className="btn btn-primary text-xs">
                <i className={`fas ${syncBusy === 'sync' ? 'fa-spinner spin' : 'fa-cloud-arrow-up'}`} />এখনই সিঙ্ক
              </button>
              <button onClick={() => setPullConfirm(true)} disabled={syncBusy !== null} className="btn btn-secondary text-xs">
                <i className={`fas ${syncBusy === 'pull' ? 'fa-spinner spin' : 'fa-cloud-arrow-down'}`} />ক্লাউড থেকে আনুন
              </button>
            </div>
            <button onClick={handleSignOut} disabled={syncBusy !== null} className="btn text-xs" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
              <i className="fas fa-right-from-bracket" />সাইন আউট
            </button>
          </div>
        )}
      </div>

      {/* PIN Lock */}
      <div className="card">
        <p className="card-title text-sm">
          <i className="fas fa-lock text-amber-400" />পিন লক
        </p>
        <p className="text-xs text-gray-400 mb-3">
          {state.pin ? '✅ পিন সেট আছে — অ্যাপ খোলার সময় পিন চাইবে' : 'অ্যাপ খোলার সময় পিন চাইবে'}
        </p>
        <button onClick={() => setPinModal(true)} className="btn btn-secondary text-sm">
          <i className="fas fa-key" />{state.pin ? 'পিন পরিবর্তন' : 'পিন সেট করুন'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-500/20">
        <p className="card-title text-sm text-red-400">
          <i className="fas fa-triangle-exclamation text-red-400" />বিপদ জোন
        </p>
        {!clearConfirm ? (
          <button onClick={() => setClearConfirm(true)} className="btn btn-danger text-sm">
            <i className="fas fa-trash" />সব ডেটা মুছুন
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-300 text-center font-semibold">নিশ্চিত? সব ডেটা মুছে যাবে!</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setClearConfirm(false)} className="btn btn-secondary text-sm">বাতিল</button>
              <button
                onClick={() => { onClearAll(); setClearConfirm(false); showToast('সব ডেটা মুছে গেছে'); }}
                className="btn btn-danger text-sm"
              >
                হ্যাঁ, মুছুন
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="card text-center">
        <button onClick={() => setAboutOpen(true)} className="flex items-center justify-center gap-2 w-full">
          <span className="text-2xl">🌙</span>
          <div className="text-left">
            <p className="font-bold text-sm">আমার যাকাত</p>
            <p className="text-xs text-gray-400">বাংলা মুসলিম টুলকিট v2.0</p>
          </div>
        </button>
      </div>

      {/* Cloud pull confirm */}
      <Modal open={pullConfirm} onClose={() => setPullConfirm(false)} title="ক্লাউড থেকে আনুন">
        <div className="space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            আপনার Google Drive-এ সেভ সর্বশেষ ডেটা দিয়ে এই ফোনের
            <span className="text-amber-300"> বর্তমান সব ডেটা বদলে যাবে</span>। এগিয়ে যাবেন?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-secondary text-sm" onClick={() => setPullConfirm(false)}>বাতিল</button>
            <button className="btn btn-primary text-sm" onClick={handlePullNow} disabled={syncBusy !== null}>
              {syncBusy === 'pull' && <i className="fas fa-spinner spin" />}হ্যাঁ, আনুন
            </button>
          </div>
        </div>
      </Modal>

      {/* PIN Modal */}
      <Modal open={pinModal} onClose={() => setPinModal(false)} title="পিন সেট করুন">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">নতুন পিন (৪-৬ সংখ্যা)</label>
            <input className="input-field" type="password" inputMode="numeric" maxLength={6} value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="••••" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">পিন নিশ্চিত করুন</label>
            <input className="input-field" type="password" inputMode="numeric" maxLength={6} value={pinConfirm} onChange={e => setPinConfirm(e.target.value)} placeholder="••••" />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (pinInput.length < 4) return showToast('পিন কমপক্ষে ৪ সংখ্যা হতে হবে');
              if (pinInput !== pinConfirm) return showToast('পিন মিলছে না');
              onSetPin(pinInput);
              setPinModal(false);
              setPinInput('');
              setPinConfirm('');
              showToast('পিন সেট হয়েছে ✅');
            }}
          >
            <i className="fas fa-lock" />পিন সেভ করুন
          </button>
          {state.pin && (
            <button
              className="btn btn-danger"
              onClick={() => { onSetPin(''); setPinModal(false); showToast('পিন মুছা হয়েছে'); }}
            >
              <i className="fas fa-unlock" />পিন মুছুন
            </button>
          )}
        </div>
      </Modal>

      {/* About Modal */}
      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="আমার যাকাত সম্পর্কে">
        <div className="space-y-4 text-center">
          <div className="text-5xl mb-4">🌙</div>
          <h2 className="text-xl font-bold gradient-text">আমার যাকাত</h2>
          <p className="text-sm text-gray-400">বাংলা মুসলিম টুলকিট</p>
          <div className="space-y-2 text-left">
            {[
              ['যাকাত ক্যালকুলেটর', 'হানাফি ফিকহ অনুযায়ী তারিখ-সচেতন হাওল ট্র্যাকিং', 'fa-shield-halved text-indigo-400'],
              ['সালাত ট্র্যাকার', 'সঠিক নামাজের সময়, কিবলা ও সাপ্তাহিক রিপোর্ট', 'fa-mosque text-emerald-400'],
              ['তাসবীহ কাউন্টার', 'একাধিক যিকিরের জন্য ডিজিটাল তাসবীহ', 'fa-hands-praying text-amber-400'],
              ['দোয়া সংকলন', 'দৈনন্দিন জীবনের গুরুত্বপূর্ণ দোয়া', 'fa-book-quran text-sky-400'],
            ].map(([title, desc, icon]) => (
              <div key={title} className="flex items-start gap-3 p-3 rounded-xl bg-white/3">
                <i className={`fas ${icon} mt-0.5`} />
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-white/3 text-xs text-gray-400">
            সব ডেটা আপনার ব্রাউজারে সংরক্ষিত। কোনো ডেটা সার্ভারে পাঠানো হয় না।
          </div>
        </div>
      </Modal>
    </div>
  );
}

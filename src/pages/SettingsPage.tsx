import { useCallback, useState } from 'react';
import { Modal } from '../components/Modal';
import type { AppState } from '../utils/storage';
import { DEFAULT_STATE } from '../utils/storage';
import {
  backupToGoogleDrive, restoreFromGoogleDrive, signInWithGoogle, signOut, getBackupInfo
} from '../utils/googleDrive';

interface Props {
  state: AppState;
  onImport: (s: AppState) => void;
  onClearAll: () => void;
  onSetPin: (pin: string) => void;
  onSetGoogleClientId: (id: string | null) => void;
  onSetGoogleAccessToken: (token: string | null) => void;
  onSetLastBackupTime: (time: string) => void;
  showToast: (msg: string) => void;
}

export function SettingsPage({
  state, onImport, onClearAll, onSetPin, onSetGoogleClientId,
  onSetGoogleAccessToken, onSetLastBackupTime, showToast
}: Props) {
  const [clearConfirm, setClearConfirm] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [googleClientIdInput, setGoogleClientIdInput] = useState(state.googleClientId || '');
  const [driveLoading, setDriveLoading] = useState(false);
  const [showPasteRestore, setShowPasteRestore] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [driveInfo, setDriveInfo] = useState<{ exists: boolean; modifiedTime?: string } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const jsonStr = JSON.stringify(state, null, 2);
  const assetCount = state.assets.length;
  const liabCount = state.liabilities.length;
  const salatDays = Object.keys(state.salatLog).length;

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
        onImport({ ...DEFAULT_STATE, ...parsed });
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
      onImport({ ...DEFAULT_STATE, ...parsed });
      showToast('ডেটা রিস্টোর হয়েছে ✅');
      setShowPasteRestore(false);
      setPasteText('');
    } catch {
      showToast('JSON পার্স করতে পারিনি ❌');
    }
  }, [pasteText, onImport, showToast]);

  // ─── Google Drive ───
  const handleGoogleBackup = useCallback(async () => {
    if (!state.googleClientId) return showToast('আগে Client ID দিন');
    setDriveLoading(true);
    try {
      let token = state.googleAccessToken;
      if (!token) {
        token = await signInWithGoogle(state.googleClientId);
        onSetGoogleAccessToken(token);
      }
      const result = await backupToGoogleDrive(token, jsonStr);
      const now = new Date().toISOString();
      onSetLastBackupTime(now);
      showToast(result.isNew ? 'Google Drive-এ নতুন ব্যাকআপ হয়েছে ✅' : 'Google Drive-এ ব্যাকআপ আপডেট হয়েছে ✅');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'অজানা ত্রুটি';
      if (msg.includes('popup')) {
        showToast('পপআপ ব্লক। আবার চেষ্টা করুন।');
      } else {
        showToast(`Google Drive ব্যাকআপ ব্যর্থ: ${msg.slice(0, 40)}`);
        onSetGoogleAccessToken(null);
      }
    } finally {
      setDriveLoading(false);
    }
  }, [state, jsonStr, onSetGoogleAccessToken, onSetLastBackupTime, showToast]);

  const handleGoogleRestore = useCallback(async () => {
    if (!state.googleClientId) return showToast('আগে Client ID দিন');
    setDriveLoading(true);
    try {
      let token = state.googleAccessToken;
      if (!token) {
        token = await signInWithGoogle(state.googleClientId);
        onSetGoogleAccessToken(token);
      }
      const content = await restoreFromGoogleDrive(token);
      if (!content) return showToast('Google Drive-এ কোনো ব্যাকআপ নেই');
      const parsed = JSON.parse(content);
      onImport({ ...DEFAULT_STATE, ...parsed });
      showToast('Google Drive থেকে রিস্টোর হয়েছে ✅');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'অজানা ত্রুটি';
      showToast(`রিস্টোর ব্যর্থ: ${msg.slice(0, 40)}`);
      onSetGoogleAccessToken(null);
    } finally {
      setDriveLoading(false);
    }
  }, [state, onSetGoogleAccessToken, onImport, showToast]);

  const handleCheckDrive = useCallback(async () => {
    if (!state.googleClientId) return showToast('আগে Client ID দিন');
    setDriveLoading(true);
    try {
      let token = state.googleAccessToken;
      if (!token) {
        token = await signInWithGoogle(state.googleClientId);
        onSetGoogleAccessToken(token);
      }
      const info = await getBackupInfo(token);
      setDriveInfo(info);
    } catch {
      showToast('Drive চেক করতে পারিনি');
      onSetGoogleAccessToken(null);
    } finally {
      setDriveLoading(false);
    }
  }, [state, onSetGoogleAccessToken, showToast]);

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

      {/* Google Drive */}
      <div className="card">
        <p className="card-title text-sm">
          <i className="fas fa-cloud text-blue-400" />Google Drive ব্যাকআপ (Optional)
        </p>
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
            <i className="fas fa-info-circle mr-1" />Google verification সমস্যা থাকলেও লোকাল ব্যাকআপ ব্যবহার করুন।
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Google OAuth Client ID</label>
            <input
              className="input-field text-xs"
              placeholder="xxxxx.apps.googleusercontent.com"
              value={googleClientIdInput}
              onChange={e => setGoogleClientIdInput(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              onSetGoogleClientId(googleClientIdInput.trim() || null);
              showToast(googleClientIdInput.trim() ? 'Client ID সেভ হয়েছে' : 'Client ID মুছা হয়েছে');
            }}
            className="btn btn-secondary text-sm"
          >
            <i className="fas fa-save" />Client ID সংরক্ষণ
          </button>

          {state.googleAccessToken && (
            <button
              onClick={() => { signOut(); onSetGoogleAccessToken(null); showToast('Google থেকে সাইন আউট হয়েছে'); }}
              className="btn btn-danger text-sm"
            >
              <i className="fas fa-right-from-bracket" />Google Sign Out
            </button>
          )}

          {driveInfo && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <p className="text-emerald-400 font-semibold">
                {driveInfo.exists ? '✅ Drive-এ ব্যাকআপ আছে' : '❌ Drive-এ কোনো ব্যাকআপ নেই'}
              </p>
              {driveInfo.modifiedTime && (
                <p className="text-gray-400 mt-1">সর্বশেষ: {new Date(driveInfo.modifiedTime).toLocaleString('bn-BD')}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleCheckDrive} disabled={driveLoading || !state.googleClientId} className="btn btn-secondary text-xs">
              <i className={`fas ${driveLoading ? 'fa-spinner spin' : 'fa-cloud-arrow-up'}`} />চেক
            </button>
            <button onClick={handleGoogleBackup} disabled={driveLoading || !state.googleClientId} className="btn btn-primary text-xs">
              <i className={`fas ${driveLoading ? 'fa-spinner spin' : 'fa-cloud-arrow-up'}`} />ব্যাকআপ
            </button>
            <button onClick={handleGoogleRestore} disabled={driveLoading || !state.googleClientId} className="btn btn-secondary text-xs">
              <i className={`fas ${driveLoading ? 'fa-spinner spin' : 'fa-cloud-arrow-down'}`} />রিস্টোর
            </button>
          </div>
        </div>
      </div>

      {/* PIN Lock */}
      <div className="card">
        <p className="card-title text-sm">
          <i className="fas fa-lock text-amber-400" />পিন লক
        </p>
        <p className="text-xs text-gray-400 mb-3">
          {state.pin ? '✅ পিন সেট আছে' : 'অ্যাপ লক করুন (আসছে শীঘ্রই)'}
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

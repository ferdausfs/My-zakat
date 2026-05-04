import { useRef, useState } from 'react';
import {
  signInWithGoogle, signOut, setAccessToken,
  backupToGoogleDrive, restoreFromGoogleDrive,
} from '../utils/googleDrive';
import type { AppState } from '../utils/storage';

interface Props {
  state: AppState;
  onSetPin: (pin: string) => void;
  onImport: (state: AppState) => void;
  onClearAll: () => void;
  onSetGoogleClientId: (clientId: string | null) => void;
  onSetGoogleAccessToken: (token: string | null) => void;
  onSetLastBackupTime: (time: string) => void;
  showToast: (msg: string) => void;
}

export function SettingsPage({
  state, onSetPin, onImport, onClearAll,
  onSetGoogleClientId, onSetGoogleAccessToken, onSetLastBackupTime, showToast,
}: Props) {
  const envGoogleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
  const effectiveGoogleClientId = state.googleClientId || envGoogleClientId;
  const [pin, setPin] = useState('');
  const [clientIdInput, setClientIdInput] = useState(state.googleClientId || envGoogleClientId || '');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showPasteRestore, setShowPasteRestore] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const isGoogleSignedIn = !!state.googleAccessToken;

  const handleGoogleSignIn = async () => {
    if (!effectiveGoogleClientId) {
      showToast('প্রথমে Google Client ID দিন');
      return;
    }
    setGoogleLoading(true);
    try {
      const token = await signInWithGoogle(effectiveGoogleClientId);
      onSetGoogleAccessToken(token);
      setAccessToken(token);
      showToast('Google সাইন-ইন সফল! ☁️');
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('access_denied') || msg.includes('403')) {
        showToast('Google access blocked: OAuth verification/test user দরকার');
      } else {
        showToast(`সাইন-ইন ব্যর্থ: ${msg || 'অনুগ্রহ করে আবার চেষ্টা করুন'}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignOut = () => {
    signOut();
    onSetGoogleAccessToken(null);
    showToast('Google সাইন-আউট সম্পন্ন');
  };

  const handleBackupToGoogle = async () => {
    if (!state.googleAccessToken) {
      showToast('প্রথমে Google সাইন-ইন করুন');
      return;
    }
    setGoogleLoading(true);
    try {
      const content = JSON.stringify(state);
      await backupToGoogleDrive(state.googleAccessToken, content);
      const now = new Date().toISOString();
      onSetLastBackupTime(now);
      showToast('Google Drive এ ব্যাকআপ সফল! ☁️✅');
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('invalid')) {
        onSetGoogleAccessToken(null);
        showToast('সেশন শেষ — আবার সাইন-ইন করুন');
      } else {
        showToast(`ব্যাকআপ ব্যর্থ: ${err.message}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRestoreFromGoogle = async () => {
    if (!state.googleAccessToken) {
      showToast('প্রথমে Google সাইন-ইন করুন');
      return;
    }
    if (!window.confirm('বর্তমান ডেটা মুছে Google Drive থেকে পুনরুদ্ধার করতে চান?')) return;
    setGoogleLoading(true);
    try {
      const content = await restoreFromGoogleDrive(state.googleAccessToken);
      if (!content) {
        showToast('Google Drive এ কোনো ব্যাকআপ পাওয়া যায়নি');
        return;
      }
      const parsed = JSON.parse(content);
      onImport(parsed);
      showToast('Google Drive থেকে পুনরুদ্ধার সফল! ☁️✅');
    } catch (err: any) {
      showToast(`পুনরুদ্ধার ব্যর্থ: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleExportFile = () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zakat_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ব্যাকআপ ফাইল ডাউনলোড সম্পন্ন');
  };

  const handleCopyBackup = async () => {
    const data = JSON.stringify(state);
    try {
      await navigator.clipboard.writeText(data);
      showToast('ব্যাকআপ কপি হয়েছে');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = data;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('ব্যাকআপ কপি হয়েছে');
    }
  };

  const handlePasteRestore = () => {
    try {
      const parsed = JSON.parse(pasteValue);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup');
      if (window.confirm('বর্তমান ডেটা মুছে এই backup restore করতে চান?')) {
        onImport(parsed);
        setPasteValue('');
        setShowPasteRestore(false);
        showToast('Backup restore হয়েছে');
      }
    } catch {
      showToast('Backup text সঠিক নয়');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (window.confirm('সকল বর্তমান ডেটা মুছে ব্যাকআপ পুনরুদ্ধার করতে চান?')) {
          onImport(parsed);
          showToast('ব্যাকআপ সফলভাবে পুনরুদ্ধার হয়েছে');
        }
      } catch {
        showToast('ব্যাকআপ ফাইল সঠিক নয়');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-bold">সেটিংস</h1>
        <p className="text-sm text-gray-400">আপনার অ্যাপ কনফিগার করুন</p>
      </div>

      {/* === Backup First === */}
      <div className="card border border-emerald-500/20" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.06))' }}>
        <div className="card-title">
          <i className="fas fa-shield-heart text-emerald-400" />
          নিরাপদ ব্যাকআপ
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Google verification সমস্যা থাকলেও এই ৩টি পদ্ধতিতে আপনার ডেটা সেভ/রিস্টোর করা যাবে।
        </p>
        <div className="space-y-3">
          <button onClick={handleExportFile} className="btn btn-primary">
            <i className="fas fa-download" /> Backup ফাইল ডাউনলোড
          </button>
          <button onClick={handleCopyBackup} className="btn btn-secondary">
            <i className="fas fa-copy" /> Backup text কপি
          </button>
          <button onClick={() => setShowPasteRestore(!showPasteRestore)} className="btn btn-secondary">
            <i className="fas fa-paste" /> Backup text থেকে Restore
          </button>
          {showPasteRestore && (
            <div className="space-y-2">
              <textarea
                className="input-field min-h-32 text-xs"
                placeholder="এখানে backup text paste করুন..."
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
              />
              <button onClick={handlePasteRestore} className="btn btn-primary text-sm">
                <i className="fas fa-check" /> Restore করুন
              </button>
            </div>
          )}
          <button onClick={() => fileInput.current?.click()} className="btn btn-secondary">
            <i className="fas fa-upload" /> Backup ফাইল থেকে Restore
          </button>
          <input ref={fileInput} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {/* === Google Drive Backup === */}
      <div className="card">
        <div className="card-title">
          <i className="fab fa-google" style={{ color: '#4285F4' }} />
          Google Drive ব্যাকআপ (ঐচ্ছিক)
          {isGoogleSignedIn && (
            <span className="ml-auto text-xs text-emerald-400 font-normal">
              <i className="fas fa-circle text-[8px] mr-1" /> সংযুক্ত
            </span>
          )}
        </div>

        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-100 space-y-1">
          <p className="font-semibold text-amber-300">
            <i className="fas fa-triangle-exclamation mr-1" /> Google access blocked হলে কারণ
          </p>
          <p>Google বলছে এই OAuth app verified নয়। তাই developer-approved tester না হলে access বন্ধ থাকবে।</p>
          <p className="text-amber-200/80">সমাধান: OAuth consent screen এ আপনার Gmail test user হিসেবে add করতে হবে, অথবা app production verification complete করতে হবে।</p>
        </div>

        {/* Client ID input */}
        {!effectiveGoogleClientId && (
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1">Google OAuth Client ID</label>
            <input
              type="text"
              className="input-field text-xs"
              placeholder="xxxxxxxxxxxx-xxxxx.apps.googleusercontent.com"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  if (clientIdInput.trim()) {
                    onSetGoogleClientId(clientIdInput.trim());
                    showToast('Client ID সেভ হয়েছে');
                  }
                }}
                className="btn btn-primary flex-1 text-sm"
              >
                <i className="fas fa-save" /> সেভ করুন
              </button>
              <button
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="btn btn-secondary flex-1 text-sm"
              >
                <i className="fas fa-question-circle" /> কিভাবে পাবো?
              </button>
            </div>
          </div>
        )}

        {/* Setup Guide */}
        {showSetupGuide && (
          <div className="text-xs text-gray-300 bg-black/30 p-4 rounded-xl space-y-2 mb-4">
            <p className="font-bold text-amber-300">📋 Google Client ID তৈরির নির্দেশিকা:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" className="text-indigo-300 underline">
                  Google Cloud Console
                </a> এ যান
              </li>
              <li>নতুন প্রজেক্ট তৈরি করুন (অথবা বিদ্যমান ব্যবহার করুন)</li>
              <li><strong>APIs & Services → Library</strong> এ যান এবং <strong>Google Drive API</strong> সক্রিয় করুন</li>
              <li><strong>APIs & Services → Credentials</strong> এ যান</li>
              <li><strong>Create Credentials → OAuth 2.0 Client ID</strong> নির্বাচন করুন</li>
              <li>Application type: <strong>Web application</strong></li>
              <li>
                <strong>Authorized JavaScript origins</strong> এ আপনার সাইটের URL যোগ করুন
                <br />
                <code className="text-amber-300">({window.location.origin})</code>
              </li>
              <li><strong>OAuth consent screen → Test users</strong> এ আপনার Gmail যোগ করুন</li>
              <li>Publishing status যদি Testing হয়, শুধু test users login করতে পারবে</li>
              <li>Client ID কপি করে উপরে পেস্ট করুন</li>
            </ol>
            <button
              onClick={() => setShowSetupGuide(false)}
              className="text-indigo-300 underline mt-2"
            >
              বন্ধ করুন
            </button>
          </div>
        )}

        {/* Signed in state */}
        {effectiveGoogleClientId && !isGoogleSignedIn && (
          <div className="space-y-3">
            {envGoogleClientId && !state.googleClientId && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                <i className="fas fa-cloud mr-1" /> Cloudflare environment থেকে Google Client ID loaded.
              </div>
            )}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="btn btn-secondary"
            >
              {googleLoading ? (
                <><i className="fas fa-spinner spin" /> লোড হচ্ছে...</>
              ) : (
                <><i className="fab fa-google" /> Google দিয়ে সাইন-ইন করুন</>
              )}
            </button>
            <button
              onClick={() => {
                onSetGoogleClientId(null);
                setClientIdInput('');
                showToast('Client ID মুছে ফেলা হয়েছে');
              }}
              className="text-xs text-gray-500 hover:text-gray-300 w-full text-center"
            >
              Client ID পরিবর্তন করুন
            </button>
          </div>
        )}

        {isGoogleSignedIn && (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-sm text-emerald-300">
              <i className="fas fa-check-circle mr-2" />
              Google Drive সংযুক্ত
              {state.lastBackupTime && (
                <p className="text-xs text-emerald-400/70 mt-1">
                  শেষ ব্যাকআপ: {new Date(state.lastBackupTime).toLocaleString('bn-BD')}
                </p>
              )}
            </div>
            <button onClick={handleBackupToGoogle} disabled={googleLoading} className="btn btn-primary">
              {googleLoading ? (
                <><i className="fas fa-spinner spin" /> ব্যাকআপ হচ্ছে...</>
              ) : (
                <><i className="fas fa-cloud-upload-alt" /> Google Drive এ ব্যাকআপ করুন</>
              )}
            </button>
            <button onClick={handleRestoreFromGoogle} disabled={googleLoading} className="btn btn-secondary">
              {googleLoading ? (
                <><i className="fas fa-spinner spin" /> পুনরুদ্ধার হচ্ছে...</>
              ) : (
                <><i className="fas fa-cloud-download-alt" /> Google Drive থেকে পুনরুদ্ধার করুন</>
              )}
            </button>
            <button onClick={handleGoogleSignOut} className="text-xs text-gray-500 hover:text-gray-300 w-full text-center">
              <i className="fas fa-sign-out-alt mr-1" /> Google থেকে সাইন-আউট
            </button>
          </div>
        )}
      </div>

      {/* === PIN === */}
      <div className="card">
        <div className="card-title">
          <i className="fas fa-shield-halved" style={{ color: 'var(--primary)' }} />
          নিরাপত্তা পিন
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {state.pin ? '✅ পিন সেট করা আছে' : 'পিন সেট করা হয়নি'}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length !== 4 || !/^\d+$/.test(pin)) {
              showToast('পিন অবশ্যই ৪ সংখ্যার হতে হবে');
              return;
            }
            onSetPin(pin);
            setPin('');
            showToast('পিন সফলভাবে সেভ হয়েছে');
          }}
          className="space-y-3"
        >
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="৪-সংখ্যার পিন"
            className="input-field text-center tracking-[0.5em] text-2xl"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <button type="submit" className="btn btn-primary">
            <i className="fas fa-save" /> পিন সেভ করুন
          </button>
        </form>
      </div>

      {/* === Danger zone === */}
      <div className="card border border-red-500/20">
        <div className="card-title text-red-400">
          <i className="fas fa-exclamation-triangle" />
          বিপদজনক এলাকা
        </div>
        <button
          onClick={() => {
            if (window.confirm('সতর্কতা: এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না!\n\nসকল ডেটা (সম্পদ, দায়, সালাত লগ, তাসবীহ) চিরতরে মুছে যাবে।\n\nআপনি কি সত্যিই এগিয়ে যেতে চান?')) {
              onClearAll();
              showToast('সকল ডেটা মুছে ফেলা হয়েছে');
            }
          }}
          className="btn btn-danger"
        >
          <i className="fas fa-trash" /> সকল ডেটা মুছে ফেলুন
        </button>
      </div>

      {/* === About === */}
      <div className="card text-xs text-gray-400 leading-relaxed">
        <div className="card-title text-sm">
          <i className="fas fa-mosque" style={{ color: 'var(--primary)' }} />
          আমার যাকাত অ্যাপ
        </div>
        <p className="mb-2">
          এই অ্যাপটি একজন মুসলিমের দৈনন্দিন জীবনের জন্য প্রয়োজনীয় সকল টুল সমন্বিত একটি সম্পূর্ণ ইসলামিক টুলকিট:
        </p>
        <ul className="list-disc pl-4 space-y-1 mb-2">
          <li><strong>যাকাত ক্যালকুলেটর</strong> — ৯ ধরনের সম্পদ, দায় বাদ, হাওল ট্র্যাকিং</li>
          <li><strong>সালাত ট্র্যাকার</strong> — নামাজের সময়, জামাত লগ</li>
          <li><strong>কিবলা কম্পাস</strong> — দিকনির্দেশ</li>
          <li><strong>তাসবীহ কাউন্টার</strong> — ডিজিটাল তাসবীহ</li>
          <li><strong>দোয়া সংকলন</strong> — দৈনিক দোয়া</li>
          <li><strong>Google Drive ব্যাকআপ</strong> — ক্লাউডে সেভ</li>
        </ul>
        <p className="text-center text-gray-500 mt-2">
          🤲 আল্লাহ আমাদের সকলের যাকাত ও ইবাদত কবুল করুন
        </p>
      </div>
    </div>
  );
}

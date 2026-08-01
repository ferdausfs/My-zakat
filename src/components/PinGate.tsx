import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

interface Props {
  expected: string;
  onUnlock: () => void;
  /** Called when the user chooses to wipe all data (forgotten PIN recovery). */
  onResetAll: () => void;
}

/**
 * Full-screen lock gate shown before the app when a PIN is set.
 * Numeric keypad, attempt counter, and a short lockout after repeated failures.
 */
export function PinGate({ expected, onUnlock, onResetAll }: Props) {
  const [digits, setDigits] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [lockLeft, setLockLeft] = useState(0); // seconds of lockout remaining
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // lockout countdown
  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setTimeout(() => setLockLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [lockLeft]);

  useEffect(() => () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    if (failTimer.current) clearTimeout(failTimer.current);
  }, []);

  const fail = useCallback(() => {
    const next = attempts + 1;
    setAttempts(next);
    setDigits('');
    setShake(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShake(false), 500);
    if (next >= MAX_ATTEMPTS) {
      setAttempts(0);
      setLockLeft(LOCKOUT_SECONDS);
      setError(null);
    } else {
      setError(`ভুল পিন! আর ${(MAX_ATTEMPTS - next).toLocaleString('bn-BD')} বার চেষ্টা করতে পারবেন`);
    }
  }, [attempts]);

  const press = useCallback((d: string) => {
    if (lockLeft > 0 || digits.length >= 6) return;
    setError(null);
    const next = digits + d;
    setDigits(next);
    if (next.length === expected.length) {
      if (next === expected) {
        onUnlock();
      } else {
        // small delay so the last dot renders before the shake/clear
        if (failTimer.current) clearTimeout(failTimer.current);
        failTimer.current = setTimeout(fail, 120);
      }
    }
  }, [digits, expected, onUnlock, fail, lockLeft]);

  const backspace = useCallback(() => {
    if (lockLeft > 0) return;
    setError(null);
    setDigits(prev => prev.slice(0, -1));
  }, [lockLeft]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  const locked = lockLeft > 0;

  return (
    <div
      className="app-container items-center justify-center text-center"
      style={{ minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <div style={{ width: '100%', maxWidth: 320, margin: '0 auto' }}>
        <div
          className="mx-auto mb-4 flex items-center justify-center"
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.15))',
            border: '1px solid rgba(129,140,248,0.3)',
          }}
        >
          <i className={`fas ${locked ? 'fa-hourglass-half' : 'fa-lock'} text-2xl`} style={{ color: 'var(--primary)' }} />
        </div>

        <h1 className="text-xl font-bold gradient-text mb-1">আমার যাকাত</h1>
        <p className="text-xs text-gray-400 mb-5">
          {locked
            ? `অতিরিক্ত ভুল চেষ্টা — ${lockLeft.toLocaleString('bn-BD')} সেকেন্ড অপেক্ষা করুন`
            : 'পিন দিয়ে আনলক করুন'}
        </p>

        {/* dots */}
        <div
          className="flex items-center justify-center gap-3 mb-2"
          style={shake ? { animation: 'pingate-shake 0.4s ease' } : undefined}
        >
          {Array.from({ length: expected.length }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: i < digits.length ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                border: `1px solid ${i < digits.length ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`,
                transition: 'background 0.15s ease',
              }}
            />
          ))}
        </div>

        <p className="text-xs mb-5" style={{ color: error ? '#f87171' : 'transparent', minHeight: '1rem' }}>
          {error || '.'}
        </p>

        {/* keypad */}
        <div className="grid grid-cols-3 gap-3" style={{ opacity: locked ? 0.4 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
          {keys.map((k, i) => (
            k === '' ? <span key={i} /> : (
              <button
                key={i}
                type="button"
                className="pin-key"
                aria-label={k === '⌫' ? 'মুছুন' : k}
                onClick={() => (k === '⌫' ? backspace() : press(k))}
              >
                {k === '⌫' ? <i className="fas fa-delete-left" /> : k}
              </button>
            )
          ))}
        </div>

        {/* forgot pin */}
        <div className="mt-5">
          {!confirmWipe ? (
            <button
              type="button"
              className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300 transition"
              onClick={() => setConfirmWipe(true)}
            >
              পিন ভুলে গেছেন?
            </button>
          ) : (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-left">
              <p className="text-xs text-red-300 mb-2">
                পিন ভুলে গেলে আনলকের একমাত্র উপায় সব ডেটা মুছে নতুন করে শুরু করা — এতে সব সম্পদ, সালাত লগ ও তাসবীহ হিসাব মুছে যাবে।
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setConfirmWipe(false)}>
                  বাতিল
                </button>
                <button
                  type="button"
                  className="btn text-xs"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}
                  onClick={onResetAll}
                >
                  <i className="fas fa-trash" />সব ডেটা মুছে রিসেট
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

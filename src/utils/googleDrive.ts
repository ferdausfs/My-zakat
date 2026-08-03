/**
 * Google অটো-সিঙ্ক ইঞ্জিন — সম্পূর্ণ নতুন বিল্ড (v2)
 * ─────────────────────────────────────────────
 * Clean rewrite of the Google Identity Services (GSI) flow:
 *   - একটাই token-client সিঙ্গেলটন + স্পষ্ট state machine
 *   - একসাথে একাধিক token request গার্ড করা (in_progress)
 *   - Silent refresh → consent fallback, পরিষ্কারভাবে
 *   - প্রতিটি fail-এ classifyGisError() দিয়ে নির্ভরযোগ্য বাংলা কারণ
 *
 * Client ID: src/config.ts থেকে আসে (একটাই source of truth)।
 * ডেটা ব্যবহারকারীর নিজের Google Drive-এ একটি JSON ফাইলে সেভ হয়।
 */
import { GOOGLE_CLIENT_ID } from '../config';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FILE_NAME = 'amar_zakat_app_backup.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
/** টোকেনের মেয়াদ শেষ বলে ধরার ৬০ সেকেন্ড আগে (clock skew buffer)। */
const EXPIRY_BUFFER_MS = 60_000;
/** স্ক্রিপ্ট লোড fail হলে একবার retry। */
const SCRIPT_LOAD_MAX_ATTEMPTS = 2;

/* eslint-disable @typescript-eslint/no-explicit-any */
type GisWindow = any;

// ── Public types ─────────────────────────────────────────────────────────
export interface TokenResult {
  token: string;
  /** epoch ms যতক্ষণ টোকেন বৈধ (buffer প্রয়োগ করা হয়েছে) */
  expiresAt: number;
}

export interface GoogleUser {
  email: string;
  name: string;
  photo?: string;
}

/** Google-এর আসল fail-mode → স্থিতিশীল কোড (Settings-এ বাংলায় দেখানো হয়)। */
export type GisErrorCode =
  | 'popup_blocked'
  | 'popup_closed'
  | 'access_denied'
  | 'client_not_found'
  | 'origin_mismatch'
  | 'app_not_configured'
  | 'in_progress'
  | 'unknown';

export function classifyGisError(err: unknown): GisErrorCode {
  const msg = err instanceof Error ? err.message : String(err || '');
  const m = msg.toLowerCase();
  if (m.includes('popup_failed') || m.includes('popup blocked') || m.includes('cannot open popup')) return 'popup_blocked';
  if (m.includes('popup_closed') || m.includes('user_closed')) return 'popup_closed';
  if (m.includes('access_denied')) return 'access_denied';
  if (m.includes('client_not_found') || m.includes('invalid_client')) return 'client_not_found';
  if (m.includes('origin')) return 'origin_mismatch';
  if (m.includes('app_not_configured') || m.includes('unauthorized_client')) return 'app_not_configured';
  if (m.includes('in_progress')) return 'in_progress';
  return 'unknown';
}

export const GIS_ERROR_TEXT: Record<GisErrorCode, string> = {
  popup_blocked: 'পপআপ ব্লক হয়েছে — ব্রাউজারের পপআপ অনুমতি দিন, তারপর আবার চেষ্টা করুন।',
  popup_closed: 'আপনি লগইন উইন্ডো বন্ধ করেছেন। আবার চেষ্টা করলে হবে।',
  access_denied: 'আপনি Google অনুমতি দেননি। সাইন ইন করতে হলে অনুমতি দিতে হবে।',
  client_not_found: 'Client ID-টি Google-এ খুঁজে পাওয়া যায়নি (invalid_client)। GOOGLE_SETUP.md ধাপ ৪-৫ দেখুন।',
  origin_mismatch: 'Origin অনুমোদিত নয় — Google Console-এর Authorized JavaScript origins-এ এই সাইটের origin যোগ করা নেই।',
  app_not_configured: 'Google অ্যাপ কনফিগার করা নেই — Drive API enable + consent screen (test users সহ) দরকার।',
  in_progress: 'আগের লগইন এখনো চলছে — একটু পর আবার চেষ্টা করুন।',
  unknown: 'অজানা সমস্যা — ইন্টারনেট/Google সার্ভিস চেক করুন, অথবা আবার চেষ্টা করুন।',
};

export class DriveError extends Error {
  status: number;
  reason: string;
  constructor(context: string, status: number, reason: string) {
    super(`${context}:${status}${reason ? ':' + reason : ''}`);
    this.status = status;
    this.reason = reason;
  }
}

// ── Singleton GSI state ───────────────────────────────────────────────────
let gisLoaded = false;
let gisLoading: Promise<void> | null = null;
let tokenClient: { requestAccessToken: (opts?: { prompt?: string }) => void } | null = null;
let pendingToken: { resolve: (r: TokenResult) => void; reject: (e: Error) => void } | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GIS_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(script);
  });
}

/**
 * Google Identity Services স্ক্রিপ্ট load করে (একবারই, retry সহ)।
 * Fail করলে throw — caller catch করে UI-তে বাংলা message দেখায়।
 */
export async function loadGoogleIdentity(): Promise<void> {
  if (gisLoaded) return;
  if (gisLoading) return gisLoading;
  gisLoading = (async () => {
    let lastErr: unknown = null;
    for (let i = 0; i < SCRIPT_LOAD_MAX_ATTEMPTS; i++) {
      try {
        await loadScript(GIS_SCRIPT_URL);
        // google.accounts চেক — কখনো কখনো script load হলেও object তৈরি হতে দেরি হয়
        const g = (window as unknown as GisWindow).google;
        if (!g?.accounts?.oauth2) {
          // একটু অপেক্ষা করে আবার চেক
          await new Promise(r => setTimeout(r, 400));
        }
        gisLoaded = true;
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('GIS_SCRIPT_LOAD_FAILED');
  })();
  return gisLoading;
}

/** Active client id this build actually uses (runtime diagnostics). */
export function activeClientId(): string {
  return GOOGLE_CLIENT_ID;
}

/** "hidden bug" guard: log the exact client id + origin at sign-in so a
 *  console/config mismatch is never invisible again. Returns true if sane. */
export function logSignInContext(): boolean {
  const id = GOOGLE_CLIENT_ID;
  const ok = id.length === 72 && id.endsWith('.apps.googleusercontent.com') && !/\s/.test(id);
  console.warn('[MyZakat Google] client_id=' + id);
  console.warn('[MyZakat Google] origin=' + window.location.origin);
  console.warn('[MyZakat Google] sanity=' + (ok ? 'OK' : 'MISMATCH-REVIEW'));
  return ok;
}

/**
 * Token client সিঙ্গেলটন। প্রথম call-এ init + callback বসে।
 */
async function getTokenClient() {
  await loadGoogleIdentity();
  if (tokenClient) return tokenClient;
  const g = (window as unknown as GisWindow).google;
  const client = g.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (resp: Record<string, unknown>) => {
      const pending = pendingToken;
      pendingToken = null;
      if (!pending) return;
      if (resp['error'] || !resp['access_token']) {
        const desc = String(resp['error_description'] || resp['error'] || 'no_token');
        pending.reject(new Error(desc));
        return;
      }
      const expiresInSec = Number(resp['expires_in'] ?? 3599);
      pending.resolve({
        token: String(resp['access_token']),
        expiresAt: Date.now() + expiresInSec * 1000 - EXPIRY_BUFFER_MS,
      });
    },
    error_callback: (err: Record<string, unknown>) => {
      const pending = pendingToken;
      pendingToken = null;
      if (!pending) return;
      // GSI error_callback-এর আসল কোডগুলো: popup_failed_to_open,
      // popup_closed_by_user, access_denied, oauth_client_not_found,
      // origin_mismatch, app_not_configured ...
      const type = String(err['type'] || err['message'] || 'unknown');
      pending.reject(new Error(type));
    },
  });
  tokenClient = client;
  return client;
}

/**
 * টোকেন চাও — `prompt: ''` = silent (ইতিমধ্যে consent দেওয়া থাকলে),
 * `prompt: 'consent'` = Google account chooser/consent screen।
 * একসাথে একাধিক request গার্ড করা।
 */
async function requestToken(prompt: '' | 'consent'): Promise<TokenResult> {
  if (pendingToken) throw new Error('in_progress');
  const client = await getTokenClient();
  const result = new Promise<TokenResult>((resolve, reject) => {
    pendingToken = { resolve, reject };
  });
  client.requestAccessToken({ prompt });
  return result;
}

/**
 * ইন্টারঅ্যাকটিভ সাইন-ইন: আগে silent চেষ্টা, না হলে consent popup।
 * Return: token + expiresAt + (যদি পাই) user info।
 */
export async function signInWithGoogle(): Promise<TokenResult & { user: GoogleUser | null }> {
  logSignInContext();
  let tr: TokenResult;
  try {
    tr = await requestToken('');
  } catch (err) {
    const code = classifyGisError(err);
    // silent fail — এটা শুধু "consent দরকার" হলে, popup আবার খুলি
    if (code === 'popup_blocked' || code === 'popup_closed' || code === 'access_denied' || code === 'unknown') {
      tr = await requestToken('consent');
    } else {
      throw err;
    }
  }
  const user = await fetchGoogleUser(tr.token).catch(() => null);
  return { ...tr, user };
}

/**
 * Silent refresh — saved token নাই/মেয়াদ শেষ হলে। ব্যবহারকারীর আবার
 * ইন্টারঅ্যাকশন লাগলে reject করে (App catch করে auth code দেখায়)।
 */
export async function silentRefreshToken(): Promise<TokenResult> {
  return requestToken('');
}

/** Saved token এখনও আরামে বৈধ কিনা। */
export function isTokenValid(savedToken: string | null, expiresAt: number | null): boolean {
  return !!savedToken && !!expiresAt && Date.now() < expiresAt;
}

export function revokeGoogleToken(token: string | null): void {
  if (!token) return;
  try {
    const g = (window as unknown as GisWindow).google;
    g?.accounts?.oauth2?.revoke?.(token, () => {});
  } catch { /* ignore */ }
}

// ── Drive API calls ───────────────────────────────────────────────────────
async function driveFetch(context: string, url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new DriveError(context, 0, 'network');
  }
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.clone().json())?.error?.errors?.[0]?.reason || ''; } catch { /* ignore */ }
    throw new DriveError(context, res.status, reason);
  }
  return res;
}

export async function fetchGoogleUser(token: string): Promise<GoogleUser | null> {
  const res = await driveFetch('about', `${DRIVE_API_BASE}/about?fields=user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data?.user?.emailAddress) return null;
  return {
    email: data.user.emailAddress,
    name: data.user.displayName || data.user.emailAddress,
    photo: data.user.photoLink,
  };
}

async function findBackupFile(token: string): Promise<{ id: string; modifiedTime?: string } | null> {
  const q = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed=false`);
  const res = await driveFetch('search', `${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const f = data.files?.[0];
  return f ? { id: f.id, modifiedTime: f.modifiedTime } : null;
}

export async function backupToGoogleDrive(token: string, content: string): Promise<{ fileId: string; isNew: boolean }> {
  const existing = await findBackupFile(token);
  if (existing) {
    await driveFetch('update', `${DRIVE_UPLOAD_BASE}/files/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: content,
    });
    return { fileId: existing.id, isNew: false };
  }
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, mimeType: 'application/json' });
  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));
  const res = await driveFetch('upload', `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  return { fileId: data.id, isNew: true };
}

export async function restoreFromGoogleDrive(token: string): Promise<string | null> {
  const file = await findBackupFile(token);
  if (!file) return null;
  const res = await driveFetch('download', `${DRIVE_API_BASE}/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.text();
}

export async function getBackupInfo(token: string): Promise<{ exists: boolean; modifiedTime?: string }> {
  const file = await findBackupFile(token);
  if (!file) return { exists: false };
  return { exists: true, modifiedTime: file.modifiedTime };
}

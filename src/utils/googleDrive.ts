/**
 * Google অটো-সিঙ্ক ইঞ্জিন
 * ──────────────────────
 * ব্যবহারকারী শুধু "Google দিয়ে সাইন ইন" চাপে — Client ID অ্যাপের ভেতরে
 * বিল্ট-ইন (src/config.ts)। ডেটা ব্যবহারকারীর নিজের Google Drive-এ একটি
 * JSON ফাইলে সেভ হয়; টোকেনের মেয়াদ শেষ হলে নীরবে রিফ্রেশ হয়।
 */
import { GOOGLE_CLIENT_ID } from '../config';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FILE_NAME = 'amar_zakat_app_backup.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
/** Treat tokens as expired this much before their real expiry (clock skew buffer). */
const EXPIRY_BUFFER_MS = 60_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
type GisWindow = any;

export interface TokenResult {
  token: string;
  /** epoch ms when the token expires (buffer already applied) */
  expiresAt: number;
}

export interface GoogleUser {
  email: string;
  name: string;
  photo?: string;
}

let gisLoaded = false;
let tokenClient: { requestAccessToken: (opts?: { prompt?: string }) => void } | null = null;
let pendingToken: {
  resolve: (r: TokenResult) => void;
  reject: (e: Error) => void;
} | null = null;

/** Rich Drive API error — carries HTTP status + Google's machine-readable reason. */
export class DriveError extends Error {
  status: number;
  reason: string;
  constructor(context: string, status: number, reason: string) {
    super(`${context}:${status}${reason ? ':' + reason : ''}`);
    this.status = status;
    this.reason = reason;
  }
}

/**
 * fetch() wrapper for Drive calls. Network failure → DriveError(status 0).
 * Non-OK responses → DriveError with status + parsed reason so the UI can
 * tell "token expired" apart from "Drive API disabled" / "missing scope".
 */
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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src; script.async = true; script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services লোড হয়নি (ইন্টারনেট আছে?)'));
    document.head.appendChild(script);
  });
}

export async function loadGoogleIdentity(): Promise<void> {
  if (gisLoaded) return;
  await loadScript(GIS_SCRIPT_URL);
  gisLoaded = true;
}

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
        pending.reject(new Error(String(resp['error'] || 'no_token')));
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
      pending?.reject(new Error(String(err['type'] || err['message'] || 'popup_failed')));
    },
  });
  tokenClient = client;
  return client;
}

/**
 * Request a token. `prompt: ''` stays silent when the user already consented;
 * `prompt: 'consent'` shows the Google account chooser/consent screen.
 */
async function requestToken(prompt: '' | 'consent'): Promise<TokenResult> {
  if (pendingToken) throw new Error('token_request_in_progress');
  const client = await getTokenClient();
  const result = new Promise<TokenResult>((resolve, reject) => {
    pendingToken = { resolve, reject };
  });
  client.requestAccessToken({ prompt });
  return result;
}

/**
 * Interactive sign-in. Tries silently first (returning user), falls back to
 * the consent popup for first-time users.
 */
export async function signInWithGoogle(): Promise<TokenResult & { user: GoogleUser | null }> {
  let tr: TokenResult;
  try {
    tr = await requestToken('');
  } catch {
    tr = await requestToken('consent');
  }
  const user = await fetchGoogleUser(tr.token).catch(() => null);
  return { ...tr, user };
}

/**
 * Silent refresh — call when the saved token is missing/near expiry.
 * Rejects if Google needs the user to interact again.
 */
export async function silentRefreshToken(): Promise<TokenResult> {
  return requestToken('');
}

/** True while the saved token is still comfortably valid. */
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

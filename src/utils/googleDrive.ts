const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FILE_NAME = 'amar_zakat_app_backup.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let gisLoaded = false;
let accessToken: string | null = null;
let tokenClient: unknown = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src; script.async = true; script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export async function loadGoogleIdentity(): Promise<void> {
  if (gisLoaded) return;
  await loadScript(GIS_SCRIPT_URL);
  gisLoaded = true;
}

export function isGoogleLoaded(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return gisLoaded && typeof (window as any)['google'] !== 'undefined';
}

export async function signInWithGoogle(clientId: string): Promise<string> {
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any)['google'] as Record<string, unknown>;
      const accounts = g['accounts'] as Record<string, unknown>;
      const oauth2 = accounts['oauth2'] as Record<string, unknown>;
      tokenClient = (oauth2['initTokenClient'] as Function)({
        client_id: clientId,
        scope: SCOPES,
        callback: (resp: Record<string, string>) => {
          if (resp['error']) { reject(new Error(resp['error'])); return; }
          accessToken = resp['access_token'];
          resolve(resp['access_token']);
        },
        error_callback: (err: Record<string, string>) => {
          reject(new Error(err['message'] || 'Google sign-in failed'));
        },
      });
      (tokenClient as Record<string, Function>)['requestAccessToken']();
    } catch (err) { reject(err); }
  });
}

export function signOut(): void {
  if (accessToken) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any)['google'] as Record<string, unknown> | undefined;
    if (g) {
      const accounts = g['accounts'] as Record<string, unknown>;
      const oauth2 = accounts?.['oauth2'] as Record<string, Function> | undefined;
      oauth2?.['revoke']?.(accessToken);
    }
  }
  accessToken = null;
}

export function getAccessToken(): string | null { return accessToken; }
export function setAccessToken(token: string | null): void { accessToken = token; }

async function findBackupFile(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed=false`);
  const res = await fetch(`${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to search Google Drive');
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

export async function backupToGoogleDrive(token: string, content: string): Promise<{ fileId: string; isNew: boolean }> {
  const existingId = await findBackupFile(token);
  if (existingId) {
    const res = await fetch(`${DRIVE_UPLOAD_BASE}/files/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: content,
    });
    if (!res.ok) throw new Error('Failed to update backup on Google Drive');
    return { fileId: existingId, isNew: false };
  }
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, mimeType: 'application/json' });
  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));
  const res = await fetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error('Failed to upload backup to Google Drive');
  const data = await res.json();
  return { fileId: data.id, isNew: true };
}

export async function restoreFromGoogleDrive(token: string): Promise<string | null> {
  const fileId = await findBackupFile(token);
  if (!fileId) return null;
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to download backup from Google Drive');
  return res.text();
}

export async function getBackupInfo(token: string): Promise<{ exists: boolean; modifiedTime?: string }> {
  const fileId = await findBackupFile(token);
  if (!fileId) return { exists: false };
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=modifiedTime`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { exists: true };
  const data = await res.json();
  return { exists: true, modifiedTime: data.modifiedTime };
}

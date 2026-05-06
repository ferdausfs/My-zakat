# Cloudflare Pages Deployment Guide

## 1. GitHub Repo তৈরি

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 2. Cloudflare Pages Setup

- Cloudflare Dashboard খুলুন
- Workers & Pages -> Create application -> Pages
- Connect to Git
- আপনার GitHub repo select করুন
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

## 3. Environment Variables

Google Drive backup চাইলে Pages project settings এ add করুন:

```bash
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com
```

তারপর redeploy করুন।

## 4. Google OAuth Fix for Access Blocked

যদি দেখায়:

`Access blocked: arena.site has not completed the Google verification process`

তাহলে:

1. Google Cloud Console খুলুন
2. APIs & Services -> OAuth consent screen
3. Publishing status যদি Testing হয়, Test users এ আপনার Gmail add করুন
4. APIs & Services -> Credentials -> OAuth 2.0 Client ID
5. Authorized JavaScript origins এ Cloudflare domain add করুন:
   - `https://YOUR_PROJECT.pages.dev`
   - custom domain থাকলে সেটাও: `https://yourdomain.com`
6. Google Drive API enable করুন
7. Save করে 5-10 মিনিট অপেক্ষা করুন

Public app হিসেবে সবাইকে access দিতে চাইলে Google verification complete করতে হবে।

## 5. Build Check

Deploy এর আগে local build করুন:

```bash
npm run build
```

## 6. Backup Without Google

Google OAuth না হলেও Settings -> নিরাপদ ব্যাকআপ থেকে:

- Backup file download
- Backup text copy
- Backup text restore
- JSON file restore

সব কাজ করবে।

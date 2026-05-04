# আমার যাকাত অ্যাপ

React + Vite + Tailwind CSS v4 দিয়ে তৈরি একটি বাংলা মুসলিম টুলকিট। এতে আছে যাকাত ক্যালকুলেটর, সালাত ট্র্যাকার, কিবলা, তাসবীহ, দোয়া এবং backup/restore সুবিধা।

## Features

- Date-aware Zakat hawl calculation
- Asset/liability entries with dates
- Gold/silver nisab settings
- Prayer times, salat log and Qibla compass
- Tasbih counter and dua collection
- Local JSON backup, backup text copy/restore
- Optional Google Drive backup
- Cloudflare Pages ready

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

Build output: `dist`

## Cloudflare Pages Deploy

1. GitHub-এ repo push করুন।
2. Cloudflare Dashboard -> Workers & Pages -> Create application -> Pages -> Connect to Git.
3. Framework preset: `Vite`
4. Build command: `npm run build`
5. Build output directory: `dist`
6. Node version: `22` or latest LTS

## Optional Environment Variables

Cloudflare Pages -> Settings -> Environment variables:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Google Drive backup কাজ করাতে Google Cloud Console-এ একই deployed domain authorize করতে হবে। বিস্তারিত `docs/cloudflare-deploy.md` দেখুন।

## Important Google OAuth Note

Google sign-in blocked হলে এটি code bug নয়। OAuth app যদি Testing mode-এ থাকে, তাহলে আপনার Gmail অবশ্যই OAuth consent screen-এর Test users তালিকায় থাকতে হবে।

## Data Privacy

সব ডেটা browser localStorage-এ থাকে। Google Drive backup optional।

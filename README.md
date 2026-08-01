# আমার যাকাত (My-zakat) — মুসলিম টুলকিট

A Bengali (বাংলা) Islamic toolkit web app — **Zakat calculator**, **Salat tracker**
with prayer times, **Qibla** compass, **Tasbih** counter, and a **Dua** collection.
100% client-side, single-file build, works offline once loaded.

## ✨ Features

- **যাকাত ক্যালকুলেটর** — track assets (cash, bank, gold, silver, business,
  investments, receivables, crypto…), liabilities, live nisab (gold/silver
  standard), হাওল (lunar-year) timeline and zakat due.
- **সালাত ট্র্যাকার** — daily prayer times for popular cities (calculation done
  locally, no API), next-prayer countdown, per-prayer log (ফরজ/জামাত/সুন্নাত/বিতর)
  and a weekly report.
- **কিবলা** — bearing + device-orientation compass.
- **তাসবীহ** — dhikr presets with targets, daily counts, vibration feedback.
- **দোয়া** — curated dua collection with Arabic, transliteration and Bengali.
- **ডেটা** — everything stored in `localStorage`, plus **optional Google sign-in
  with automatic cloud sync** (data lives in the *user's own* Google Drive —
  no server, no owner access). Export/import JSON backups and PIN lock too.
  Owner setup for the built-in Google login: **[GOOGLE_SETUP.md](./GOOGLE_SETUP.md)**.

## 🛠 Tech

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS 4 ·
[`vite-plugin-singlefile`](https://www.npmjs.com/package/vite-plugin-singlefile)
→ the whole app is emitted as **one `dist/index.html`** (JS, CSS, fonts and
icons all inlined), so it can be hosted anywhere static or opened from `file://`.

## 🚀 Getting started

Requires **Node.js ≥ 18**.

```bash
npm install
npm run dev       # dev server → http://localhost:5173
npm run build     # type-checks, then builds → dist/index.html (single file)
npm run preview   # serve the production build
npx tsc --noEmit  # type-check only
```

### Termux (Android)

```bash
pkg install nodejs git
git clone https://github.com/ferdausfs/My-zakat.git
cd My-zakat
npm install
npm run build     # -> dist/index.html — copy/host anywhere
```

## ☪️ Fiqh disclaimer (গুরুত্বপূর্ণ দাবিত্যাগ)

This app is an **aide, not a fatwa source**:

- Zakat/hawl calculations follow common Hanafi conventions simplified over a
  discrete date timeline, and Hijri dates use the arithmetic (Kuwaiti)
  algorithm which can differ by **±1–2 days** from Umm al-Qura or local
  moonsighting.
- Treatment of specific asset classes (e.g. rental property) may differ across
  madhhabs and individual circumstances.
- Prayer times are astronomical approximations and may differ a few minutes
  from your local mosque's timetable.

**হিসাব আনুমানিক — চূড়ান্ত সিদ্ধান্তের আগে অবশ্যই স্থানীয় বিশ্বস্ত আলেম/মুফতির
পরামর্শ নিন।** (Approximate estimate — please consult a qualified scholar for
final religious rulings.)

## 📄 License

MIT — see [LICENSE](./LICENSE).

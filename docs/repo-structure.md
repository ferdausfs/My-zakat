# Repo Structure

```text
.
├── docs/
│   ├── cloudflare-deploy.md
│   └── repo-structure.md
├── public/
│   ├── _headers
│   ├── _redirects
│   ├── icon.svg
│   └── manifest.webmanifest
├── src/
│   ├── components/
│   │   └── Modal.tsx
│   ├── pages/
│   │   ├── DuaPage.tsx
│   │   ├── SalatPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── TasbihPage.tsx
│   │   └── ZakatPage.tsx
│   ├── utils/
│   │   ├── dua.ts
│   │   ├── googleDrive.ts
│   │   ├── hijri.ts
│   │   ├── prayerTimes.ts
│   │   ├── qibla.ts
│   │   ├── storage.ts
│   │   ├── tasbih.ts
│   │   └── zakat.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Key Files

- `src/utils/zakat.ts`: date-aware zakat and hawl engine
- `src/utils/storage.ts`: localStorage persistence and legacy data migration
- `src/utils/googleDrive.ts`: optional Google Drive backup/restore
- `public/_redirects`: SPA fallback for Cloudflare Pages
- `public/_headers`: security and permission headers

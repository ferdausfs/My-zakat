# My-zakat → Firebase Hosting Migration — Runbook (২০২৬-০৮-০২)

> **লক্ষ্য:** app-টা Vercel (`my-zakat.vercel.app`) থেকে **Google Firebase Hosting**-এ সরানো।
> Firebase = Google-এর নিজস্ব হোস্টিং → Google sign-in / Drive sync-এর সাথে এক প্ল্যাটফর্মে, দ্রুত + নির্ভরযোগ্য।
>
> আমি (agent) যা করেছি: firebase.json, .firebaserc, .firebaseignore, auto-deploy workflow, build-verify — সব তৈরি + test।
> আপনি যা করবেন: Firebase প্রজেক্ট বানানো + `firebase login` + deploy (একবারই) + ২টা secret (CI-র জন্য)।

---

## অংশ ১ — একবার করবেন: Firebase প্রজেক্ট + প্রথম deploy (~১৫ মিনিট)

### ১.১ Firebase প্রজেক্ট বানান
1. যান: <https://console.firebase.google.com>
2. **Add project** → নাম দিন (যেমন `my-zakat`) → **Create**
   - Google Analytics **অফ রাখুন** (দরকার নেই; রাখলেও হবে)
   - মনে রাখুন **project ID** (যেমন `my-zakat-xxxxx`)

### ১.২ Firebase CLI সেটআপ (Termux বা কম্পিউটার — যেকোনো একটা)

**কম্পিউটারে (সবচেয়ে সহজ):**
```bash
npm install -g firebase-tools
cd ~/My-zakat        # বা repo যেখানে আছে
firebase login       # ব্রাউজার খুলবে → Google login
```

**Termux-এ (যদি কম্পিউটার না থাকে):**
```bash
pkg install nodejs
npm install -g firebase-tools
cd ~/My-zakat
firebase login
```

### ১.৩ Project ID বসান
`~/.firebaserc`-এ `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` বদলে আপনার আসল project ID দিন:
```json
{ "projects": { "default": "my-zakat-xxxxx" } }
```

### ১.৪ প্রথম deploy
```bash
cd ~/My-zakat
npm run build          # dist/index.html তৈরি হবে (single-file)
firebase deploy --only hosting
```
শেষে Firebase যে URL দেবে (যেমন `https://my-zakat-xxxxx.web.app`) — **সেটাই নতুন ঠিকানা।**

---

## অংশ ২ — ⚠️ সবচেয়ে জরুরি: Google sign-in-এর origin যোগ করা

Firebase-এ সরার পর app-টা নতুন origin থেকে চলবে (`https://my-zakat-xxxxx.web.app` + `.firebaseapp.com`)।
**Google OAuth client-এ এই origin দুটো যোগ না করলে "Google দিয়ে সাইন ইন" কাজ করবে না** (origin_mismatch)।

1. Google Cloud Console: <https://console.cloud.google.com/apis/credentials>
2. আপনার OAuth **Client ID**-তে ক্লিক করুন (যেটা `src/config.ts`-এ আছে)
3. **Authorized JavaScript origins**-এ যোগ করুন:
   ```
   https://my-zakat-xxxxx.web.app
   https://my-zakat-xxxxx.firebaseapp.com
   ```
   (পুরনো `https://my-zakat.vercel.app` ও `https://ferdausfs.github.io` রাখলেও চলবে — একসাথে সব চলে)
4. **Save** → ১-২ মিনিট পর নতুন origin-এ sign-in test করুন

---

## অংশ ৩ — Auto-deploy (GitHub Actions, ভবিষ্যতে push করলেই live)

`firebase-hosting-merge.yml` তৈরি করে দিয়েছি। কাজ করতে ২টা **repo secret** লাগবে:

### ৩.১ Service Account বানান
1. Google Cloud Console → **IAM & Admin → Service Accounts** → **Create service account**
2. নাম: `firebase-hosting-ci` → **Create**
3. **Roles** → "Firebase" → **Firebase Admin** (বা Hosting Admin) → **Done**
4. ওই account-এ → **Keys → Add key → Create new key → JSON** → ফাইল ডাউনলোড

### ৩.২ Base64 করে secret-এ বসান
```bash
base64 -w 0 service-account-file.json > firebase_sa_b64.txt   # Mac/Linux/Termux
# উইন্ডোজ: certutil -encode ... (অথবা GitHub-এ base64 online)
```
- GitHub → আপনার repo → **Settings → Secrets and variables → Actions**
- **New repository secret:**
  - Name: `FIREBASE_SERVICE_ACCOUNT`
  - Value: base64 string (উপরের)
- **Variables → New variable:**
  - Name: `FIREBASE_PROJECT_ID`
  - Value: আপনার project ID (যেমন `my-zakat-xxxxx`)

### ৩.৩ Test
main-এ যেকোনো push-এ workflow নিজে চালবে। **Actions** tab-এ গিয়ে সবুজ হলে live।

---

## অংশ ৪ — পুরনো হোস্টিং সরানো (ঐচ্ছিক, Firebase confirm-এর পরে)

- **Vercel:** <https://vercel.com> → `my-zakat` প্রজেক্ট → Settings → Danger Zone → **Delete Project**
- **GitHub Pages:** চাইলে রাখতে পারেন (অটো-deploy `deploy.yml` আছে); আর না চাইলে `.github/workflows/deploy.yml` মুছে দিলেই বন্ধ।

> ⚠️ Vercel/GitHub Pages মুছলে Google OAuth-এর ওই origin দুটোও মুছে ফেলুন (নিরাপত্তার জন্য)।

---

## ✅ আমি যা verify করেছি (আপনি চালানোর দরকার নেই)

- `npm run build` → `dist/index.html` single-file (1.5MB) — **tsc 0 errors**
- dist-এ কোনো external asset নেই → **base path সমস্যা নেই**, Firebase-এ root-থেকেই চলবে
- firebase.json: cache headers + SPA rewrite (`**` → index.html)
- Google sign-in fix (GIS warm-up + classified errors) — একই bundle-তে আছে

## 🛠 Troubleshooting

| সমস্যা | সমাধান |
|---|---|
| `firebase: command not found` | `npm install -g firebase-tools` আবার; Termux-এ `pkg install nodejs` আগে |
| `Project ... not found` | `.firebaserc`-এ project ID ঠিক আছে? Console-এর ID-র সাথে হুবহু |
| deploy-এর পর site blank | URL-এ `/index.html` যোগ করে দেখুন; console-এ error পাঠান |
| Google sign-in `origin_mismatch` | অংশ ২ — নতুন origin `.web.app` যোগ করা আছে? |
| Actions workflow fail | `FIREBASE_SERVICE_ACCOUNT` secret-টা base64 ঠিক আছে? Permissions → Firebase Admin |

## 📦 এই bundle-এ যা আছে (আগের + নতুন)

- `a7a4216` — Google sign-in fix (GIS warm-up, classified errors) ← আগের যেটা পাননি
- নতুন — Firebase migration kit (firebase.json, .firebaserc, workflow, এই runbook)

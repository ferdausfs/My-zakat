# Google অটো-সিঙ্ক সেটআপ (শুধু অ্যাপ-মালিকের জন্য)

> ব্যবহারকারীরা **শুধু "Google দিয়ে সাইন ইন"** বোতাম চাপবে — তাদের কোনো Console/টেকনিক্যাল কাজ করতে হবে না।
> নিচের কাজটা **শুধু আপনি (মালিক) একবার** করবেন (~১৫ মিনিট)। এরপর সবার জন্য চালু।

**কেন এটা লাগে?** Google-এর নিয়ম অনুযায়ী লগিন সিস্টেমের জন্য একটি "OAuth Client ID" বাধ্যতামূলক। এটি আপনি একবার বানিয়ে অ্যাপের ভেতরে বসিয়ে দেবেন। Client ID গোপনীয় নয় — সবাইকে দেওয়া যায়। **কিন্তু আপনার Google অ্যাকাউন্টের পাসওয়ার্ড/OAuth Client Secret কখনোই কোডে বা চ্যাটে দেবেন না।**

---

## ধাপ ১ — Google Cloud প্রজেক্ট বানান

1. ব্রাউজারে যান: <https://console.cloud.google.com>
2. উপরে বামে প্রজেক্ট ড্রপডাউন → **New Project**
3. Name: `amar-zakat` (যেকোনো নাম) → **Create**

## ধাপ ২ — Drive API চালু করুন

1. বাম মেনু: **APIs & Services → Library**
2. সার্চ: `Google Drive API` → ক্লিক → **Enable**

## ধাপ ৩ — OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User Type: **External** → **Create**
3. পূরণ:
   - App name: `আমার যাকাত` (ব্যাবহারকারী লগিনের সময় এটাই দেখবে)
   - User support email: আপনার Gmail
   - Developer contact: আপনার Gmail
4. **Save and Continue** → Scopes ধাপে: **Add or Remove Scopes** → সার্চ/চেক করুন:
   - `https://www.googleapis.com/auth/drive.file` *(বর্ণনা: "See, edit, create, and delete only the specific Google Drive files you use with this app")*
5. বাকিগুলো খালি রেখে **Save and Continue** করে শেষ করুন।

### 📢 Publishing status — Testing নাকি Production?

- **Testing মোডে থাকলে** শুধু আপনার যোগ করা **Test users** (সর্বোচ্চ ১০০ জন, Gmail দিয়ে) সাইন ইন করতে পারবে। পরিবার/বন্ধুদের জন্য এটাই যথেষ্ট ও নিরাপদ:
  - OAuth consent screen → **Audience/Test users** → **Add users** → তাদের Gmail লিখুন।
- **সবার জন্য উন্মুক্ত করতে চাইলে** **Publish app** চাপুন। `drive.file` "sensitive scope" হওয়ায় Google-এর **verification** লাগতে পারে (কয়েক দিন); ভেরিফাই না করা অবধি ব্যবহারকারী লগিনে একটি সতর্ক স্ক্রিন দেখবে — *"Google hasn't verified this app"* → **Advanced → Go to আমার যাকাত (unsafe)** চাপলেই চলবে (নিরাপদ, কারণ ডেটা শুধু ব্যবহারকারীর নিজের Drive-এ যায়)।

## ধাপ ৪ — OAuth Client ID বানান

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: `amar-zakat-web`
4. **Authorized JavaScript origins** — অ্যাপ যেখান-যেখান থেকে চলবে সবগুলো যোগ করুন:
   - `http://localhost:5173` (ডেভেলপমেন্ট)
   - `https://ferdausfs.github.io` (GitHub Pages হোস্টিং)
   - নিজের ডোমেইন থাকলে সেটাও
   - ⚠️ শুধু origin — শেষে `/` বা পাথ দেবেন না। **Redirect URIs কিছুই লাগে না।**
5. **Create** → Client ID কপি করুন (শেষে `.apps.googleusercontent.com`)

## ধাপ ৫ — কোডে বসান

`src/config.ts` খুলে placeholder বদলে দিন:

```ts
export const GOOGLE_CLIENT_ID = '1234567890-abcxyz.apps.googleusercontent.com'; // ← আপনারটা
```

তারপর বিল্ড + পুশ:

```bash
npm run build
git add . && git commit -m "enable Google sign-in auto-sync" && git push
```

ব্যাস — অ্যাপে এখন **"Google দিয়ে সাইন ইন করুন"** বোতাম কাজ করবে।

---

## ব্যবহারকারীর দিক থেকে কেমন দেখায়

1. সেটিংস → **"Google দিয়ে সাইন ইন করুন"** → Google-এর পপআপ → অ্যাকাউন্ট বাছাই → অনুমতি দিন
2. এরপর **সব পরিবর্তন ৩ সেকেন্ড পরেই স্বয়ংক্রিয়ভাবে** তার Google Drive-এ সেভ হয়
   (`amar_zakat_app_backup.json` নামে একটি ফাইল — ব্যবহারকারী চাইলে Drive-এ দেখতে পারে)
3. নতুন ফোনে অ্যাপ খুলে একই Google অ্যাকাউন্টে সাইন ইন করলেই **সব ডেটা নিজে নিজে ফিরে আসে**
4. টোকেনের মেয়াদ (~১ ঘণ্টা) শেষ হলে অ্যাপ **নীরবে রিফ্রেশ** করে নেয়

## সমস্যা হলে

| লক্ষণ | কারণ/সমাধান |
|---|---|
| সাইন-ইন হয়, কিন্তু সিঙ্ক হয় না (সেটিংসে লাল কার্ড) | **Drive API Enable নেই** → ধাপ ২; অথবা **drive.file scope যোগ হয়নি** → ধাপ ৩। অ্যাপের লাল কার্ডে ঠিক কোনটা, লেখা থাকবে |
| সাইন-ইন করেই সাইন-আউট হয়ে যায় (পুরনো ভার্সন) | পুরনো বিল্ডের বাগ — নতুন বিল্ডে ঠিক আছে; তবু সিঙ্ক এরর কার্ডে আসল কারণ দেখুন |
| "Access blocked: ... invalid origin" | ধাপ ৪-এ ঐ origin টা authorized origins-এ যোগ হয়নি (https/পোর্ট মিলিয়ে দেখুন) |
| "Access blocked: This app is blocked" | OAuth consent screen তৈরি হয়নি/প্রকাশিত নয় — ধাপ ৩ দেখুন |
| "Access blocked: ... has not completed the Google verification process" | Testing মোড: ব্যবহারকারীর Gmail টা Test users-এ যোগ করুন |
| পপআপ খুলেই বন্ধ | ব্রাউজারের popup-blocker/থার্ড-পার্টি কুকি বন্ধ করা — অনুমতি দিন |
| সাইন-ইন আগে কাজ করছিল, এখন না | Test-user সেশন ৭ দিনে মেয়াদোত্তীর্ণ হতে পারে — আবার সাইন ইন |

---

**প্রাইভেসি:** এই আর্কিটেকচারে ব্যবহারকারীর ডেটা সরাসরি তার ব্রাউজার থেকে তার নিজের Google Drive-এ যায় — অ্যাপ-মালিকের কোনো সার্ভার নেই, কারো ডেটা মালিক দেখতে পায় না।

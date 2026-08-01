/**
 * Google অটো-সিঙ্ক কনফিগারেশন
 * ────────────────────────────
 * ব্যবহারকারীদের কোনো Cloud Console দরকার নেই — Client ID অ্যাপের ভেতরেই থাকে।
 * শুধু অ্যাপ-মালিক (ferdausfs) Google Cloud Console থেকে একটি OAuth Client ID
 * বানাবে (Web application টাইপ) এবং এখানে বসিয়ে দেবে।
 *
 * ➜ ধাপে ধাপে নির্দেশিকা: GOOGLE_SETUP.md দেখুন।
 *
 * Placeholder রাখা থাকলে সাইন-ইন বোতাম ডিসেবল থাকবে এবং সেটিংসে একটি
 * "সেটআপ হয়নি" নোট দেখাবে — বাকি অ্যাপ সম্পূর্ণ অফলাইনে কাজ করবে।
 */
export const GOOGLE_CLIENT_ID = '898898558784-rq7t01mi5a7d7ro7uhbug8orpnb9qvvp.apps.googleusercontent.com';

/** Whether the owner has configured a real client ID yet. */
export const GOOGLE_SYNC_ENABLED = !GOOGLE_CLIENT_ID.startsWith('REPLACE_WITH');

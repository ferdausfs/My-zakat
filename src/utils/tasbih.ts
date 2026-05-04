// Dhikr/Tasbih presets for the counter

export interface DhikrPreset {
  id: string;
  arabic: string;
  transliteration: string;
  bangla: string;
  meaning: string;
  target: number; // recommended count (33, 99, 100, etc.)
  category: 'fard' | 'sunnah' | 'general';
}

export const DHIKR_PRESETS: DhikrPreset[] = [
  {
    id: 'subhanallah',
    arabic: 'سُبْحَانَ اللّٰهِ',
    transliteration: 'সুবহানাল্লাহ',
    bangla: 'সুবহানাল্লাহ',
    meaning: 'আল্লাহ পবিত্র — আল্লাহ সকল ত্রুটি ও দোষ থেকে মুক্ত',
    target: 33,
    category: 'fard',
  },
  {
    id: 'alhamdulillah',
    arabic: 'الْحَمْدُ لِلّٰهِ',
    transliteration: 'আলহামদুলিল্লাহ',
    bangla: 'আলহামদুলিল্লাহ',
    meaning: 'সকল প্রশংসা আল্লাহর জন্য',
    target: 33,
    category: 'fard',
  },
  {
    id: 'allah-hu-akbar',
    arabic: 'اللّٰهُ أَكْبَرُ',
    transliteration: 'আল্লাহু আকবার',
    bangla: 'আল্লাহু আকবার',
    meaning: 'আল্লাহ সবচেয়ে মহান',
    target: 33,
    category: 'fard',
  },
  {
    id: 'la-ilaha',
    arabic: 'لَا إِلٰهَ إِلَّا اللّٰهُ',
    transliteration: 'লা ইলাহা ইল্লাল্লাহ',
    bangla: 'লা ইলাহা ইল্লাল্লাহ',
    meaning: 'আল্লাহ ছাড়া কোনো উপাস্য নেই',
    target: 100,
    category: 'fard',
  },
  {
    id: 'astaghfirullah',
    arabic: 'أَسْتَغْفِرُ اللّٰهَ',
    transliteration: 'আস্তাগফিরুল্লাহ',
    bangla: 'আস্তাগফিরুল্লাহ',
    meaning: 'আমি আল্লাহর কাছে ক্ষমা চাই',
    target: 100,
    category: 'sunnah',
  },
  {
    id: 'salawat',
    arabic: 'اللّٰهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
    transliteration: 'আল্লাহুম্মা সাল্লি আলা মুহাম্মাদ',
    bangla: 'হে আল্লাহ! মুহাম্মাদ ﷺ এর উপর রহমত বর্ষণ করুন',
    meaning: 'দরূদ শরীফ — রাসূল ﷺ এর জন্য আল্লাহর রহমত',
    target: 100,
    category: 'sunnah',
  },
  {
    id: 'hasbunallah',
    arabic: 'حَسْبُنَا اللّٰهُ وَنِعْمَ الْوَكِيلُ',
    transliteration: 'হাসবুনাল্লাহু ওয়া নিমাল ওয়াকীল',
    bangla: 'হাসবুনাল্লাহু ওয়া নিমাল ওয়াকীল',
    meaning: 'আল্লাহই আমাদের জন্য যথেষ্ট, তিনি উত্তম কর্মবিধায়ক',
    target: 100,
    category: 'general',
  },
  {
    id: 'subhanallah-wa-bihamdihi',
    arabic: 'سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ',
    transliteration: 'সুবহানাল্লাহি ওয়া বিহামদিহী',
    bangla: 'সুবহানাল্লাহি ওয়া বিহামদিহী',
    meaning: 'আল্লাহ পবিত্র এবং তাঁর প্রশংসা',
    target: 100,
    category: 'sunnah',
  },
  {
    id: 'subhanallahil-azim',
    arabic: 'سُبْحَانَ اللّٰهِ الْعَظِيمِ وَبِحَمْدِهِ',
    transliteration: 'সুবহানাল্লাহিল আযীম ওয়া বিহামদিহী',
    bangla: 'সুবহানাল্লাহিল আযীম ওয়া বিহামদিহী',
    meaning: 'মহান আল্লাহ পবিত্র এবং তাঁর প্রশংসা',
    target: 100,
    category: 'sunnah',
  },
  {
    id: 'la-hawla',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ',
    transliteration: 'লা হাওলা ওয়ালা কুওয়াতা ইল্লা বিল্লাহ',
    bangla: 'লা হাওলা ওয়ালা কুওয়াতা ইল্লা বিল্লাহ',
    meaning: 'আল্লাহর সাহায্য ছাড়া কোনো শক্তি ও ক্ষমতা নেই',
    target: 100,
    category: 'general',
  },
  {
    id: 'ayatul-kursi',
    arabic: 'اللّٰهُ لَا إِلٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
    transliteration: 'আল্লাহু লা ইলাহা ইল্লা হুয়াল হাইয়্যুল কাইয়্যুম',
    bangla: 'আল্লাহ — তিনি ছাড়া কোনো উপাস্য নেই, তিনি চিরঞ্জীব, সবকিছুর ধারণকারী',
    meaning: 'আয়াতুল কুরসী — সবচেয়ে মহান আয়াত',
    target: 1,
    category: 'general',
  },
  {
    id: 'custom',
    arabic: '',
    transliteration: 'নিজস্ব যিকির',
    bangla: 'আপনার নিজস্ব যিকির',
    meaning: 'নিজের পছন্দের যিকির লিখুন',
    target: 33,
    category: 'general',
  },
];

export interface TasbihStats {
  date: string; // ISO date
  counts: Record<string, number>; // dhikrId -> count
}

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

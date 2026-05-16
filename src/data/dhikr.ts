export interface DhikrPreset {
  id: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  target: number;
  color: string;
}

export const DHIKR_PRESETS: DhikrPreset[] = [
  {
    id: 'subhanallah',
    arabic: 'سُبْحَانَ اللَّهِ',
    transliteration: 'সুবহানাল্লাহ',
    meaning: 'আল্লাহ পবিত্র',
    target: 33,
    color: '#10b981',
  },
  {
    id: 'alhamdulillah',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'আলহামদুলিল্লাহ',
    meaning: 'সকল প্রশংসা আল্লাহর',
    target: 33,
    color: '#f59e0b',
  },
  {
    id: 'allahuakbar',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'আল্লাহু আকবার',
    meaning: 'আল্লাহ সবচেয়ে বড়',
    target: 34,
    color: '#818cf8',
  },
  {
    id: 'lailahaillallah',
    arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ',
    transliteration: 'লা ইলাহা ইল্লাল্লাহ',
    meaning: 'আল্লাহ ছাড়া কোনো ইলাহ নেই',
    target: 100,
    color: '#8b5cf6',
  },
  {
    id: 'astaghfirullah',
    arabic: 'أَسْتَغْفِرُ اللَّهَ',
    transliteration: 'আস্তাগফিরুল্লাহ',
    meaning: 'আমি আল্লাহর কাছে ক্ষমা চাই',
    target: 100,
    color: '#ef4444',
  },
  {
    id: 'salawat',
    arabic: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ',
    transliteration: 'আল্লাহুম্মা সাল্লি আলা মুহাম্মাদ',
    meaning: 'হে আল্লাহ! মুহাম্মাদের উপর রহমত বর্ষণ করুন',
    target: 100,
    color: '#0ea5e9',
  },
  {
    id: 'hauqala',
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'লা হাওলা ওয়ালা কুওয়াতা ইল্লা বিল্লাহ',
    meaning: 'আল্লাহ ছাড়া কোনো শক্তি নেই',
    target: 100,
    color: '#14b8a6',
  },
  {
    id: 'bismillah',
    arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    transliteration: 'বিসমিল্লাহির রাহমানির রাহিম',
    meaning: 'আল্লাহর নামে, যিনি পরম করুণাময়, অতি দয়ালু',
    target: 21,
    color: '#f97316',
  },
  {
    id: 'custom',
    arabic: '',
    transliteration: 'কাস্টম যিকির',
    meaning: 'নিজের পছন্দের যিকির',
    target: 0,
    color: '#94a3b8',
  },
];

export function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

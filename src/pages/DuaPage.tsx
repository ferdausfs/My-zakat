import { useMemo, useState } from 'react';
import { DUAS, DUA_CATEGORIES } from '../utils/dua';

export function DuaPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedDua, setExpandedDua] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredDuas = useMemo(() => {
    return DUAS.filter(d => {
      if (activeCategory && d.category !== activeCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.bangla.toLowerCase().includes(q) ||
          d.meaning.toLowerCase().includes(q) ||
          d.arabic.includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of DUAS) {
      counts[d.category] = (counts[d.category] || 0) + 1;
    }
    return counts;
  }, []);

  const currentCategoryName = activeCategory
    ? DUA_CATEGORIES.find(c => c.id === activeCategory)?.name || ''
    : 'সকল দোয়া';

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">দোয়া সংকলন</h1>
        <p className="text-sm text-gray-400">দৈনন্দিন জীবনের গুরুত্বপূর্ণ দোয়া ও যিকির</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          className="input-field pl-10"
          placeholder="দোয়া খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setActiveCategory(null)}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition ${
            !activeCategory ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          সব ({DUAS.length})
        </button>
        {DUA_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeCategory === cat.id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/15'
            }`}
          >
            <i className={`fas ${cat.icon} mr-1`} />
            {cat.name} ({categoryCounts[cat.id] || 0})
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{currentCategoryName}</h2>
        <span className="text-xs text-gray-400">{filteredDuas.length}টি দোয়া</span>
      </div>

      {/* Duas list */}
      {filteredDuas.length === 0 ? (
        <div className="text-center text-gray-400 py-10">
          <i className="fas fa-search fa-3x mb-3 opacity-30" />
          <p>কোনো দোয়া পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDuas.map(dua => {
            const isExpanded = expandedDua === dua.id;
            const cat = DUA_CATEGORIES.find(c => c.id === dua.category);
            return (
              <div key={dua.id} className="card" style={{ padding: 0 }}>
                <button
                  onClick={() => setExpandedDua(isExpanded ? null : dua.id)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className={`fas ${cat?.icon || 'fa-book-quran'} text-indigo-300 text-sm`} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-base">{dua.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{cat?.name} • {dua.source}</p>
                    {!isExpanded && (
                      <p className="text-sm text-gray-300 mt-1 line-clamp-1 opacity-60">
                        {dua.bangla.substring(0, 60)}...
                      </p>
                    )}
                  </div>
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-500 mt-2`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    <div className="bg-black/20 rounded-xl p-4 text-center" dir="rtl">
                      <p className="text-2xl font-arabic" style={{ lineHeight: '2.2' }}>
                        {dua.arabic}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">উচ্চারণ</h4>
                      <p className="text-base text-gray-200 leading-relaxed bg-black/10 p-3 rounded-lg">
                        {dua.bangla}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">অর্থ</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{dua.meaning}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-indigo-300">
                      <i className="fas fa-book-open" />
                      <span>{dua.source}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-center text-xs text-gray-500 space-y-1">
        <p>📖 দোয়া হলো মুমিনের অস্ত্র</p>
        <p>"আমার বান্দারা আমাকে আমার সম্পর্কে জিজ্ঞেস করলে (তাদের বলে দাও) আমি অতি নিকটে আছি।" — সূরা বাকারা: ১৮৬</p>
      </div>
    </div>
  );
}

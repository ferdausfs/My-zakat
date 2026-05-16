import { useMemo, useState } from 'react';
import { DUAS, DUA_CATEGORIES } from '../data/duas';

interface Props {
  showToast: (msg: string) => void;
}

export function DuaPage({ showToast }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedDua, setExpandedDua] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const handleCopy = async (dua: typeof DUAS[0]) => {
    const text = `${dua.title}\n\n${dua.arabic}\n\nউচ্চারণ: ${dua.bangla}\n\nঅর্থ: ${dua.meaning}\n\n${dua.source}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(dua.id);
      showToast('দোয়া কপি হয়েছে 📋');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('কপি করতে পারিনি');
    }
  };

  return (
    <div className="px-4 pt-5 space-y-4 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold gradient-text">দোয়া সংকলন</h1>
        <p className="text-xs text-gray-400 mt-0.5">দৈনন্দিন জীবনের গুরুত্বপূর্ণ দোয়া ও যিকির</p>
      </div>

      {/* Search */}
      <div className="relative">
        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
        <input
          className="input-field pl-9 pr-9"
          placeholder="দোয়া খুঁজুন..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <i className="fas fa-times text-sm" />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
            !activeCategory ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'border-white/10 text-gray-400 hover:border-white/20'
          }`}
        >
          সকল ({DUAS.length})
        </button>
        {DUA_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              activeCategory === cat.id ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'border-white/10 text-gray-400 hover:border-white/20'
            }`}
          >
            <i className={`fas ${cat.icon} ${cat.color} text-[10px]`} />
            {cat.name} ({categoryCounts[cat.id] || 0})
          </button>
        ))}
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-300">{currentCategoryName}</p>
        <span className="text-xs text-gray-500">{filteredDuas.length}টি দোয়া</span>
      </div>

      {/* Duas list */}
      {filteredDuas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <i className="fas fa-search text-3xl mb-3 opacity-30 block" />
          <p className="text-sm">কোনো দোয়া পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDuas.map(dua => {
            const isExpanded = expandedDua === dua.id;
            const cat = DUA_CATEGORIES.find(c => c.id === dua.category);
            return (
              <div
                key={dua.id}
                className="card overflow-hidden transition-all"
                style={{ padding: 0 }}
              >
                {/* Header */}
                <button
                  className="w-full flex items-center gap-3 p-4 text-left"
                  onClick={() => setExpandedDua(isExpanded ? null : dua.id)}
                >
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    {cat && <i className={`fas ${cat.icon} ${cat.color} text-sm`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{dua.title}</p>
                    <p className="text-xs text-gray-500 truncate">{dua.source}</p>
                  </div>
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-500 text-xs flex-shrink-0`} />
                </button>

                {/* Preview Arabic */}
                {!isExpanded && (
                  <div className="px-4 pb-3">
                    <p className="font-arabic text-sm text-gray-300 text-right leading-relaxed line-clamp-2">{dua.arabic}</p>
                  </div>
                )}

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                    {/* Arabic */}
                    <div className="p-4 rounded-xl bg-black/20 mt-3">
                      <p className="font-arabic text-lg text-right leading-loose text-white">{dua.arabic}</p>
                    </div>

                    {/* Transliteration */}
                    <div>
                      <p className="text-[10px] text-indigo-400 font-semibold mb-1 uppercase tracking-wider">উচ্চারণ</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{dua.bangla}</p>
                    </div>

                    {/* Meaning */}
                    <div>
                      <p className="text-[10px] text-emerald-400 font-semibold mb-1 uppercase tracking-wider">অর্থ</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{dua.meaning}</p>
                    </div>

                    {/* Source */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <i className="fas fa-book text-amber-500" />{dua.source}
                      </p>
                      <button
                        onClick={() => handleCopy(dua)}
                        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition ${
                          copiedId === dua.id
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <i className={`fas ${copiedId === dua.id ? 'fa-check' : 'fa-copy'} text-[10px]`} />
                        {copiedId === dua.id ? 'কপি হয়েছে' : 'কপি'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom quote */}
      <div className="card text-center" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <p className="text-xs font-arabic text-indigo-300 text-lg mb-1">وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ</p>
        <p className="text-xs text-gray-400 italic">
          "আমার বান্দারা আমার সম্পর্কে জিজ্ঞেস করলে — আমি অতি নিকটে।"
        </p>
        <p className="text-[10px] text-gray-600 mt-1">— সূরা বাকারা: ১৮৬</p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Map } from 'lucide-react';
import { api } from '@/lib/api';
import { HoSoJourney } from '@/components/HoSoJourney/HoSoJourney';

interface CaseOption {
  id: string;
  stt: string;
  name: string;
  status: string;
  deadline: string | null;
}

function useCaseSearch(query: string) {
  return useQuery<CaseOption[]>({
    queryKey: ['case-search-journey', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await api.get(`/cases?search=${encodeURIComponent(query)}&limit=10`);
      return (res.data?.data ?? []) as CaseOption[];
    },
    enabled: query.trim().length >= 1,
    staleTime: 30 * 1000,
  });
}

export default function JourneyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults = [] } = useCaseSearch(searchQuery);

  useEffect(() => {
    if (searchResults.length > 0 && searchQuery.trim()) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [searchResults, searchQuery]);

  function handleSelect(c: CaseOption) {
    setSelectedCase(c);
    setSearchQuery(`${c.stt} — ${c.name}`);
    setShowDropdown(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Page header */}
      <div className="flex items-center gap-2 mb-6">
        <Map className="w-5 h-5 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Hành Trình Hồ Sơ</h1>
      </div>

      {/* Case search */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            data-testid="journey-case-search"
            type="text"
            placeholder="Tìm vụ việc theo mã số hoặc tên..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedCase(null);
            }}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dropdown results */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
            {searchResults.map((c) => (
              <button
                key={c.id}
                data-testid={`journey-case-option-${c.id}`}
                onClick={() => handleSelect(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
              >
                <span className="font-medium text-sm text-gray-900">{c.stt}</span>
                <span className="text-gray-500 text-sm ml-2">— {c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Journey panel */}
      {selectedCase ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <HoSoJourney
            caseId={selectedCase.id}
            caseStt={selectedCase.stt}
            deadline={selectedCase.deadline ? new Date(selectedCase.deadline) : undefined}
          />
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Map className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Chọn một vụ việc để xem hành trình hồ sơ</p>
        </div>
      )}
    </div>
  );
}

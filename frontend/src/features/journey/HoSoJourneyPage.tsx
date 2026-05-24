import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
import { HoSoJourney } from '@/components/HoSoJourney/HoSoJourney';
import { JourneyNavigator } from './JourneyNavigator';
import type { TimelineEntityType } from '@/components/HoSoJourney/useCaseJourney';

interface SelectedEntity {
  type: TimelineEntityType;
  id: string;
  stt: string;
  name?: string;
}

// ─── Mobile guard ─────────────────────────────────────────────────────────────

function MobileUnsupported() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 p-8 text-center">
      <div>
        <GitBranch className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-base font-medium text-gray-600">Vui lòng sử dụng máy tính</p>
        <p className="text-sm text-gray-400 mt-1">Trang Hành Trình Hồ Sơ yêu cầu màn hình rộng hơn 1024px</p>
      </div>
    </div>
  );
}

// ─── Empty right panel ────────────────────────────────────────────────────────

function RightPanelPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <GitBranch className="w-12 h-12 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-500">Chọn một hồ sơ để xem hành trình</p>
      <p className="text-xs text-gray-400 mt-1">Tìm kiếm hoặc duyệt danh sách bên trái</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HoSoJourneyPage() {
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<SelectedEntity | null>(() => {
    const type = searchParams.get('type') as TimelineEntityType | null;
    const id = searchParams.get('id');
    const stt = searchParams.get('stt') ?? '';
    if (type && id) return { type, id, stt };
    return null;
  });

  // Sync URL on entity select
  useEffect(() => {
    if (selected) {
      setSearchParams(
        { type: selected.type, id: selected.id, stt: selected.stt },
        { replace: true },
      );
    }
  }, [selected, setSearchParams]);

  const handleSelect = (entity: SelectedEntity) => {
    setSelected(entity);
  };

  if (isMobile) return <MobileUnsupported />;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Left navigator */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <JourneyNavigator selected={selected} onSelect={handleSelect} />
      </div>

      {/* Right timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <HoSoJourney
            entityType={selected.type}
            entityId={selected.id}
            caseStt={selected.stt}
          />
        ) : (
          <RightPanelPlaceholder />
        )}
      </div>
    </div>
  );
}

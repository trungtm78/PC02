import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { HoSoJourney } from '@/components/HoSoJourney/HoSoJourney';

function useCaseBasic(caseId: string) {
  return useQuery({
    queryKey: ['case-basic', caseId],
    queryFn: async () => {
      const res = await api.get(`/cases/${caseId}`);
      return res.data?.data as { id: string; stt: string; name: string; deadline: string | null };
    },
    enabled: !!caseId,
    staleTime: 5 * 60 * 1000,
  });
}

export default function CaseJourneyStandalonePage() {
  const { id } = useParams<{ id: string }>();
  const { data: caseData } = useCaseBasic(id ?? '');

  if (!id) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link
          to={`/cases/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại vụ việc{caseData?.stt ? ` ${caseData.stt}` : ''}
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <HoSoJourney
          caseId={id}
          caseStt={caseData?.stt}
          deadline={caseData?.deadline ? new Date(caseData.deadline) : undefined}
        />
      </div>
    </div>
  );
}

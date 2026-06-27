/**
 * ConvertPetitionModal — Nhóm II: Chuyển đổi đơn thư thành Vụ việc hoặc Vụ án
 * Hiển thị khi cán bộ click "Chuyển đổi" trên PetitionFormPage (edit mode)
 */
import { useState } from 'react';
import { X, ArrowRight, FileSearch, Scale } from 'lucide-react';

export type ConvertTarget = 'incident' | 'case';

export interface ConvertToIncidentPayload {
  incidentName: string;
  incidentType: string;
  description?: string;
  assignedToId?: string;
  expectedUpdatedAt?: string;
}

export interface ConvertToCasePayload {
  caseName: string;
  crime: string;
  jurisdiction: string;
  suspect?: string;
  prosecutionDecision?: string;
  prosecutionDate?: string;
  expectedUpdatedAt: string;
}

interface Props {
  petitionUpdatedAt: string | null;
  onClose: () => void;
  onSubmitIncident: (payload: ConvertToIncidentPayload) => Promise<void>;
  onSubmitCase: (payload: ConvertToCasePayload) => Promise<void>;
}

export function ConvertPetitionModal({
  petitionUpdatedAt,
  onClose,
  onSubmitIncident,
  onSubmitCase,
}: Props) {
  const [target, setTarget] = useState<ConvertTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Incident form state
  const [incidentName, setIncidentName] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');

  // Case form state
  const [caseName, setCaseName] = useState('');
  const [crime, setCrime] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [suspect, setSuspect] = useState('');

  const handleSubmitIncident = async () => {
    const errs: string[] = [];
    if (!incidentName.trim()) errs.push('Tên vụ việc là bắt buộc');
    if (!incidentType.trim()) errs.push('Loại vụ việc là bắt buộc');
    if (errs.length) { setErrors(errs); return; }

    setIsSubmitting(true);
    setErrors([]);
    try {
      await onSubmitIncident({
        incidentName: incidentName.trim(),
        incidentType: incidentType.trim(),
        description: incidentDesc.trim() || undefined,
        expectedUpdatedAt: petitionUpdatedAt ?? undefined,
      });
    } catch (e: any) {
      setErrors([e?.response?.data?.message || e?.message || 'Có lỗi xảy ra khi chuyển đổi']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCase = async () => {
    const errs: string[] = [];
    if (!caseName.trim()) errs.push('Tên vụ án là bắt buộc');
    if (!crime.trim()) errs.push('Tội danh là bắt buộc');
    if (!jurisdiction.trim()) errs.push('Thẩm quyền là bắt buộc');
    if (!petitionUpdatedAt) errs.push('Không thể xác định phiên bản đơn thư');
    if (errs.length) { setErrors(errs); return; }

    setIsSubmitting(true);
    setErrors([]);
    try {
      await onSubmitCase({
        caseName: caseName.trim(),
        crime: crime.trim(),
        jurisdiction: jurisdiction.trim(),
        suspect: suspect.trim() || undefined,
        expectedUpdatedAt: petitionUpdatedAt!,
      });
    } catch (e: any) {
      setErrors([e?.response?.data?.message || e?.message || 'Có lỗi xảy ra khi chuyển đổi']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="convert-modal"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">
            Chuyển đổi đơn thư
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
            data-testid="convert-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-600">{e}</p>
            ))}
          </div>
        )}

        {/* Step 1: Chọn loại */}
        {!target && (
          <div>
            <p className="text-sm text-slate-600 mb-4">Chuyển sang loại nào?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="convert-option-incident"
                onClick={() => { setTarget('incident'); setErrors([]); }}
                className="flex flex-col items-center gap-2 p-5 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors group"
              >
                <FileSearch className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-slate-700">Vụ việc</span>
                <span className="text-xs text-slate-500 text-center">Xác minh điều tra (Điều 143 BLTTHS)</span>
              </button>
              <button
                type="button"
                data-testid="convert-option-case"
                onClick={() => { setTarget('case'); setErrors([]); }}
                className="flex flex-col items-center gap-2 p-5 border-2 border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-colors group"
              >
                <Scale className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-slate-700">Vụ án</span>
                <span className="text-xs text-slate-500 text-center">Khởi tố vụ án (Điều 147 BLTTHS)</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2a: Form Vụ việc */}
        {target === 'incident' && (
          <div className="space-y-4">
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              onClick={() => { setTarget(null); setErrors([]); }}
            >
              ← Quay lại
            </button>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên vụ việc <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="convert-incident-name"
                value={incidentName}
                onChange={e => setIncidentName(e.target.value)}
                placeholder="Nhập tên vụ việc"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Loại vụ việc <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="convert-incident-type"
                value={incidentType}
                onChange={e => setIncidentType(e.target.value)}
                placeholder="VD: Tố cáo vi phạm đất đai"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mô tả ban đầu
              </label>
              <textarea
                data-testid="convert-incident-description"
                value={incidentDesc}
                onChange={e => setIncidentDesc(e.target.value)}
                rows={3}
                placeholder="Mô tả ban đầu của vụ việc (không bắt buộc)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                Hủy
              </button>
              <button
                type="button"
                data-testid="convert-submit"
                disabled={isSubmitting}
                onClick={handleSubmitIncident}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
                {isSubmitting ? 'Đang chuyển...' : 'Chuyển thành Vụ việc'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2b: Form Vụ án */}
        {target === 'case' && (
          <div className="space-y-4">
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              onClick={() => { setTarget(null); setErrors([]); }}
            >
              ← Quay lại
            </button>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên vụ án <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="convert-case-name"
                value={caseName}
                onChange={e => setCaseName(e.target.value)}
                placeholder="Nhập tên vụ án"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tội danh <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="convert-case-crime"
                value={crime}
                onChange={e => setCrime(e.target.value)}
                placeholder="Nhập tội danh"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Thẩm quyền <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="convert-case-jurisdiction"
                value={jurisdiction}
                onChange={e => setJurisdiction(e.target.value)}
                placeholder="Nhập thẩm quyền xử lý"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nghi phạm
              </label>
              <input
                type="text"
                data-testid="convert-case-suspect"
                value={suspect}
                onChange={e => setSuspect(e.target.value)}
                placeholder="Tên nghi phạm (không bắt buộc)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                Hủy
              </button>
              <button
                type="button"
                data-testid="convert-submit"
                disabled={isSubmitting}
                onClick={handleSubmitCase}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
                {isSubmitting ? 'Đang chuyển...' : 'Khởi tố Vụ án'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { MapPin, ArrowRight, Check, X } from 'lucide-react';
import type { AddressConversionPreview } from '@/hooks/useAddressConverter';

interface Props {
  preview: AddressConversionPreview;
  onApply: () => void;
  onCancel: () => void;
}

export function AddressConversionDialog({ preview, onApply, onCancel }: Props) {
  // Enter = confirm, Escape = cancel — stopPropagation to prevent form submit
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onApply(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
    }
    document.addEventListener('keydown', handler, true); // capture phase
    return () => document.removeEventListener('keydown', handler, true);
  }, [onApply, onCancel]);

  // Highlight the changed part in the address strings
  const highlight = (text: string, fragment: string, color: string) => {
    const idx = text.indexOf(fragment);
    if (idx < 0) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className={`${color} px-0.5 rounded not-italic`}>{fragment}</mark>
        {text.slice(idx + fragment.length)}
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Chuyển đổi địa chỉ</h3>
            <p className="text-xs text-slate-500">Cải cách hành chính 2025 — bỏ cấp quận/huyện (F10)</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Before */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">✕</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Địa chỉ cũ</span>
            </div>
            <p className="text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-slate-700 font-mono">
              {highlight(preview.original, preview.oldFragment, 'bg-red-200 text-red-800')}
            </p>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <ArrowRight className="w-4 h-4" />
              <span>chuyển thành</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* After */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">✓</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Địa chỉ mới</span>
            </div>
            <p className="text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-slate-700 font-mono">
              {highlight(preview.converted, preview.newFragment, 'bg-green-200 text-green-800')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <p className="text-xs text-slate-400">
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">Enter</kbd> xác nhận •{' '}
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">Esc</kbd> hủy
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors">
              <X className="w-4 h-4" />
              Giữ nguyên
            </button>
            <button onClick={onApply}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Check className="w-4 h-4" />
              Áp dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

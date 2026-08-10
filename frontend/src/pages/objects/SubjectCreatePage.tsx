/**
 * D2 / ND-16 — form tạo đối tượng liên quan.
 *
 * Ba màn hình Nghi phạm / Bị hại / Nhân chứng chỉ LIỆT KÊ. Không có đường nào
 * trong giao diện tạo ra một bị hại hay nhân chứng: `POST /subjects` tồn tại,
 * và cách duy nhất gọi được nó là qua form vụ án. Ai cần thêm nhân chứng cho hồ
 * sơ đã lập thì không có chỗ để làm.
 *
 * `caseId` BẮT BUỘC và có ô chọn thật, không phải ô gõ id. Backend từ chối
 * `caseId` ngoài phạm vi tổ (ND-18), nên ô chọn chỉ liệt kê vụ án người dùng
 * đọc được — ngăn chuyện gõ id vụ án tổ khác rồi nhận 403 sau khi đã điền xong.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { usePermission } from '@/hooks/usePermission';
import { SubjectType } from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING } from '@/constants/styles';

const TYPE_LABEL: Record<string, string> = {
  [SubjectType.SUSPECT]: 'nghi phạm',
  [SubjectType.VICTIM]: 'bị hại',
  [SubjectType.WITNESS]: 'nhân chứng',
};

const LIST_PATH: Record<string, string> = {
  [SubjectType.SUSPECT]: '/people/suspects',
  [SubjectType.VICTIM]: '/people/victims',
  [SubjectType.WITNESS]: '/people/witnesses',
};

interface CaseOption {
  id: string;
  caseCode: string | null;
  name: string;
}

export function SubjectCreatePage({ subjectType }: { subjectType: string }) {
  const navigate = useNavigate();
  const { caseId: presetCaseId } = useParams<{ caseId?: string }>();
  const { canCreate } = usePermission();

  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: 'MALE',
    idNumber: '',
    address: '',
    phone: '',
  });
  const [caseId, setCaseId] = useState(presetCaseId ?? '');
  const [caseLabel, setCaseLabel] = useState('');
  const [caseQuery, setCaseQuery] = useState('');
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = TYPE_LABEL[subjectType] ?? 'đối tượng';

  const searchCases = useCallback(async (q: string) => {
    try {
      const res = await api.get(`/cases?limit=20${q ? `&search=${encodeURIComponent(q)}` : ''}`);
      setCaseOptions((res.data?.data ?? []) as CaseOption[]);
    } catch {
      setCaseOptions([]);
    }
  }, []);

  useEffect(() => {
    if (!picking) return;
    const t = setTimeout(() => void searchCases(caseQuery), 300);
    return () => clearTimeout(t);
  }, [picking, caseQuery, searchCases]);

  if (!canCreate('objects')) {
    return (
      <div className="p-6" data-testid="subject-create-denied">
        <p className="text-slate-600">Bạn không có quyền tạo {label}.</p>
      </div>
    );
  }

  const invalid =
    !caseId ||
    form.fullName.trim().length < 2 ||
    !form.dateOfBirth ||
    !/^\d{9}$|^\d{12}$/.test(form.idNumber) ||
    form.address.trim().length < 2;

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.post('/subjects', {
        ...form,
        phone: form.phone || undefined,
        caseId,
        type: subjectType,
      });
    } catch (e) {
      // Báo lỗi rồi DỪNG — điều hướng đi là nói dối rằng đã lưu.
      setError(extractApiError(e, `Tạo ${label} thất bại`).message);
      setSaving(false);
      return;
    }
    setSaving(false);
    navigate(LIST_PATH[subjectType] ?? '/objects');
  };

  const field = (
    key: keyof typeof form,
    text: string,
    required = false,
    type = 'text',
    placeholder = '',
  ) => (
    <label className="block text-sm">
      <span className="block font-medium text-slate-700 mb-1.5">
        {text} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        data-testid={`field-${key}`}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
      />
    </label>
  );

  return (
    <div className="p-6 max-w-3xl space-y-5" data-testid="subject-create-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Thêm {label}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Mọi {label} đều thuộc về một vụ án cụ thể — chọn hồ sơ trước khi nhập thông tin.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">
            Vụ án <span className="text-red-500">*</span>
          </span>
          {caseId ? (
            <div
              className="flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg text-sm"
              data-testid="case-selected"
            >
              <span>{caseLabel || caseId}</span>
              <button
                onClick={() => {
                  setCaseId('');
                  setCaseLabel('');
                }}
                aria-label="Bỏ chọn vụ án"
                data-testid="case-clear"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={caseQuery}
                  onFocus={() => setPicking(true)}
                  onChange={(e) => {
                    setPicking(true);
                    setCaseQuery(e.target.value);
                  }}
                  data-testid="case-search"
                  placeholder="Tìm theo mã hoặc tên vụ án"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              {picking && (
                <ul className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {caseOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500" data-testid="case-empty">
                      {/* Danh sách chỉ có vụ án người dùng đọc được, nên rỗng ở
                          đây nghĩa là "không có vụ án nào trong phạm vi của
                          anh", không phải "hệ thống không có vụ án nào". */}
                      Không có vụ án nào trong phạm vi của bạn khớp tìm kiếm.
                    </li>
                  ) : (
                    caseOptions.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => {
                            setCaseId(c.id);
                            setCaseLabel(`${c.caseCode ?? c.id.slice(0, 8)} — ${c.name}`);
                            setPicking(false);
                          }}
                          data-testid={`case-option-${c.id}`}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                        >
                          <b>{c.caseCode ?? c.id.slice(0, 8)}</b> — {c.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {field('fullName', 'Họ và tên', true, 'text', 'Nhập họ và tên')}
        {field('dateOfBirth', 'Ngày sinh', true, 'date')}
        <label className="block text-sm">
          <span className="block font-medium text-slate-700 mb-1.5">Giới tính</span>
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            data-testid="field-gender"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        {field('idNumber', 'Số CCCD/CMND', true, 'text', '9 hoặc 12 chữ số')}
        {field('address', 'Địa chỉ', true, 'text', 'Nhập địa chỉ')}
        {field('phone', 'Số điện thoại', false, 'text', '09xx xxx xxx')}

        {error && (
          <p className="text-sm text-red-600" data-testid="submit-error">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => navigate(LIST_PATH[subjectType] ?? '/objects')}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
        >
          Huỷ
        </button>
        <button
          onClick={() => void submit()}
          disabled={invalid || saving}
          data-testid="btn-save-subject"
          className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Đang lưu…' : `Lưu ${label}`}
        </button>
      </div>
    </div>
  );
}

export default SubjectCreatePage;

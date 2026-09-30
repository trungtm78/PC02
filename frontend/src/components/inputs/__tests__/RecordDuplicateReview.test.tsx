import { createRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordDuplicateReview, type RecordDuplicateReviewHandle } from '../RecordDuplicateReview';

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

function Harness() {
  const [name, setName] = useState('Ủy thác Trần Văn An');
  const [decisionNumber, setDecisionNumber] = useState('58/QD-2026');
  const [saved, setSaved] = useState('');
  const reviewRef = createRef<RecordDuplicateReviewHandle>();
  const save = async () => {
    const result = await reviewRef.current?.verify();
    if (result?.ok) setSaved(result.acknowledgedIds.join(','));
  };
  return <>
    <input aria-label="Tên" value={name} onChange={(event) => setName(event.target.value)} />
    <input aria-label="Số quyết định" value={decisionNumber} onChange={(event) => setDecisionNumber(event.target.value)} />
    <RecordDuplicateReview ref={reviewRef} kind="delegation" name={name} decisionNumber={decisionNumber} excludeId="current" />
    <button onClick={() => void save()}>Lưu</button>
    <output data-testid="saved">{saved}</output>
  </>;
}

describe('RecordDuplicateReview', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockResolvedValue({ data: [{ id: 'old-1', caseCode: 'UTDT-001', name: 'Ủy thác Trần Văn An', confidence: 'HIGH', reasons: ['NAME_MATCH'] }] });
    post.mockResolvedValue({ data: [{ id: 'old-1', code: 'VV-001', name: 'Vụ việc cũ', confidence: 'HIGH', reasons: ['PHONE_MATCH'] }] });
  });

  it('reviews a petition by name and identity and explains the matching reasons', async () => {
    get.mockResolvedValue({ data: [{ id: 'petition-1', stt: 'DT-001', name: 'Nguyễn Văn A', confidence: 'HIGH', reasons: ['NAME_MATCH', 'ID_NUMBER_MATCH'] }] });
    render(<RecordDuplicateReview kind="petition" name="Nguyễn Văn A" idNumber="012345678901" phone="0901234567" excludeId="current" />);
    fireEvent.click(screen.getByRole('button', { name: /Rà soát trùng/i }));
    expect(await screen.findByText('DT-001')).toBeInTheDocument();
    expect(screen.getByText(/Trùng số CCCD/i)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/petitions/duplicate-review', {
      params: { name: 'Nguyễn Văn A', idNumber: '012345678901', phone: '0901234567', excludeId: 'current' },
    });
  });

  it('opens candidate details from STT and lets the user collapse the review to continue the form', async () => {
    get.mockResolvedValue({ data: [{
      id: 'petition-1', stt: 'DT-001', name: 'Nguyễn Văn A',
      confidence: 'HIGH', reasons: ['ID_NUMBER_MATCH'],
      receivedDate: '2026-09-01', summary: 'Nội dung đã tiếp nhận',
    }] });
    render(<>
      <input aria-label="Nội dung đang nhập" defaultValue="Chưa lưu" />
      <RecordDuplicateReview kind="petition" name="Nguyễn Văn A" idNumber="012345678901" />
    </>);
    fireEvent.click(screen.getByRole('button', { name: /Rà soát trùng/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Thông tin hồ sơ cần rà soát: DT-001/i }));
    expect(screen.getByRole('dialog', { name: /Thông tin hồ sơ cần rà soát/i })).toHaveTextContent('Nội dung đã tiếp nhận');
    fireEvent.click(screen.getByRole('button', { name: /Thu nhỏ và tiếp tục nhập/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thông tin hồ sơ cần rà soát: DT-001/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nội dung đang nhập' })).toHaveValue('Chưa lưu');
    fireEvent.click(screen.getByRole('button', { name: /Mở lại kết quả rà soát/i }));
    expect(screen.getByRole('button', { name: /Thông tin hồ sơ cần rà soát: DT-001/i })).toBeInTheDocument();
  });

  it('sends all incident duplicate signals and explains location matches', async () => {
    post.mockResolvedValue({ data: [{
      id: 'incident-1', code: 'VV-001', name: 'Vụ việc cũ', confidence: 'HIGH',
      reasons: ['PHONE_MATCH', 'LOCATION_MATCH'],
    }] });
    render(<RecordDuplicateReview
      kind="incident"
      name="Vụ việc mới"
      reporter="Nguyễn Văn A"
      idNumber="012345678901"
      phone="0901234567"
      content="Nội dung tố giác"
      date="2026-09-01"
      location="Phường Bến Thành"
      excludeId="current"
    />);
    fireEvent.click(screen.getByRole('button', { name: /Rà soát trùng/i }));
    expect(await screen.findByText('VV-001')).toBeInTheDocument();
    expect(screen.getByText(/Trùng địa điểm/i)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/incidents/duplicate-review', {
      name: 'Vụ việc mới', reporter: 'Nguyễn Văn A', idNumber: '012345678901',
      phone: '0901234567', content: 'Nội dung tố giác', date: '2026-09-01',
      location: 'Phường Bến Thành', excludeId: 'current',
    });
  });

  it('blocks save until the operator acknowledges a high-confidence delegation match', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('UTDT-001')).toBeInTheDocument();
    expect(screen.getByTestId('saved')).toHaveTextContent('');
    expect(get).toHaveBeenCalledWith('/cases/duplicate-review', {
      params: { name: 'Ủy thác Trần Văn An', excludeId: 'current', caseType: 'UY_THAC_DIEU_TRA', decisionNumber: '58/QD-2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đã rà soát/i }));
    expect(screen.getByRole('button', { name: /Mở lại kết quả rà soát/i })).toBeInTheDocument();
    expect(screen.getByText(/Có thể tiếp tục nhập thông tin hoặc lưu hồ sơ/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.getByTestId('saved')).toHaveTextContent('old-1'));
  });

  it('requires a new acknowledgement if another high-confidence match appears', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText('UTDT-001');
    fireEvent.click(screen.getByRole('button', { name: /đã rà soát/i }));
    get.mockResolvedValue({ data: [
      { id: 'old-1', caseCode: 'UTDT-001', name: 'Ủy thác Trần Văn An', confidence: 'HIGH', reasons: ['NAME_MATCH'] },
      { id: 'old-2', caseCode: 'UTDT-002', name: 'Ủy thác Trần Văn An', confidence: 'HIGH', reasons: ['NAME_MATCH'] },
    ] });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('UTDT-002')).toBeInTheDocument();
    expect(screen.getByTestId('saved')).toHaveTextContent('');
  });

  it('acknowledges every high-confidence candidate when there are more than twenty', async () => {
    const matches = Array.from({ length: 21 }, (_, index) => ({
      id: `old-${index}`,
      caseCode: `UTDT-${index}`,
      name: 'Ủy thác Trần Văn An',
      confidence: 'HIGH',
      reasons: ['NAME_MATCH'],
    }));
    get.mockResolvedValue({ data: matches });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('UTDT-20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /đã rà soát/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.getByTestId('saved').textContent?.split(',')).toHaveLength(21));
  });

  it('hides candidates from the previous name as soon as the name changes', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('UTDT-001')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên' }), { target: { value: 'Ủy thác mới' } });
    expect(screen.queryByText('UTDT-001')).not.toBeInTheDocument();
  });

  it('requires another review when the delegation decision number changes', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('UTDT-001')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Số quyết định' }), { target: { value: '59/QD-2026' } });
    expect(screen.queryByText('UTDT-001')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/cases/duplicate-review', {
      params: { name: 'Ủy thác Trần Văn An', excludeId: 'current', caseType: 'UY_THAC_DIEU_TRA', decisionNumber: '59/QD-2026' },
    }));
    expect(screen.getByTestId('saved')).toHaveTextContent('');
  });

  it('clears an old review error when the identifying input changes', async () => {
    get.mockRejectedValue(new Error('network down'));
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên' }), { target: { value: 'Ủy thác khác' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

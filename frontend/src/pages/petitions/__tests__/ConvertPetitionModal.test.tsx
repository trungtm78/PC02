import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConvertPetitionModal } from '../ConvertPetitionModal';

// ─── Nhóm II: ConvertPetitionModal (direct component tests) ──────────────────

describe('ConvertPetitionModal', () => {
  const defaultProps = {
    petitionUpdatedAt: '2026-06-01T10:00:00.000Z',
    onClose: vi.fn(),
    onSubmitIncident: vi.fn().mockResolvedValue(undefined),
    onSubmitCase: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onClose = vi.fn();
    defaultProps.onSubmitIncident = vi.fn().mockResolvedValue(undefined);
    defaultProps.onSubmitCase = vi.fn().mockResolvedValue(undefined);
  });

  it('II-MOD1: modal hiển thị với 2 lựa chọn chuyển đổi', () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    expect(screen.getByTestId('convert-modal')).toBeInTheDocument();
    expect(screen.getByTestId('convert-option-incident')).toBeInTheDocument();
    expect(screen.getByTestId('convert-option-case')).toBeInTheDocument();
  });

  it('II-MOD2: click close button gọi onClose', () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-modal-close'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('II-MOD3: chọn Vụ việc hiển thị form incidentName + incidentType', () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-incident'));
    expect(screen.getByTestId('convert-incident-name')).toBeInTheDocument();
    expect(screen.getByTestId('convert-incident-type')).toBeInTheDocument();
  });

  it('II-MOD4: submit Vụ việc với field hợp lệ gọi onSubmitIncident', async () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-incident'));
    fireEvent.change(screen.getByTestId('convert-incident-name'), { target: { value: 'Vụ lừa đảo đất đai' } });
    fireEvent.change(screen.getByTestId('convert-incident-type'), { target: { value: 'Lừa đảo chiếm đoạt' } });
    fireEvent.click(screen.getByTestId('convert-submit'));
    await waitFor(() => {
      expect(defaultProps.onSubmitIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentName: 'Vụ lừa đảo đất đai',
          incidentType: 'Lừa đảo chiếm đoạt',
          expectedUpdatedAt: '2026-06-01T10:00:00.000Z',
        }),
      );
    });
  });

  it('II-MOD5: submit Vụ việc thiếu incidentName → hiển thị lỗi validation', () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-incident'));
    fireEvent.change(screen.getByTestId('convert-incident-type'), { target: { value: 'Có type' } });
    // Không điền incidentName
    fireEvent.click(screen.getByTestId('convert-submit'));
    expect(screen.getByText(/Tên vụ việc là bắt buộc/)).toBeInTheDocument();
    expect(defaultProps.onSubmitIncident).not.toHaveBeenCalled();
  });

  it('II-MOD6: submit Vụ việc thiếu incidentType → hiển thị lỗi validation', () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-incident'));
    fireEvent.change(screen.getByTestId('convert-incident-name'), { target: { value: 'Tên vụ việc' } });
    // Không điền incidentType
    fireEvent.click(screen.getByTestId('convert-submit'));
    expect(screen.getByText(/Loại vụ việc là bắt buộc/)).toBeInTheDocument();
    expect(defaultProps.onSubmitIncident).not.toHaveBeenCalled();
  });

  it('II-MOD7: chọn Vụ án hiển thị form caseName + crime + jurisdiction', () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-case'));
    expect(screen.getByTestId('convert-case-name')).toBeInTheDocument();
    expect(screen.getByTestId('convert-case-crime')).toBeInTheDocument();
    expect(screen.getByTestId('convert-case-jurisdiction')).toBeInTheDocument();
  });

  it('II-MOD8: submit Vụ án với field hợp lệ gọi onSubmitCase', async () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-case'));
    fireEvent.change(screen.getByTestId('convert-case-name'), { target: { value: 'Vụ án cướp tài sản' } });
    fireEvent.change(screen.getByTestId('convert-case-crime'), { target: { value: 'Cướp tài sản' } });
    fireEvent.change(screen.getByTestId('convert-case-jurisdiction'), { target: { value: 'PC02 - TP.HCM' } });
    fireEvent.click(screen.getByTestId('convert-submit'));
    await waitFor(() => {
      expect(defaultProps.onSubmitCase).toHaveBeenCalledWith(
        expect.objectContaining({
          caseName: 'Vụ án cướp tài sản',
          crime: 'Cướp tài sản',
          jurisdiction: 'PC02 - TP.HCM',
          expectedUpdatedAt: '2026-06-01T10:00:00.000Z',
        }),
      );
    });
  });

  it('II-MOD9: quay lại từ form incident → hiển thị lại 2 options', () => {
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-incident'));
    // Form incident hiển thị
    expect(screen.getByTestId('convert-incident-name')).toBeInTheDocument();
    // Click quay lại
    fireEvent.click(screen.getByText(/← Quay lại/));
    // 2 options xuất hiện lại
    expect(screen.getByTestId('convert-option-incident')).toBeInTheDocument();
    expect(screen.getByTestId('convert-option-case')).toBeInTheDocument();
  });

  it('II-MOD10: onSubmitIncident throw → hiển thị error message', async () => {
    defaultProps.onSubmitIncident = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<ConvertPetitionModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('convert-option-incident'));
    fireEvent.change(screen.getByTestId('convert-incident-name'), { target: { value: 'Vụ test' } });
    fireEvent.change(screen.getByTestId('convert-incident-type'), { target: { value: 'Tội phạm' } });
    fireEvent.click(screen.getByTestId('convert-submit'));
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportRulesStep from '../ReportRulesStep';

describe('ReportRulesStep (S36, PR9 slice 1)', () => {
  it('"Tiếp theo" proceeds with an empty rule list when nothing was added (rules are optional)', () => {
    const onNext = vi.fn();
    render(<ReportRulesStep onBack={() => {}} onNext={onNext} />);

    fireEvent.click(screen.getByTestId('btn-rules-next'));

    expect(onNext).toHaveBeenCalledWith([]);
  });

  it('"Thêm quy tắc" stays disabled until name/leftExpr/rightExpr/message are all filled', () => {
    render(<ReportRulesStep onBack={() => {}} onNext={() => {}} />);

    expect(screen.getByTestId('btn-add-rule')).toBeDisabled();

    fireEvent.change(screen.getByTestId('input-rule-name'), { target: { value: 'R1' } });
    expect(screen.getByTestId('btn-add-rule')).toBeDisabled();

    fireEvent.change(screen.getByTestId('input-rule-left'), { target: { value: 'D10' } });
    fireEvent.change(screen.getByTestId('input-rule-right'), { target: { value: 'D11+D12' } });
    expect(screen.getByTestId('btn-add-rule')).toBeDisabled();

    fireEvent.change(screen.getByTestId('input-rule-message'), { target: { value: 'Sai lệch' } });
    expect(screen.getByTestId('btn-add-rule')).not.toBeDisabled();
  });

  it('adds a rule to the list, clears the draft form, and includes it on "Tiếp theo"', () => {
    const onNext = vi.fn();
    render(<ReportRulesStep onBack={() => {}} onNext={onNext} />);

    fireEvent.change(screen.getByTestId('input-rule-name'), { target: { value: 'D10 bằng tổng' } });
    fireEvent.change(screen.getByTestId('input-rule-left'), { target: { value: 'D10' } });
    fireEvent.change(screen.getByTestId('select-rule-operator'), { target: { value: 'EQ' } });
    fireEvent.change(screen.getByTestId('input-rule-right'), { target: { value: 'D11+D12' } });
    fireEvent.change(screen.getByTestId('select-rule-severity'), { target: { value: 'ERROR' } });
    fireEvent.change(screen.getByTestId('input-rule-message'), { target: { value: 'D10 không khớp' } });
    fireEvent.click(screen.getByTestId('btn-add-rule'));

    expect(screen.getByTestId('rule-row-0')).toHaveTextContent('D10 bằng tổng');
    expect(screen.getByTestId('rule-row-0')).toHaveTextContent('D10');
    expect(screen.getByTestId('rule-row-0')).toHaveTextContent('D11+D12');
    // Draft cleared.
    expect(screen.getByTestId('input-rule-name')).toHaveValue('');
    expect(screen.getByTestId('btn-add-rule')).toBeDisabled();

    fireEvent.click(screen.getByTestId('btn-rules-next'));
    expect(onNext).toHaveBeenCalledWith([
      {
        name: 'D10 bằng tổng',
        leftExpr: 'D10',
        operator: 'EQ',
        rightExpr: 'D11+D12',
        severity: 'ERROR',
        message: 'D10 không khớp',
      },
    ]);
  });

  it('removes a rule from the list', () => {
    render(<ReportRulesStep onBack={() => {}} onNext={() => {}} />);
    fireEvent.change(screen.getByTestId('input-rule-name'), { target: { value: 'R1' } });
    fireEvent.change(screen.getByTestId('input-rule-left'), { target: { value: 'D10' } });
    fireEvent.change(screen.getByTestId('input-rule-right'), { target: { value: 'D11' } });
    fireEvent.change(screen.getByTestId('input-rule-message'), { target: { value: 'm' } });
    fireEvent.click(screen.getByTestId('btn-add-rule'));
    expect(screen.getByTestId('rule-row-0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-remove-rule-0'));

    expect(screen.queryByTestId('rule-row-0')).not.toBeInTheDocument();
  });

  it('"Quay lại" calls onBack', () => {
    const onBack = vi.fn();
    render(<ReportRulesStep onBack={onBack} onNext={() => {}} />);

    fireEvent.click(screen.getByText('Quay lại'));

    expect(onBack).toHaveBeenCalled();
  });

  describe('suggestions from the template', () => {
    const IF_RULE = {
      sheetKey: 'Đội 3',
      address: 'G10',
      name: "'Đội 3'!G10: D10 = D11+D12",
      leftExpr: "'Đội 3'!D10",
      operator: 'EQ' as const,
      rightExpr: "'Đội 3'!D11+'Đội 3'!D12",
      message: 'Kiểm tra ô G10 không đạt.',
      origin: 'IF_FORMULA' as const,
    };
    const DV_RULE = {
      sheetKey: 'A09',
      address: 'Q51',
      name: 'Q51 <= Q50',
      leftExpr: 'A09!Q51',
      operator: 'LTE' as const,
      rightExpr: 'A09!Q50',
      message: 'Số bị can khởi tố không vượt quá số đã xác minh',
      origin: 'DATA_VALIDATION' as const,
    };

    it('offers each suggestion and turns the chosen one into a rule with the right severity', () => {
      const onNext = vi.fn();
      render(<ReportRulesStep onBack={() => {}} onNext={onNext} suggestions={[IF_RULE, DV_RULE]} />);
      expect(screen.getByTestId('rule-suggestions')).toHaveTextContent('Gợi ý từ file mẫu (2)');

      fireEvent.click(screen.getByTestId(`btn-use-suggestion-${DV_RULE.name}`));
      fireEvent.click(screen.getByTestId(`btn-use-suggestion-${IF_RULE.name}`));
      fireEvent.click(screen.getByTestId('btn-rules-next'));

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({
          name: DV_RULE.name,
          leftExpr: 'A09!Q51',
          operator: 'LTE',
          rightExpr: 'A09!Q50',
          severity: 'ERROR', // Excel stops an officer at its own data validation
          message: DV_RULE.message,
        }),
        expect.objectContaining({ name: IF_RULE.name, operator: 'EQ', severity: 'WARNING' }),
      ]);
    });

    it('a used suggestion is not offered again', () => {
      render(<ReportRulesStep onBack={() => {}} onNext={() => {}} suggestions={[IF_RULE]} />);
      fireEvent.click(screen.getByTestId(`btn-use-suggestion-${IF_RULE.name}`));
      expect(screen.queryByTestId('rule-suggestions')).not.toBeInTheDocument();
      expect(screen.getByTestId('rule-row-0')).toBeInTheDocument();
    });

    it('shows nothing when the template suggests nothing', () => {
      render(<ReportRulesStep onBack={() => {}} onNext={() => {}} />);
      expect(screen.queryByTestId('rule-suggestions')).not.toBeInTheDocument();
    });
  });
});

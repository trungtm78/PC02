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
});

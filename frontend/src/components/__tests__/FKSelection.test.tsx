import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FKSelection } from '../FKSelection';
import { authStore } from '@/stores/auth.store';

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(),
  },
}));

const mockOptions = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
];

describe('FKSelection', () => {
  const mockOnChange = vi.fn();
  const mockOnCreateNew = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authStore.getUser).mockReturnValue({ email: 'admin@test.com', role: 'admin' });
  });

  it('should render FKSelection with label', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
      />
    );
    
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('should render with placeholder text', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        placeholder="Select an option"
      />
    );
    
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('should display selected option label', () => {
    render(
      <FKSelection
        label="Test Label"
        value="2"
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
      />
    );
    
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('should open dropdown when clicking trigger', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    expect(screen.getByTestId('fk-select-dropdown')).toBeInTheDocument();
  });

  it('should show search input in dropdown', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    expect(screen.getByTestId('fk-select-search')).toBeInTheDocument();
  });

  it('should filter options when typing in search', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    const searchInput = screen.getByTestId('fk-select-search');
    fireEvent.change(searchInput, { target: { value: 'Option 1' } });
    
    expect(screen.getByTestId('fk-select-option-1')).toBeInTheDocument();
  });

  it('should call onChange when selecting an option', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    fireEvent.click(screen.getByTestId('fk-select-option-2'));
    
    expect(mockOnChange).toHaveBeenCalledWith('2');
  });

  it('should show create new button when user has permission', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        onCreateNew={mockOnCreateNew}
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    expect(screen.getByTestId('fk-select-create-new')).toBeInTheDocument();
  });

  it('should call onCreateNew when clicking create button', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        onCreateNew={mockOnCreateNew}
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    fireEvent.click(screen.getByTestId('fk-select-create-new'));
    
    expect(mockOnCreateNew).toHaveBeenCalled();
  });

  it('should NOT show create new button when onCreateNew is not provided', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    expect(screen.queryByTestId('fk-select-create-new')).not.toBeInTheDocument();
  });

  it('should show required asterisk when required prop is true', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        required
      />
    );
    
    expect(screen.getByText('*')).toHaveClass('text-red-500');
  });

  it('should show error message when error prop is provided', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        error="This field is required"
      />
    );
    
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should clear selection when clicking clear button', () => {
    render(
      <FKSelection
        label="Test Label"
        value="2"
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-clear'));
    
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('should show loading state when loading prop is true', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        loading
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('should show "no results" message when search has no matches', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    const searchInput = screen.getByTestId('fk-select-search');
    fireEvent.change(searchInput, { target: { value: 'NonExistentOption' } });
    
    expect(screen.getByText('Không tìm thấy kết quả')).toBeInTheDocument();
  });

  it('should suggest create new when search has no matches and user has permission', () => {
    render(
      <FKSelection
        label="Test Label"
        value=""
        onChange={mockOnChange}
        options={mockOptions}
        resource="cases"
        onCreateNew={mockOnCreateNew}
        testId="fk-select"
      />
    );
    
    fireEvent.click(screen.getByTestId('fk-select-trigger'));
    
    const searchInput = screen.getByTestId('fk-select-search');
    fireEvent.change(searchInput, { target: { value: 'NewOption' } });
    
    expect(screen.getByTestId('fk-select-create-suggestion')).toBeInTheDocument();
  });
});

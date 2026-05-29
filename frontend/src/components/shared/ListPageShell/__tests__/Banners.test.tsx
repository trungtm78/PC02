import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { AlertBanners, TransientBanners } from '../Banners';

describe('<ListPageShell.AlertBanners>', () => {
  it('render children trong region với role=region', () => {
    render(
      <ListPageShell>
        <AlertBanners>
          <div data-testid="overdue-banner">Có 5 vụ quá hạn</div>
        </AlertBanners>
      </ListPageShell>,
    );
    expect(screen.getByTestId('overdue-banner')).toBeInTheDocument();
  });

  it('container có data-testid + aria-label "Cảnh báo"', () => {
    render(
      <ListPageShell>
        <AlertBanners>
          <div>x</div>
        </AlertBanners>
      </ListPageShell>,
    );
    const region = screen.getByTestId('list-page-shell-alert-banners');
    expect(region).toHaveAttribute('aria-label', 'Cảnh báo');
  });

  it('không render container khi không có children', () => {
    render(
      <ListPageShell>
        <AlertBanners>{null}</AlertBanners>
      </ListPageShell>,
    );
    expect(screen.queryByTestId('list-page-shell-alert-banners')).not.toBeInTheDocument();
  });
});

describe('<ListPageShell.TransientBanners>', () => {
  it('render children với aria-live=polite (toast announcement)', () => {
    render(
      <ListPageShell>
        <TransientBanners>
          <div data-testid="success-toast">Đã xoá 5 mục</div>
        </TransientBanners>
      </ListPageShell>,
    );
    const region = screen.getByTestId('list-page-shell-transient-banners');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('success-toast')).toBeInTheDocument();
  });

  it('không render container khi không có children', () => {
    render(
      <ListPageShell>
        <TransientBanners>{null}</TransientBanners>
      </ListPageShell>,
    );
    expect(screen.queryByTestId('list-page-shell-transient-banners')).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { renderUyThacDieuTraRoutes } from '../routes';

function Destination() {
  const location = useLocation();
  return <p data-testid="destination">{location.pathname}{location.search}</p>;
}

function renderRedirect(initialEntry: string) {
  const router = createMemoryRouter(
    createRoutesFromElements(
      <>
        {renderUyThacDieuTraRoutes()}
        <Route path="/cases/new" element={<Destination />} />
        <Route path="/cases/:id/edit" element={<Destination />} />
      </>,
    ),
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
}

describe('Uy thac dieu tra routes', () => {
  it('keeps the list route', () => {
    expect(renderUyThacDieuTraRoutes().map((route) => (route.props as { path?: string }).path)).toContain('/uy-thac-dieu-tra');
  });

  it('redirects new records to the case form with investigation provenance', async () => {
    renderRedirect('/uy-thac-dieu-tra/new');
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      '/cases/new?caseProvenance=UY_THAC_DIEU_TRA&returnPath=/uy-thac-dieu-tra',
    );
  });

  it('preserves the record id and investigation provenance when editing', async () => {
    renderRedirect('/uy-thac-dieu-tra/record-42/edit');
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      '/cases/record-42/edit?caseProvenance=UY_THAC_DIEU_TRA&returnPath=/uy-thac-dieu-tra',
    );
  });
});

import { createContext, useContext } from 'react';
import type { ExportEntity } from '@/features/document-templates/export.api';

export interface PrintDocumentsModalArgs {
  entity: ExportEntity;
  entityId: string;
  onPatched?: () => void;
}

export interface PrintDocumentsModalApi {
  open: (args: PrintDocumentsModalArgs) => void;
}

export const PrintDocumentsModalContext = createContext<PrintDocumentsModalApi | null>(null);

export function usePrintDocumentsModal(): PrintDocumentsModalApi {
  const context = useContext(PrintDocumentsModalContext);
  if (!context) throw new Error('usePrintDocumentsModal must be used inside <PrintDocumentsModalProvider>');
  return context;
}

import { createContext, useContext } from 'react';

export type DeleteResourceType =
  | 'cases'
  | 'incidents'
  | 'petitions'
  | 'lawyers'
  | 'subjects'
  | 'document-templates';

export interface DeleteResourceArgs {
  resourceType: DeleteResourceType;
  recordId: string;
  recordLabel?: string;
  onSuccess?: () => void;
}

export interface DeleteResourceModalApi {
  open: (args: DeleteResourceArgs) => void;
}

export const DeleteResourceContext = createContext<DeleteResourceModalApi | null>(null);

export function useDeleteResourceModal(): DeleteResourceModalApi {
  const context = useContext(DeleteResourceContext);
  if (!context) {
    throw new Error('useDeleteResourceModal must be used inside <DeleteResourceModalProvider>');
  }
  return context;
}

export function useDeleteResourceModalSafe(): DeleteResourceModalApi | null {
  return useContext(DeleteResourceContext);
}

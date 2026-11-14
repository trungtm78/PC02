import { FKSelect } from "@/components/FKSelect";
import { useQuickCreateDirectoryModalSafe } from "@/features/_shared/modals/useQuickCreateDirectoryModal";
import { usePermission } from "@/hooks/usePermission";

/** Directory type shared with the Petition and Incident forms. */
const DIRECTORY_TYPE = "LOAI_THONG_TIN";

interface Props {
  label: string;
  value: string;
  onChange: (name: string) => void;
}

/**
 * "Loai thong tin" on the Case form: the same catalogue picker the Petition and Incident forms
 * use, with the same quick-create.
 *
 * One component for BOTH places that write `loaiThongTin` (tab Info and its mirror on tab
 * Uy thac), so the two cannot drift into different inputs for one stored column.
 *
 * The picker's value is the catalogue NAME. A stored value that is not in the catalogue (raw
 * text typed before this field became a picker) is still shown and is left untouched until the
 * officer picks something else: `FKSelect` uses the value itself as the label for a
 * `directoryType` picker and never calls `onChange` on its own.
 *
 * Read-only: `FKSelect` locks itself under `CheDoXemProvider`; under the `<fieldset disabled>`
 * CaseFormPage uses, every control that could change the value is a disabled control.
 */
export function LoaiThongTinPicker({ label, value, onChange }: Props) {
  const quickCreate = useQuickCreateDirectoryModalSafe();
  const { canCreate, canEdit } = usePermission();
  // Same rule as the other quick-create pickers on this form (see `TabInfo`).
  const canQuickCreate = Boolean(
    quickCreate && (
      canCreate("cases") || canEdit("cases") ||
      canCreate("petitions") || canEdit("petitions")
    ),
  );
  return (
    <FKSelect
      label={label}
      directoryType={DIRECTORY_TYPE}
      value={value ?? ""}
      onChange={onChange}
      placeholder="Gõ để tìm, không có thì nhấn Enter để tạo mới"
      testId="field-loaiThongTin"
      canCreate={canQuickCreate}
      onCreateNew={(suggestedName) =>
        quickCreate?.open({
          type: DIRECTORY_TYPE,
          tenGoiY: suggestedName,
          onCreated: onChange,
        })
      }
    />
  );
}

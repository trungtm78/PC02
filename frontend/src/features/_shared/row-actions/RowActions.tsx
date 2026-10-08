import { useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { ActionMenuPortal } from '@/components/ActionMenuPortal';
import { BangThaoTacDuoi } from '@/components/BangThaoTacDuoi';
import { useDienThoai } from '@/hooks/useMediaQuery';
import { BTN_ICON_BLUE, BTN_ICON_SLATE, BTN_ICON_RED } from '@/constants/styles';
import type { ActionContext, RowActionRegistry, RowAction } from './registry';

interface RowActionsProps<TRow extends { id: string }> {
  registry: RowActionRegistry<TRow>;
  row: TRow;
  ctx: ActionContext;
  /** Tiêu đề bảng thao tác trên điện thoại (vd mã hồ sơ). Không truyền = "Thao tác". */
  tieuDe?: string;
}

/**
 * v0.62 PR1a — Smart row-actions component.
 *
 * Reads action registry + applies visible/disabled guards per row + ctx.
 * Renders inline icon buttons + (if any menu items) ⋮ kebab opening
 * ActionMenuPortal with keyboard-nav menu items.
 *
 * All button clicks stopPropagation to prevent row navigation.
 */
export function RowActions<TRow extends { id: string }>({
  registry,
  row,
  ctx,
  tieuDe,
}: RowActionsProps<TRow>) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [bangMo, setBangMo] = useState(false);
  // Đóng bảng vì chọn một thao tác (có thể mở hộp thoại) thì KHÔNG trả tiêu điểm về nút ⋮ — xem `traTieuDiem`.
  const [traTieuDiem, setTraTieuDiem] = useState(true);
  const nutBangRef = useRef<HTMLButtonElement | null>(null);
  const dienThoai = useDienThoai();
  // Xoay màn hình / đổi cỡ cửa sổ qua ngưỡng 767px: dựng lại nhánh khác thì bảng/menu đang mở phải ĐÓNG hẳn. Giữ cờ mở
  // thì xoay ngang rồi xoay dọc lại làm bảng tự bật lên không ai bấm (Codex bắt 08/10/2026). Đặt lại ngay lúc dựng (không
  // dùng effect) để không có khung hình nào còn cờ cũ.
  const [dienThoaiTruoc, setDienThoaiTruoc] = useState(dienThoai);
  if (dienThoaiTruoc !== dienThoai) {
    setDienThoaiTruoc(dienThoai);
    setBangMo(false);
    setMenuAnchor(null);
  }

  const visible = registry.all().filter((a) => (a.visible ? a.visible(row, ctx) : true));
  const inline = visible.filter((a) => a.position === 'inline');
  const menu = visible.filter((a) => a.position === 'menu');

  // Điện thoại (≤767px): cột Thao tác chỉ còn MỘT nút ⋮ cỡ 32px (anh yêu cầu thu nhỏ 08/10/2026; WCAG 2.2 AA đòi tối thiểu 24px); mọi thao tác nằm trong bảng trượt từ đáy.
  // Thứ tự: thao tác thường (nhanh rồi phụ) │ nguy hiểm (xoá) ở cuối, cách bằng đường kẻ.
  if (dienThoai) {
    if (visible.length === 0) return null;
    const thuong = [...inline, ...menu].filter((a) => !a.danger);
    const nguyHiem = [...inline, ...menu].filter((a) => a.danger);
    return (
      <div className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
        <button
          ref={nutBangRef}
          type="button"
          data-testid={`btn-action-menu-${row.id}`}
          title="Thao tác"
          aria-label="Thao tác"
          aria-haspopup="dialog"
          aria-expanded={bangMo}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setTraTieuDiem(true);
            setBangMo(true);
          }}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        <BangThaoTacDuoi mo={bangMo} onDong={() => setBangMo(false)} tieuDe={tieuDe ?? 'Thao tác'} nutMo={nutBangRef} traTieuDiem={traTieuDiem}>
          {thuong.map((action) => (
            <MucBangDuoi
              key={action.key}
              action={action}
              row={row}
              ctx={ctx}
              onAfterExecute={() => {
                setTraTieuDiem(false);
                setBangMo(false);
              }}
            />
          ))}
          {nguyHiem.length > 0 && thuong.length > 0 && <hr className="my-1 border-slate-100" />}
          {nguyHiem.map((action) => (
            <MucBangDuoi
              key={action.key}
              action={action}
              row={row}
              ctx={ctx}
              onAfterExecute={() => {
                setTraTieuDiem(false);
                setBangMo(false);
              }}
            />
          ))}
        </BangThaoTacDuoi>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {inline.map((action) => (
        <InlineButton key={action.key} action={action} row={row} ctx={ctx} />
      ))}
      {menu.length > 0 && (
        <>
          <button
            type="button"
            data-testid={`btn-action-menu-${row.id}`}
            title="Thao tác khác"
            aria-label="Thao tác khác"
            className={BTN_ICON_SLATE}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(menuAnchor ? null : e.currentTarget);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          <ActionMenuPortal
            anchor={menuAnchor}
            open={menuAnchor !== null}
            onClose={() => setMenuAnchor(null)}
            align="left"
          >
            {menu.map((action) => (
              <MenuItem
                key={action.key}
                action={action}
                row={row}
                ctx={ctx}
                onAfterExecute={() => setMenuAnchor(null)}
              />
            ))}
          </ActionMenuPortal>
        </>
      )}
    </div>
  );
}

interface ActionItemProps<TRow extends { id: string }> {
  action: RowAction<TRow>;
  row: TRow;
  ctx: ActionContext;
}

function InlineButton<TRow extends { id: string }>({
  action,
  row,
  ctx,
}: ActionItemProps<TRow>) {
  const Icon = action.icon;
  const disabledReason = action.disabled ? action.disabled(row, ctx) : null;
  const colorClass = action.danger ? BTN_ICON_RED : BTN_ICON_BLUE;
  return (
    <button
      type="button"
      data-testid={`${action.testid}-${row.id}`}
      title={disabledReason ?? action.label}
      aria-label={action.label}
      disabled={disabledReason != null}
      className={colorClass}
      onClick={(e) => {
        e.stopPropagation();
        if (disabledReason) return;
        action.execute(row, ctx);
      }}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

interface MenuItemProps<TRow extends { id: string }> extends ActionItemProps<TRow> {
  onAfterExecute: () => void;
}

function MenuItem<TRow extends { id: string }>({
  action,
  row,
  ctx,
  onAfterExecute,
}: MenuItemProps<TRow>) {
  const Icon = action.icon;
  const disabledReason = action.disabled ? action.disabled(row, ctx) : null;
  const baseClass =
    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  const stateClass = disabledReason
    ? 'text-slate-400 cursor-not-allowed'
    : action.danger
      ? 'text-red-700 hover:bg-red-50'
      : 'text-slate-700 hover:bg-slate-100';
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={`${action.testid}-${row.id}`}
      title={disabledReason ?? action.label}
      disabled={disabledReason != null}
      className={`${baseClass} ${stateClass}`}
      onClick={(e) => {
        e.stopPropagation();
        if (disabledReason) return;
        action.execute(row, ctx);
        onAfterExecute();
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{action.label}</span>
    </button>
  );
}

/** Mục của bảng thao tác đáy: cao 48px; mục bị khoá vẫn hiện, kèm LÝ DO ngay dưới nhãn (không chỉ tooltip — điện thoại không có hover). */
function MucBangDuoi<TRow extends { id: string }>({
  action,
  row,
  ctx,
  onAfterExecute,
}: MenuItemProps<TRow>) {
  const Icon = action.icon;
  const disabledReason = action.disabled ? action.disabled(row, ctx) : null;
  const mau = disabledReason
    ? 'text-slate-400 cursor-not-allowed'
    : action.danger
      ? 'text-red-700 active:bg-red-50'
      : 'text-slate-800 active:bg-slate-100';
  return (
    <button
      type="button"
      data-testid={`${action.testid}-${row.id}`}
      aria-disabled={disabledReason != null || undefined}
      disabled={disabledReason != null}
      className={`flex w-full min-h-12 items-center gap-3 px-4 py-2 text-left text-sm focus:outline-none focus-visible:bg-slate-100 ${mau}`}
      onClick={(e) => {
        e.stopPropagation();
        if (disabledReason) return;
        action.execute(row, ctx);
        onAfterExecute();
      }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex flex-col">
        <span>{action.label}</span>
        {disabledReason && <span className="text-xs font-normal text-slate-500">{disabledReason}</span>}
      </span>
    </button>
  );
}

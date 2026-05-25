# DESIGN.md — PC02 Case Management Design System

> Vietnamese police case management system UI guidelines. Reference this before building any new component.

---

## 1. Design Tokens (Tailwind v4 CSS Custom Properties)

Source: `frontend/src/index.css`

```css
/* Brand palette */
--primary:        #003973;   /* Xanh Công An — primary action, sidebar, headers */
--primary-light:  #0052a3;   /* Hover states, sidebar active */
--secondary:      #DC2626;   /* Danger, delete, overdue alerts */
--accent:         #F59E0B;   /* Star yellow, warnings, badges */
--accent-dark:    #D97706;   /* Accent hover */

/* Surfaces */
--background:     #F7F6F2;   /* Warm off-white page background */
--card:           #ffffff;   /* Card / panel background */
--muted:          #f1f5f9;   /* Subtle fills, disabled, code bg */
--muted-foreground: #64748b; /* Secondary text */
--foreground:     #1e293b;   /* Primary body text */
--border:         rgba(30,41,59,0.15); /* Dividers */

/* State */
--success:  #059669;
--warning:  #F59E0B;
--destructive: #DC2626;

/* Radius */
--radius: 0.375rem;  /* ~6px — default border-radius */

/* Sidebar */
--sidebar:           #003973;
--sidebar-foreground: #ffffff;
--sidebar-border:    rgba(255,255,255,0.1);
--sidebar-ring:      #F59E0B;
```

**Key rule:** Tailwind v4 — no `tailwind.config.js`. Colors defined via `@theme inline` in `index.css`. Use utility classes (`bg-blue-600`, `text-gray-700`, etc.) for one-off values; use CSS variables for brand colors.

---

## 2. Typography

| Role | Class | Notes |
|------|-------|-------|
| Page title | `text-lg font-semibold text-gray-800` | H1 equivalent |
| Section title | `text-base font-semibold text-gray-800` | Panel headers |
| Body | `text-sm text-gray-700` | Default prose |
| Secondary | `text-xs text-gray-500` | Metadata, timestamps |
| Code / ID | `text-xs font-mono text-gray-500` | STT codes (VV-2025-00001) |
| Muted italic | `text-xs text-gray-400 italic` | "Hệ thống", empty states |

Font stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (set globally on `:root`).

---

## 3. Entity Color System

Three entity types are color-coded consistently across all components:

| Entity | Background | Text | Border accent |
|--------|-----------|------|---------------|
| CASE (Vụ việc) | `bg-blue-100` | `text-blue-700` | `border-blue-500` |
| PETITION (Đơn thư) | `bg-violet-100` | `text-violet-700` | `border-violet-500` |
| INCIDENT (Vụ án) | `bg-orange-100` | `text-orange-700` | `border-orange-500` |

Icons from `lucide-react`: CASE=`<FileText>`, PETITION=`<Mail>`, INCIDENT=`<AlertTriangle>`.

These styles are established in `HoSoJourney.tsx` (`ENTITY_BADGE_STYLE`) and must be reused exactly.

---

## 4. Component Patterns

### 4.1 Badges / Chips

```tsx
// Entity badge (small inline)
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
  <FileText className="w-3 h-3" />
  Vụ việc
</span>

// Filter chip (toggle)
<button className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
  active
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
}`}>Tất cả</button>

// Status badge (small)
<span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
  Đang xác minh
</span>
```

### 4.2 Tree Navigator Item

Selected state uses left border accent + light blue fill:

```tsx
<div className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm transition-colors ${
  selected
    ? 'bg-blue-50 border-l-2 border-blue-600 text-blue-900 font-medium'
    : 'hover:bg-gray-50 text-gray-700 border-l-2 border-transparent'
}`}>
  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
  <div className="min-w-0 flex-1">
    <div className="text-xs text-gray-500 font-mono truncate">VV-2025-00001</div>
    <div className="text-sm truncate">Tên vụ việc</div>
  </div>
  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
    Đang xác minh
  </span>
</div>
```

### 4.3 Collapsible Group Header

```tsx
<button className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 rounded">
  <div className="flex items-center gap-2">
    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    <span>Vụ việc</span>
    <span className="bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">12</span>
  </div>
</button>
```

### 4.4 Timeline Event Card

```tsx
<div className="flex gap-3 pb-4 relative">
  {/* Timeline connector dot */}
  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-gray-400" />
  <div className="flex-1 min-w-0">
    <div className="flex flex-wrap items-center gap-2 mb-0.5">
      <EntityBadge />
      <span className="text-xs text-gray-500">01/01/2025 08:00</span>
      <span className="text-xs text-gray-600 font-medium">Nguyễn Văn A</span>
    </div>
    <span className="text-sm text-gray-800">Được tạo</span>
  </div>
</div>
```

Timeline container: `<div className="relative pl-3 border-l border-gray-200">`.

### 4.5 Deadline Banner

```tsx
// Overdue: bg-red-50 border-red-200 text-red-700
// Warning (≤7 days): bg-yellow-50 border-yellow-200 text-yellow-700
// OK: bg-green-50 border-green-200 text-green-700
<div className="flex items-center gap-2 px-3 py-2 rounded border mb-4 text-sm bg-red-50 border-red-200 text-red-700">
  <AlertCircle className="w-4 h-4 flex-shrink-0" />
  <span>Hạn xử lý: <strong>01/06/2026</strong> — Quá hạn 3 ngày</span>
</div>
```

### 4.6 Search Input

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
  <input
    type="text"
    placeholder="Tìm vụ việc, vụ án, đơn thư..."
    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
  />
</div>
```

### 4.7 Empty State

```tsx
<div className="text-center py-8">
  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
  <p className="text-sm text-gray-400">Chưa có sự kiện nào</p>
</div>
```

### 4.8 Loading Skeleton

```tsx
<div className="flex gap-3 animate-pulse">
  <div className="w-2 h-2 mt-2 rounded-full bg-gray-200" />
  <div className="flex-1 space-y-2">
    <div className="h-4 bg-gray-200 rounded w-1/3" />
    <div className="h-3 bg-gray-200 rounded w-2/3" />
  </div>
</div>
```

---

## 5. Layout — HoSo Journey Page (`/ho-so-journey`)

```
┌──────────────────────────────────────────────────────────────┐
│ Sidebar (240px, --sidebar: #003973)                          │
├──────────────────┬───────────────────────────────────────────┤
│ Navigator (320px)│  Timeline panel (flex-1)                  │
│ fixed, scrollable│  scrollable                               │
│                  │                                           │
│ [Search input]   │  Entity title + filter chips              │
│ [Filter chips]   │  Deadline banner                          │
│                  │  ─────────────────────────────            │
│ ▼ Vụ việc (12)  │  ● Event row                              │
│   item ...       │  ● Event row                              │
│   item (selected)│  ● Event row                              │
│ ▼ Vụ án (3)     │                                           │
│ ▶ Đơn thư (8)   │  [Tải thêm]                              │
│                  │                                           │
│ [Tải thêm...]   │  ← empty state: "Chọn hồ sơ bên trái"   │
└──────────────────┴───────────────────────────────────────────┘
```

Container structure:
```tsx
<div className="flex h-screen overflow-hidden bg-[var(--background)]">
  {/* Left navigator */}
  <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
    {/* Search */}
    {/* Filter chips */}
    {/* Tree groups (scrollable) */}
    <div className="flex-1 overflow-y-auto">...</div>
  </div>
  {/* Right timeline */}
  <div className="flex-1 overflow-y-auto p-6">...</div>
</div>
```

---

## 6. Icon Library

Icons from `lucide-react` only. Common icons used in this system:

| Icon | Usage |
|------|-------|
| `FileText` | Case (Vụ việc) entity |
| `Mail` | Petition (Đơn thư) entity |
| `AlertTriangle` | Incident (Vụ án) entity |
| `GitBranch` | Hành trình hồ sơ sidebar menu |
| `Search` | Search input |
| `ChevronDown` / `ChevronRight` | Collapsible toggle |
| `Clock` | Empty state, timeline |
| `AlertCircle` | Deadline banner, error state |
| `RefreshCw` | Retry button |
| `Copy` | Share/copy link |
| `Printer` | Print |
| `X` | Clear search |

---

## 7. Vietnamese Locale

- Dates: `date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })`
- Relative: "Còn X ngày" / "Quá hạn X ngày"
- Actor fallback: `'Hệ thống'` (italic, gray-400)
- Status labels: import from `frontend/src/shared/enums/status-labels.ts`

---

## 8. Journey Navigator — Wireframe Reference

Interactive prototype: `frontend/public/journey-wireframe.html`

Key UX decisions locked in wireframe:
1. **URL state**: `/ho-so-journey?type=CASE&id=case-001` for shareable links
2. **Search mode**: query clears grouped tree → shows flat search results list
3. **No-selection state**: right panel shows "Chọn một hồ sơ từ danh sách bên trái" placeholder
4. **Infinite scroll**: each group loads 20 more items when scrolled to bottom
5. **Entity isolation**: clicking a Petition item loads petition-only timeline, NOT the parent case timeline

---

## 9. Reusable Components

| Component | File | Notes |
|-----------|------|-------|
| `HoSoJourney` | `frontend/src/components/HoSoJourney/HoSoJourney.tsx` | Right-panel timeline; to be refactored to accept `entityType`+`entityId` |
| `useCaseJourney` | `frontend/src/components/HoSoJourney/useCaseJourney.ts` | Template for new petition/incident hooks |
| `EntityBadge` | inside `HoSoJourney.tsx` | Inline — extract if reused elsewhere |
| `AppSidebar` | `frontend/src/components/AppSidebar.tsx` | Add `GitBranch` menu item for this page |

---

## 10. Document Number Engine — v0.42

### 10.1 Design Tokens (thêm vào `@theme` block trong `frontend/src/index.css`)

```css
/* Document Number Engine */
--docnum-auto-bg:         #dcfce7;   /* AUTO badge background */
--docnum-auto-text:       #166534;   /* AUTO badge text */
--docnum-override-bg:     #fef3c7;   /* AUTO_WITH_OVERRIDE override mode bg */
--docnum-override-border: #fcd34d;   /* Override mode focus border */
--docnum-override-text:   #92400e;   /* Override mode warning text */

/* Segment type badges */
--segment-literal-bg:     #dbeafe;   /* LITERAL segment badge */
--segment-literal-text:   #1d4ed8;
--segment-formula-bg:     #fef9c3;   /* FORMULA segment badge */
--segment-formula-text:   #a16207;
--segment-counter-bg:     #f0fdf4;   /* COUNTER segment badge */
--segment-counter-text:   #15803d;
```

### 10.2 `DocNumberPreviewField` Component

File: `frontend/src/components/DocNumberPreviewField.tsx`

```tsx
// AUTO mode — readonly với badge
<div className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 bg-gray-50">
  <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
  <span className="text-sm font-mono text-gray-800 flex-1">VV-2026-00043</span>
  <span className="text-xs px-1.5 py-0.5 rounded font-medium"
        style={{ background: 'var(--docnum-auto-bg)', color: 'var(--docnum-auto-text)' }}>
    Tự động
  </span>
</div>

// AUTO_WITH_OVERRIDE — có nút unlock
<div className="flex items-center gap-2">
  <div className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 bg-gray-50 flex-1">
    <Lock className="w-3.5 h-3.5 text-gray-400" />
    <span className="text-sm font-mono text-gray-800 flex-1">VC-2026-001</span>
    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
          style={{ background: 'var(--docnum-auto-bg)', color: 'var(--docnum-auto-text)' }}>
      Tự động
    </span>
  </div>
  <button className="flex items-center gap-1 px-2 py-2 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-50">
    <Pencil className="w-3 h-3" /> Nhập tay
  </button>
</div>

// AUTO_WITH_OVERRIDE — sau khi unlock
<div className="flex items-center gap-2 px-3 py-2 rounded border bg-amber-50"
     style={{ borderColor: 'var(--docnum-override-border)' }}>
  <Unlock className="w-3.5 h-3.5" style={{ color: 'var(--docnum-override-text)' }} />
  <input type="text" className="flex-1 text-sm font-mono bg-transparent outline-none" />
</div>
```

### 10.3 Segment Builder Badge Styles

```tsx
// LITERAL segment badge
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: 'var(--segment-literal-bg)', color: 'var(--segment-literal-text)' }}>
  Văn bản cố định
</span>

// FORMULA segment badge
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: 'var(--segment-formula-bg)', color: 'var(--segment-formula-text)' }}>
  Công thức
</span>

// COUNTER segment badge
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: 'var(--segment-counter-bg)', color: 'var(--segment-counter-text)' }}>
  Số tự tăng
</span>
```

### 10.4 Segment Preview Bar

```tsx
<div className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-100 mt-3">
  <span className="text-xs text-blue-600 font-medium flex-shrink-0">Preview:</span>
  <code className="text-sm font-mono text-blue-800">VV-2026-00001</code>
</div>
```

### 10.5 inputMode Badge Styles (Settings table)

| inputMode | Tailwind classes |
|-----------|-----------------|
| `AUTO` | `text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700` |
| `MANUAL` | `text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600` |
| `AUTO_WITH_OVERRIDE` | `text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700` |

# PC02 Case Management System

Hệ thống quản lý vụ án, đơn thư và đối tượng liên quan cho đơn vị PC02.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 5 + Tailwind CSS 4 + Vite |
| Backend | NestJS + TypeScript + Prisma ORM |
| Database | PostgreSQL |
| Testing | Jest (Backend Unit), Playwright (E2E) |

## Tính năng chính

- **Quản lý Hồ sơ vụ án** (Cases) - CRUD, phân công điều tra viên, theo dõi trạng thái, timeline
- **Quản lý Đơn thư** (Petitions) - tiếp nhận, xử lý, chuyển đổi thành vụ án/vụ việc
- **Quản lý Vụ việc** (Incidents) - theo dõi sự kiện, phân loại
- **Tự động tạo Đơn thư** khi tạo Hồ sơ có loại đơn thư, đồng bộ 2 chiều
- **Quản lý Đối tượng** (Subjects) - bị can, nhân chứng, thông tin cá nhân
- **Quản lý Luật sư** (Lawyers) - thông tin, phân công cho bị can
- **Danh mục phân loại** (MasterClass) - quản lý danh mục dùng chung
- **Quản lý tài liệu** (Documents) - đính kèm hồ sơ
- **Kiểm toán** (Audit) - ghi log mọi thao tác
- **Phân quyền** - JWT authentication, role-based access

## Cài đặt

### Yêu cầu
- Node.js >= 18
- PostgreSQL >= 14
- npm hoặc yarn

### Backend

```bash
cd backend
npm install
cp .env.example .env   # Cấu hình DATABASE_URL, JWT_SECRET
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

Backend chạy tại: `http://localhost:3000/api/v1`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại: `http://localhost:5173`

## Cấu trúc dự án

```
pc02-case-management/
├── backend/
│   └── src/
│       ├── admin/          # Quản trị hệ thống
│       ├── audit/          # Ghi log kiểm toán
│       ├── auth/           # Xác thực JWT
│       ├── cases/          # Quản lý hồ sơ vụ án
│       ├── conclusions/    # Kết luận điều tra
│       ├── delegations/    # Ủy thác điều tra
│       ├── directory/      # Danh mục dữ liệu
│       ├── documents/      # Tài liệu đính kèm
│       ├── incidents/      # Quản lý vụ việc
│       ├── lawyers/        # Quản lý luật sư
│       ├── petitions/      # Quản lý đơn thư
│       ├── subjects/       # Quản lý đối tượng
│       └── prisma/         # Schema + migrations
├── frontend/
│   └── src/
│       ├── components/     # Components dùng chung
│       ├── pages/          # Các trang (cases, petitions, incidents...)
│       ├── layouts/        # Layout chính
│       ├── lib/            # API client, utilities
│       └── constants/      # Hằng số, styles
├── docs/                   # Tài liệu dự án
└── CLAUDE.md               # Hướng dẫn cho AI assistant
```

## Testing

```bash
# Backend unit tests (223 tests, 11 suites)
cd backend && npx jest --no-coverage

# Chạy test cụ thể
cd backend && npx jest cases.service.spec
cd backend && npx jest petitions.service.spec
```

## API Endpoints chính

| Module | Endpoint | Mô tả |
|--------|----------|-------|
| Cases | `GET/POST /api/v1/cases` | Danh sách / Tạo hồ sơ |
| Cases | `GET/PUT/DELETE /api/v1/cases/:id` | Chi tiết / Sửa / Xóa |
| Petitions | `GET/POST /api/v1/petitions` | Danh sách / Tạo đơn thư |
| Petitions | `POST /api/v1/petitions/:id/convert-case` | Chuyển đơn thư thành vụ án |
| Incidents | `GET/POST /api/v1/incidents` | Danh sách / Tạo vụ việc |
| Subjects | `GET/POST /api/v1/subjects` | Danh sách / Tạo đối tượng |
| Lawyers | `GET/POST /api/v1/lawyers` | Danh sách / Tạo luật sư |
| Auth | `POST /api/v1/auth/login` | Đăng nhập |
| Health | `GET /api/v1/health` | Kiểm tra trạng thái |

## License

Private - Internal use only.

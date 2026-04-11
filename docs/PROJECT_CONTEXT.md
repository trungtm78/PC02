# PROJECT_CONTEXT.md — PC02 Case Management

**Path**: docs/PROJECT_CONTEXT.md  
**Version**: v1.0.0  
**TASK_ID**: TASK-2026-022601  
**EXECUTION_ID**: INTAKE-20260226-001-7F3A  
**Last Updated**: 2026-02-26

---

## 1. Project Overview

**Project Name**: PC02 Case Management System  
**Description**: Hệ thống quản lý vụ án, đơn thư và đối tượng liên quan cho đơn vị PC02  
**Tech Stack**: 
- Frontend: React 19 + TypeScript 5 + Tailwind CSS 4 + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- Testing: Vitest (Unit), Playwright (E2E/UAT)

---

## 2. Environment Configuration

### Development URLs
```
Frontend Dev: http://localhost:5173
Backend API:  http://localhost:3000/api/v1
```

### Test Credentials
```
BASE_URL: http://localhost:5173
TEST_USER: test@pc02.gov.vn
TEST_PASS: Test@123456
```

> **SECURITY NOTICE**: Credentials are for local development/testing only. Never commit production credentials.

---

## 3. Project Structure

```
pc02-case-management/
├── docs/
│   ├── specs/
│   │   ├── FRD.md
│   │   ├── API_Specs.md
│   │   └── System-UI_Specs.md
│   ├── user-manual/
│   └── PROJECT_CONTEXT.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── stores/
│   │   └── constants/
│   ├── tests/
│   │   ├── e2e/
│   │   └── uat/
│   └── package.json
└── backend/
    └── src/
```

---

## 4. Design System

### Colors
- **Navy (Primary)**: `#1B2B4E`
- **Gold (Accent)**: `#D4AF37`
- **Slate (Neutral)**: `#64748B`

### Typography
- Font: System default (sans-serif)
- Scale: Tailwind defaults

### Icons
- Library: Lucide React
- Size: 16px (sm), 20px (md), 24px (lg)

---

## 5. Testing Configuration

### Unit Tests (Vitest)
```bash
cd frontend
npm run test
```

### E2E Tests (Playwright)
```bash
cd frontend
npx playwright test
```

### Coverage Target
- Risk Level LOW: ≥ 80%
- Risk Level MEDIUM: ≥ 85%
- Risk Level HIGH: ≥ 90%
- Risk Level CRITICAL: ≥ 95%

---

## 6. Quality Gates

All implementations must pass:
1. ✅ Tool Readiness Check
2. ✅ E2E Pre-Commitment (skeleton tests)
3. ✅ UI Element Scan
4. ✅ Unit Tests
5. ✅ Integration Tests
6. ✅ Code Review (Linter, Security, Clean Code)
7. ✅ Refactoring Gate
8. ✅ UAT with Screenshots
9. ✅ E2E Testing

---

## 7. Language Requirements

- **UI Labels/Messages**: Vietnamese (Tiếng Việt có dấu)
- **Code Comments**: English
- **Documentation**: Mixed (Vietnamese for user-facing, English for technical)

---

## 8. API Base Path

```
All API calls: /api/v1
Example: GET /api/v1/cases
```

---

## 9. Mock Data Strategy

For OUT_OF_SCOPE API implementations:
- Use mock data based on API_Specs.md interfaces
- Store in `frontend/src/lib/mockData.ts`
- Enable/disable via environment variable: `VITE_USE_MOCK=true`

---

## 10 thông tin login vào hệ thống tham khảo
https://pc02hcm.com/
user: thanhhoai
pwd:111111

**End of PROJECT_CONTEXT.md**

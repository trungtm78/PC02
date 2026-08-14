# tests/e2e-new

End-to-end specs that run in CI, kept separate from the 182 legacy specs under
`tests/e2e`, `tests/api` and `tests/uat-auto`.

## Why a separate directory

The legacy suite cannot be switched on as-is:

- `tests/uat-auto` (113 files, ~781 cases) asserts
  `expect([200, 201, 401, 403, 404]).toContain(res.status())` — a 401 or a 404
  passes, so a broken deployment scores green.
- `tests/api/cases-uat.api.spec.ts:70` calls `test.skip()` from the catch block
  around a network error, which turns "backend is down" into "test skipped".
- Several specs have rotted against the current UI: `objects-routing.e2e.spec.ts`
  uses port 5173 (config says 5179), `input[type="email"]` (the login field is
  `type="text"`) and testids that no longer exist.

Triaging that suite is worth doing, but it is its own task. Gating merges on it
today would gate them on noise.

## What belongs here

Specs for flows where a failure is silent and expensive — the class of bug unit
tests cannot see, because each piece works and only the seam is wrong:

| Flow | Why it needs a browser |
|---|---|
| Role permission matrix | The grid rendered all-false and Save persisted that. Every unit involved behaved correctly. |
| Sidebar for a non-admin | A feature-flag/manifest mismatch empties the menu for a whole role, with no error anywhere. |
| Evidence survives a case edit | The API returns 200 while the sub-entities are dropped. |
| Duplicate-petition decision | Must still be there after a reload. |
| Record return | Same — the modal used to report success and persist nothing. |
| Notification fan-out | Emitter and handler are tested separately; the wiring between them is not. |

## Running

This directory has no specs yet, and Playwright exits non-zero on a project
that matches nothing — hence `--pass-with-no-tests` below, and hence CI does
not run this project yet. Drop both once the first spec lands.

```bash
# against the local dev servers playwright.config.ts starts for you
npx playwright test --project=e2e-new --pass-with-no-tests

# against a deployed environment.
# UAT_PROD goes in the shell, not in the file: playwright.config.ts reads it to
# decide whether to load tests/.env.test at all.
cp tests/.env.test.example tests/.env.test   # then fill it in
UAT_PROD=1 npx playwright test --project=e2e-new --pass-with-no-tests
```

## Conventions

- One spec per flow, named after the flow, not the page.
- Reuse the page objects in `tests/pages/`.
- Assert on what the user ends up seeing, never on a status code alone — the
  legacy suite's central mistake.
- No credential or host defaults. Read them from the environment and fail loudly
  when they are missing.


## Trạng thái hiện tại (cập nhật)

**5 spec / 34 kiểm, tất cả xanh khi chạy tay.** Kết quả và bằng chứng:
[`UAT-COVERAGE.md`](../../UAT-COVERAGE.md).

| Spec | Nội dung | Cần gì để chạy |
|---|---|---|
| `uat-wave1-permission-matrix.api.spec.ts` | Ma trận phân quyền không rỗng | BE |
| `uat-wave2-security.api.spec.ts` | Mất dữ liệu im lặng, seed endpoint | BE |
| `uat-wave3-feature-flags.api.spec.ts` | Hạ tầng cờ, hình dạng lỗi | BE |
| `uat-wave5-edit-window.api.spec.ts` | Xin mở lại quyền sửa | BE |
| `uat-gate-all-flags.api.spec.ts` | **15 cờ E4/E5/E6 chặn thật** | BE |
| `uat-wave4-mockup.e2e.spec.ts` | Xoá mockup, qua trình duyệt | BE + **FE** |

### Cách chạy tay

```bash
BASE_URL=http://localhost:3000 API_URL=http://localhost:3000 UAT_PROD=1   ADMIN_USERNAME=<user> ADMIN_PASSWORD=<pass>   npx playwright test --project=e2e-new
```

Bộ Đợt 4 cần `BASE_URL` trỏ vào frontend (`:5173`) và FE phải đang chạy.

### Ba cái bẫy đã trả giá để biết

1. **Máy chủ FE tự chết** làm cả bộ Đợt 4 đỏ với `waitForURL timeout` — trông y
   hệt lỗi đăng nhập của ứng dụng. **Kiểm server còn sống trước khi kết luận:**
   `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/`.
2. **`test.fail()` đặt ở phạm vi `describe` áp cho MỌI test trong khối.** Một
   test vốn xanh sẽ báo "Expected to fail, but passed", và người đọc dễ tưởng
   test *khác* đã xanh. Nếu cần đánh dấu, đặt **bên trong** thân test.
3. **Thứ tự seed quan trọng, và hỏng thì im lặng.** `db:seed:doc-templates`
   chạy trước khi `db:seed` thành công sẽ tạo **0 mẫu mà vẫn exit 0**. Hệ quả
   chỉ hiện ra rất xa sau đó: tạo đơn thư trả 503 (ND-28). Luôn `db:seed` trước.

### CI

Hai job trong [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

| Job | Chạy gì | Cần gì |
|---|---|---|
| `uat-api` | 30 kiểm API (`--grep-invert "Đợt 4"`) | postgres + backend |
| `uat-e2e` | Bộ Đợt 4 (`--grep "Đợt 4"`) | postgres + backend + **frontend** |

Tách đôi cố ý: một lỗi khởi động frontend không được làm mất luôn tín hiệu của
30 kiểm API.

`uat-e2e` chạy frontend bằng `npm run dev`, **không** `vite preview`: frontend gọi
`/api/v1` tương đối và dựa vào `server.proxy` của vite trỏ sang `:3000`.
`vite preview` không áp `server.proxy` (nó đọc `preview.proxy`), nên bản build tĩnh
sẽ 404 mọi lời gọi API — một cách hỏng trông y hệt backend chết.

**Nó tự bỏ qua cho tới khi được bật.** Để chạy, cần ba thứ ở phía repo:

| Tên | Loại | Giá trị |
|---|---|---|
| `UAT_API_ENABLED` | Variable | `true` |
| `UAT_ADMIN_PASSWORD` | Secret | mật khẩu bất kỳ ≥ 8 ký tự |

**Chỉ một secret.** CI tự dựng tài khoản của nó: `prisma/seed.ts` tạo cố định
`username: admin` với mật khẩu lấy từ `SEED_ADMIN_PASSWORD`, và job dùng chung
secret đó cho cả seed lẫn đăng nhập test. Không cần một tài khoản có sẵn trên
môi trường nào, và DB là DB dùng riêng cho một lần chạy.

Thiết kế "tự bỏ qua" là cố ý: `global-setup` không có credential mặc định (mật khẩu
mặc định là mật khẩu bị commit), nên nếu job cứ chạy khi thiếu secret thì nó đỏ mỗi
vòng và người ta học cách phớt lờ CI.

Job đặt `continue-on-error: true` theo đúng nếp của repo — vào ở chế độ không chặn
trước, gỡ ra khi đã chạy ổn định vài vòng.

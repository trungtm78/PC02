# Maestro E2E Tests — PC02 Mobile

Automated UI tests cho Flutter app `vn.gov.pc02.mobile` bằng [Maestro](https://maestro.mobile.dev/).

## Cài đặt

```bash
# macOS/Linux
curl -Ls "https://get.maestro.dev" | bash

# Yêu cầu Java 17+
java -version
```

## Cấu hình

```bash
cp maestro/.env.example maestro/.env
# Điền TEST_USERNAME và TEST_PASSWORD vào .env
```

## Chạy test

```bash
# Đảm bảo emulator đang chạy
adb devices

# Smoke tests (login + navigation)
maestro test --include-tags=smoke \
  --env APP_ID=vn.gov.pc02.mobile \
  --env TEST_USERNAME=admin@pc02.local \
  --env TEST_PASSWORD=your_password \
  maestro/flows/

# Toàn bộ suite
maestro test \
  --format JUNIT \
  --output .gstack/qa-mobile-reports/results.xml \
  --env APP_ID=vn.gov.pc02.mobile \
  --env TEST_USERNAME=admin@pc02.local \
  --env TEST_PASSWORD=your_password \
  maestro/flows/

# Một flow cụ thể
maestro test --env APP_ID=vn.gov.pc02.mobile maestro/flows/01_login_success.yaml
```

## Flows

| File | Tags | Mục đích |
|------|------|----------|
| `01_login_success.yaml` | smoke, auth | Login happy path |
| `02_login_wrong_password.yaml` | auth, error-handling | Lỗi sai mật khẩu — verify Vietnamese message |
| `03_cases_list.yaml` | smoke, cases | Danh sách vụ việc — verify data unwrapping |
| `04_case_detail.yaml` | cases, detail | Chi tiết vụ việc — verify envelope unwrap |
| `05_incidents_list.yaml` | smoke, incidents | Danh sách sự cố |
| `06_petitions_list.yaml` | smoke, petitions | Danh sách đơn thư |
| `07_dashboard.yaml` | smoke, dashboard | Dashboard sau login |
| `08_tab_navigation.yaml` | navigation, theme | Tab bar navigation (white text fix) |
| `09_petition_detail.yaml` | petitions, detail | Chi tiết đơn thư |
| `99_logout.yaml` | smoke, auth | Logout + return to login |

## Ghi lại flow mới bằng Maestro Studio

```bash
maestro studio
```

Mở browser UI, chọn device, tap để record flow mới.

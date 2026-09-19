// Jest config riêng cho Stryker — chỉ chạy specs của module legacy-migration
// (bao phủ đủ 2 file mutate: legacy-mapper.ts + migration-report.ts), tăng tốc mutation.
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'legacy-migration/.*\\.spec\\.ts$',
  // Stryker chỉ chép `backend` vào hộp cát .stryker-tmp. Đúng HAI ca kiểm của module này đọc tệp
  // NGOÀI backend (đã quét toàn bộ: không còn tệp thứ ba), nên trong hộp cát chúng hỏng theo hai
  // kiểu khác nhau — và kiểu thứ hai nguy hiểm hơn kiểu thứ nhất:
  //
  //  1. ma-o-chon-he-cu.spec.ts (#296, 28/08/2026) đọc frontend/src/shared/legacy/tinhTrangOptions.ts
  //     bằng fs.readFileSync ngay trong thân describe → ném ENOENT lúc jest thu thập ca kiểm →
  //     Stryker xếp vào ERROR và dừng cả lượt. ĐÂY là lý do workflow "Mutation — expert modules"
  //     đỏ mọi tuần từ 30/08/2026 — KHÔNG phải vì điểm đột biến tụt dưới ngưỡng (điểm thật 87,43
  //     trên ngưỡng break 60).
  //
  //  2. field-parity.gate.spec.ts đọc docs/legacy/field-parity-matrix.json bằng fs.existsSync nên
  //     KHÔNG ném; nó chỉ đỏ một ca bên trong it(). Stryker chạy tiếp và lượt chạy thử vẫn báo
  //     "succeeded". Nhưng một ca đỏ SẴN trong hộp cát khiến mọi mutant đều bị tính là đã bị giết
  //     → điểm đột biến CAO GIẢ. Vá mỗi ca (1) rồi thấy xanh là biến lỗi ồn ào thành con số dối.
  //
  // Cả hai đều là hạn chế của HỘP CÁT, không phải ca kiểm sai — và cả hai vẫn chạy đủ ở `npm test`
  // mỗi PR (cấu hình jest mặc định quét `.*\.spec\.ts$` trên toàn src), nên không mất bảo chứng.
  // Giữ 59 bộ còn lại thay vì thu hẹp về vài bộ "chạm mã được mutate": bảo chứng rộng hơn.
  testPathIgnorePatterns: [
    'legacy-migration/ma-o-chon-he-cu\\.spec\\.ts$',
    'legacy-migration/field-parity\\.gate\\.spec\\.ts$',
  ],
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }] },
  transformIgnorePatterns: ['node_modules/(?!(@otplib|@noble)/)'],
};

import { formatVNDate } from "@/lib/dates";

interface PrintMau60Props {
  soQuyetDinh: string;
  soQDUyThac: string;
  ngayQD: string;
  donViGiao: string;
  dtvDuocPhanCong: string;
  tenVuAn: string;
}

export function PrintMau60({ soQuyetDinh, soQDUyThac, ngayQD, donViGiao, dtvDuocPhanCong, tenVuAn }: PrintMau60Props) {
  const ngayIn = formatVNDate(new Date().toISOString());

  return (
    <div className="print-container max-w-[210mm] mx-auto p-8 bg-white text-sm font-serif">
      {/* Official header */}
      <div className="flex justify-between mb-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase">Bộ Công An</p>
          <p className="text-xs font-semibold uppercase">Công An TP.Hồ Chí Minh</p>
          <p className="text-xs font-bold uppercase border-b-2 border-black pb-1">
            PHÒNG CSĐT TỘI PHẠM VỀ THAM NHŨNG, KINH TẾ, BUÔN LẬU
          </p>
          <p className="text-xs mt-1">Số: {soQuyetDinh}/QĐ-PC02-CSKT</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase">Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</p>
          <p className="text-xs font-bold border-b-2 border-black pb-1">Độc lập - Tự do - Hạnh phúc</p>
          <p className="text-xs mt-1">TP. Hồ Chí Minh, ngày {ngayIn}</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center my-6">
        <h1 className="text-base font-bold uppercase tracking-wide">Quyết Định</h1>
        <p className="text-sm font-semibold mt-1">
          Phân công Điều tra viên giải quyết ủy thác điều tra
        </p>
        <p className="text-xs text-gray-600 mt-0.5">(Mẫu số 60 — TT 119/2021/TT-BCA)</p>
      </div>

      {/* Body */}
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          <span className="font-semibold">Căn cứ:</span> Điều 37 Bộ luật Tố tụng hình sự năm 2015;
        </p>
        <p>
          Quyết định ủy thác số <span className="underline">{soQDUyThac || '...........................'}</span>{' '}
          ngày <span className="underline">{ngayQD ? formatVNDate(ngayQD) : '...........'}</span>{' '}
          của <span className="underline">{donViGiao || '...........................'}</span>;
        </p>
        <p>
          <span className="font-semibold">Phó Thủ trưởng Cơ quan Cảnh sát điều tra Phòng PC02 quyết định:</span>
        </p>
        <p>
          Điều 1: Phân công Điều tra viên{' '}
          <span className="underline font-medium">{dtvDuocPhanCong || '...........................'}</span>{' '}
          điều tra giải quyết ủy thác vụ: <span className="underline">{tenVuAn}</span>.
        </p>
        <p>Điều 2: Điều tra viên được phân công có trách nhiệm thực hiện đầy đủ các nội dung yêu cầu ủy thác trong thời hạn quy định và báo cáo kết quả cho Phó Thủ trưởng trực tiếp chỉ đạo.</p>
        <p>Điều 3: Quyết định này có hiệu lực kể từ ngày ký.</p>
      </div>

      {/* Signature */}
      <div className="flex justify-between mt-12">
        <div className="text-xs">
          <p className="font-semibold">Nơi nhận:</p>
          <p>- CQĐT ủy thác;</p>
          <p>- Điều tra viên được phân công;</p>
          <p>- Lưu hồ sơ.</p>
        </div>
        <div className="text-center min-w-[180px]">
          <p className="text-xs font-semibold uppercase">Phó Thủ trưởng Cơ quan Điều tra</p>
          <p className="text-xs text-gray-400 italic">(Ký, ghi rõ họ tên)</p>
          <div className="h-20" />
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-container { padding: 20mm !important; }
        }
      `}</style>
    </div>
  );
}

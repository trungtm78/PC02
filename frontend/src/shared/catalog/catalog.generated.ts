// AUTO-GENERATED bởi backend/scripts/generate-catalog.cjs — KHÔNG sửa tay.
// Nguồn: backend/src/catalog/catalog.registry.ts. Chạy lại: npm run gen:catalog

export type CatalogOption = { code: string; label: string };

export const CATALOG_LEGAL = {
  "LY_DO_KHONG_KHOI_TO": [
    {
      "code": "KHONG_CO_SU_VIEC",
      "label": "Không có sự việc phạm tội (khoản 1a)"
    },
    {
      "code": "HANH_VI_KHONG_CAU_THANH_TOI_PHAM",
      "label": "Hành vi không cấu thành tội phạm (khoản 1b)"
    },
    {
      "code": "NGUOI_THUC_HIEN_CHUA_DU_TUOI",
      "label": "Người thực hiện chưa đủ tuổi TNHS (khoản 1c)"
    },
    {
      "code": "NGUOI_PHAM_TOI_CHET",
      "label": "Người phạm tội đã chết (khoản 1d)"
    },
    {
      "code": "HET_THOI_HIEU",
      "label": "Hết thời hiệu truy cứu TNHS (khoản 1đ)"
    },
    {
      "code": "TOI_PHAM_DA_DUOC_XOA_AN_TICH",
      "label": "Tội phạm đã được đại xá (khoản 1e)"
    },
    {
      "code": "TRUONG_HOP_KHAC",
      "label": "Trường hợp khác theo quy định BLTTHS (khoản 1g)"
    }
  ],
  "LY_DO_TAM_DINH_CHI_VU_VIEC": [
    {
      "code": "CHUA_CO_KET_QUA_GIAM_DINH",
      "label": "Chưa có kết quả giám định"
    },
    {
      "code": "CHUA_CO_KET_QUA_DINH_GIA",
      "label": "Chưa có kết quả định giá tài sản"
    },
    {
      "code": "CHUA_CO_KET_QUA_TUONG_TRO",
      "label": "Chưa có kết quả tương trợ tư pháp"
    },
    {
      "code": "YEU_CAU_TAI_LIEU_CHUA_CO",
      "label": "Yêu cầu tài liệu chưa có kết quả"
    },
    {
      "code": "BAT_KHA_KHANG",
      "label": "Lý do bất khả kháng"
    },
    {
      "code": "CAN_CU_KHAC",
      "label": "Căn cứ khác"
    }
  ],
  "LY_DO_TAM_DINH_CHI_VU_AN": [
    {
      "code": "CHUA_XAC_DINH_BI_CAN",
      "label": "Chưa xác định được bị can (Đ.229.1.a)"
    },
    {
      "code": "KHONG_BIET_BI_CAN_O_DAU",
      "label": "Không biết rõ bị can đang ở đâu (Đ.229.1.b)"
    },
    {
      "code": "BI_CAN_BENH_TAM_THAN",
      "label": "Bị can bị bệnh tâm thần hoặc hiểm nghèo (Đ.229.1.c)"
    },
    {
      "code": "CHUA_CO_KET_QUA_GIAM_DINH",
      "label": "Chưa có kết quả giám định (Đ.229.1.d)"
    },
    {
      "code": "CHUA_CO_KET_QUA_DINH_GIA",
      "label": "Chưa có kết quả định giá tài sản (Đ.229.1.d)"
    },
    {
      "code": "CHUA_CO_KET_QUA_TUONG_TRO",
      "label": "Chưa có kết quả tương trợ tư pháp (Đ.229.1.d)"
    },
    {
      "code": "YEU_CAU_TAI_LIEU_CHUA_CO",
      "label": "Đã yêu cầu tài liệu nhưng chưa có kết quả (Đ.229.1.đ)"
    },
    {
      "code": "BAT_KHA_KHANG",
      "label": "Bất khả kháng: thiên tai, dịch bệnh (Đ.229.1.e)"
    }
  ],
  "LOAI_NGUON_TIN": [
    {
      "code": "TO_GIAC",
      "label": "Tố giác của cá nhân (Đ.144 khoản 1a)"
    },
    {
      "code": "TIN_BAO",
      "label": "Tin báo của cơ quan, tổ chức (Đ.144 khoản 1b)"
    },
    {
      "code": "KIEN_NGHI_KHOI_TO",
      "label": "Kiến nghị khởi tố (Đ.144 khoản 1c)"
    }
  ],
  "NGUON_PHAT_TIN": [
    {
      "code": "CA_NHAN_TO_GIAC",
      "label": "Cá nhân tố giác"
    },
    {
      "code": "CO_QUAN_NHA_NUOC",
      "label": "Cơ quan nhà nước"
    },
    {
      "code": "TO_CHUC",
      "label": "Tổ chức (doanh nghiệp, đoàn thể)"
    },
    {
      "code": "CA_NHAN_BAO_TIN",
      "label": "Cá nhân báo tin"
    },
    {
      "code": "PHUONG_TIEN_TRUYEN_THONG",
      "label": "Phương tiện thông tin đại chúng"
    },
    {
      "code": "VIEN_KIEM_SAT",
      "label": "Viện kiểm sát nhân dân"
    },
    {
      "code": "THANH_TRA",
      "label": "Cơ quan thanh tra"
    },
    {
      "code": "KIEM_TOAN",
      "label": "Cơ quan kiểm toán"
    },
    {
      "code": "TOA_AN",
      "label": "Tòa án nhân dân"
    },
    {
      "code": "CO_QUAN_KHAC",
      "label": "Cơ quan nhà nước khác"
    }
  ],
  "PHUONG_THUC_TIEP_NHAN": [
    {
      "code": "TRUC_TIEP_BANG_LOI",
      "label": "Bằng lời trực tiếp"
    },
    {
      "code": "TRUC_TIEP_BANG_VAN_BAN",
      "label": "Bằng văn bản trực tiếp"
    },
    {
      "code": "DIEN_THOAI",
      "label": "Qua điện thoại"
    },
    {
      "code": "BUU_DIEN",
      "label": "Qua bưu điện / giao liên"
    },
    {
      "code": "PHUONG_TIEN_DIEN_TU",
      "label": "Qua mạng / email / phương tiện điện tử"
    }
  ],
  "LOAI_DON": [
    {
      "code": "TO_CAO",
      "label": "Tố cáo"
    },
    {
      "code": "KHIEU_NAI",
      "label": "Khiếu nại"
    },
    {
      "code": "KIEN_NGHI",
      "label": "Kiến nghị"
    },
    {
      "code": "PHAN_ANH",
      "label": "Phản ánh"
    }
  ]
} as const;

export const CATALOG_DYNAMIC_KEYS = ["DOCUMENT_TYPE"] as const;

export const CATALOG_META = {
  "LY_DO_KHONG_KHOI_TO": {
    "kind": "legal",
    "multi": true
  },
  "LY_DO_TAM_DINH_CHI_VU_VIEC": {
    "kind": "legal",
    "multi": true
  },
  "LY_DO_TAM_DINH_CHI_VU_AN": {
    "kind": "legal",
    "multi": true
  },
  "LOAI_NGUON_TIN": {
    "kind": "legal",
    "multi": false
  },
  "NGUON_PHAT_TIN": {
    "kind": "legal",
    "multi": false,
    "cascade": {
      "parentKey": "LOAI_NGUON_TIN",
      "map": {
        "TO_GIAC": [
          "CA_NHAN_TO_GIAC"
        ],
        "TIN_BAO": [
          "CO_QUAN_NHA_NUOC",
          "TO_CHUC",
          "CA_NHAN_BAO_TIN",
          "PHUONG_TIEN_TRUYEN_THONG"
        ],
        "KIEN_NGHI_KHOI_TO": [
          "VIEN_KIEM_SAT",
          "THANH_TRA",
          "KIEM_TOAN",
          "TOA_AN",
          "CO_QUAN_KHAC"
        ]
      }
    }
  },
  "PHUONG_THUC_TIEP_NHAN": {
    "kind": "legal",
    "multi": false
  },
  "LOAI_DON": {
    "kind": "legal",
    "multi": false
  },
  "DOCUMENT_TYPE": {
    "kind": "dynamic",
    "multi": false
  }
} as const;

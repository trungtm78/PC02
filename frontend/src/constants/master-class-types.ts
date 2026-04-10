export const MASTER_CLASS_TYPES: Record<string, string> = {
  '00': 'Giới tính',
  '01': 'Loại vụ việc',
  '02': 'Loại đơn thư',
  '03': 'Mức độ ưu tiên',
  '04': 'Nhóm tuổi',
  '05': 'Trình độ học vấn',
  '06': 'Loại vật chứng',
  '07': 'Phân loại vụ án',
  '08': 'Viện Kiểm sát',
};

export const MASTER_CLASS_TYPE_LIST = Object.entries(MASTER_CLASS_TYPES).map(
  ([code, name]) => ({ code, name }),
);

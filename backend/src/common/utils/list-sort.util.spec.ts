import { buildListOrderBy } from './list-sort.util';

/**
 * Ca kiểm cho khâu dựng thứ tự sắp xếp dùng chung của mọi danh sách.
 *
 * Trước bản vá này, ba module Đơn thư / Vụ việc / Vụ án chép nguyên một đoạn logic
 * giống nhau, và chuỗi 'createdAt' xuất hiện BA LẦN mỗi module (mặc định trong DTO,
 * mặc định lúc bóc tham số, nhánh dự phòng của danh sách trắng) — 21 chỗ ghi cứng
 * rải rác. Gom về một chỗ để đổi mặc định là đổi một nơi.
 */
describe('buildListOrderBy', () => {
  const ALLOWED = ['createdAt', 'updatedAt', 'receivedDate', 'deadline'] as const;

  it('không truyền gì → dùng trường mặc định', () => {
    expect(
      buildListOrderBy({ allowed: ALLOWED, defaultField: 'receivedDate' }),
    ).toEqual([{ receivedDate: 'desc' }, { id: 'desc' }]);
  });

  it('trường hợp lệ → dùng đúng trường đó', () => {
    expect(
      buildListOrderBy({
        sortBy: 'deadline',
        allowed: ALLOWED,
        defaultField: 'receivedDate',
      }),
    ).toEqual([{ deadline: 'desc' }, { id: 'desc' }]);
  });

  // Chốt an toàn: tên trường tuỳ tiện KHÔNG được đi thẳng vào Prisma.
  it('trường lạ → rơi về mặc định, KHÔNG dùng chuỗi người dùng gửi', () => {
    const result = buildListOrderBy({
      sortBy: 'passwordHash',
      allowed: ALLOWED,
      defaultField: 'receivedDate',
    });
    expect(result).toEqual([{ receivedDate: 'desc' }, { id: 'desc' }]);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('chiều tăng dần được tôn trọng', () => {
    expect(
      buildListOrderBy({
        sortOrder: 'asc',
        allowed: ALLOWED,
        defaultField: 'receivedDate',
      }),
    ).toEqual([{ receivedDate: 'asc' }, { id: 'asc' }]);
  });

  // Đơn thư và Vụ việc trước đây KHÔNG có validator cho sortOrder — chuỗi bất kỳ
  // đi thẳng vào Prisma và thành lỗi 500 ngay khi giao diện bắt đầu gửi tham số thật.
  it('chiều sắp rác → ép về giảm dần, không ném lỗi', () => {
    for (const bad of ['DESC; DROP TABLE', '', 'ascending', undefined as never]) {
      const result = buildListOrderBy({
        sortOrder: bad as 'asc' | 'desc',
        allowed: ALLOWED,
        defaultField: 'receivedDate',
      });
      expect(result[0]).toEqual({ receivedDate: 'desc' });
    }
  });

  // Postgres mặc định NULLS FIRST ở chiều DESC. Thiếu bước này thì hồ sơ KHÔNG có
  // ngày sẽ nổi lên đầu danh sách — đúng thứ bản vá này sinh ra để tránh.
  it('trường cho phép rỗng → đẩy hồ sơ trống xuống CUỐI', () => {
    expect(
      buildListOrderBy({
        allowed: ALLOWED,
        defaultField: 'deadline',
        nullableFields: ['deadline'],
      }),
    ).toEqual([{ deadline: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }]);
  });

  it('hồ sơ trống xuống cuối ở CẢ chiều tăng dần', () => {
    expect(
      buildListOrderBy({
        sortOrder: 'asc',
        allowed: ALLOWED,
        defaultField: 'deadline',
        nullableFields: ['deadline'],
      }),
    ).toEqual([{ deadline: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]);
  });

  it('trường KHÔNG cho phép rỗng → không chèn nulls thừa', () => {
    const result = buildListOrderBy({
      allowed: ALLOWED,
      defaultField: 'receivedDate',
      nullableFields: ['deadline'],
    });
    expect(result[0]).toEqual({ receivedDate: 'desc' });
  });

  // Không có khoá phụ thì hồ sơ trùng ngày đổi chỗ giữa các lần truy vấn, và cán bộ
  // thấy hồ sơ lặp hoặc biến mất khi bấm sang trang.
  it('luôn có khoá phụ ổn định để phân trang không lặp/mất hồ sơ', () => {
    const result = buildListOrderBy({ allowed: ALLOWED, defaultField: 'receivedDate' });
    expect(result).toHaveLength(2);
    expect(result[result.length - 1]).toEqual({ id: 'desc' });
  });

  // Có trường mà tên người dùng gọi KHÁC cột thật dùng để sắp. Ví dụ Đơn thư: người
  // dùng bấm cột "Ngày nhận" (`receivedDate`), nhưng phải sắp theo cột sinh
  // `sortReceivedDate` để 9 hồ sơ ngày phi lý chìm xuống cuối.
  describe('nắn tên trường (fieldAliases)', () => {
    it('trường có ánh xạ → sắp theo cột thật, không phải tên người dùng gửi', () => {
      expect(
        buildListOrderBy({
          sortBy: 'receivedDate',
          allowed: ALLOWED,
          defaultField: 'receivedDate',
          nullableFields: ['sortReceivedDate'],
          fieldAliases: { receivedDate: 'sortReceivedDate' },
        }),
      ).toEqual([
        { sortReceivedDate: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ]);
    });

    it('ánh xạ áp cho CẢ trường mặc định, không chỉ trường người dùng chọn', () => {
      const result = buildListOrderBy({
        allowed: ALLOWED,
        defaultField: 'receivedDate',
        nullableFields: ['sortReceivedDate'],
        fieldAliases: { receivedDate: 'sortReceivedDate' },
      });
      expect(result[0]).toEqual({ sortReceivedDate: { sort: 'desc', nulls: 'last' } });
    });

    it('trường không có ánh xạ → giữ nguyên', () => {
      expect(
        buildListOrderBy({
          sortBy: 'deadline',
          allowed: ALLOWED,
          defaultField: 'receivedDate',
          fieldAliases: { receivedDate: 'sortReceivedDate' },
        })[0],
      ).toEqual({ deadline: 'desc' });
    });

    // Danh sách trắng kiểm tên NGƯỜI DÙNG gửi, nắn tên xảy ra SAU. Nếu ngược lại thì
    // cột sinh phải lọt vào danh sách trắng và lộ ra ngoài giao diện.
    it('nắn tên xảy ra SAU khi kiểm danh sách trắng', () => {
      const result = buildListOrderBy({
        sortBy: 'sortReceivedDate', // tên cột thật — người dùng không được gọi thẳng
        allowed: ALLOWED,
        defaultField: 'deadline',
        fieldAliases: { receivedDate: 'sortReceivedDate' },
      });
      expect(result[0]).toEqual({ deadline: 'desc' });
    });
  });

  it('sắp theo chính khoá phụ thì không lặp lại nó hai lần', () => {
    const result = buildListOrderBy({
      sortBy: 'id',
      allowed: [...ALLOWED, 'id'],
      defaultField: 'receivedDate',
    });
    expect(result).toEqual([{ id: 'desc' }]);
  });
});

import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

/**
 * CỔNG: không được đổi một ô ngày sang `Date` mà chưa chắc ô ấy có giá trị.
 *
 * `new Date(null)` không ném lỗi — nó trả về 01/01/1970. Một ô ngày để trống vì thế biến
 * thành một mốc tố tụng có thật trong cơ sở dữ liệu, và mọi phép tính thời hạn dựa trên nó
 * đều sai theo. Kiểu hỏng này im lặng: không có ngoại lệ, không có bản ghi lỗi, chỉ có một
 * con số vô lý nằm trong hồ sơ.
 *
 * Trước 26/08/2026 lớp giao diện BỎ HẲN ô rỗng khỏi lời gọi nên chỗ này không bao giờ nhận
 * `null` — lỗi nằm im. Từ khi ô rỗng gửi `null` (để xoá được), nhánh không có ngoại lệ ấy
 * trở thành đường đi thường ngày.
 */
describe('Ô ngày rỗng không được biến thành 01/01/1970', () => {
  const NGUON = path.join(__dirname, 'cases.service.ts');

  it('mọi new Date(dto.x) đều có nhánh cho ô rỗng', () => {
    const source = ts.createSourceFile(
      NGUON,
      fs.readFileSync(NGUON, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const hong: string[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Date' &&
        node.arguments?.length === 1
      ) {
        const argument = node.arguments[0];
        if (
          ts.isPropertyAccessExpression(argument) &&
          ts.isIdentifier(argument.expression) &&
          argument.expression.text === 'dto'
        ) {
          const field = argument.name.text;
          const guard = node.parent;
          const guarded =
            ts.isConditionalExpression(guard) &&
            guard.whenTrue === node &&
            ts.isPropertyAccessExpression(guard.condition) &&
            ts.isIdentifier(guard.condition.expression) &&
            guard.condition.expression.text === 'dto' &&
            guard.condition.name.text === field;
          if (!guarded) {
            const line =
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1;
            hong.push(`cases.service.ts:${line} — ${field}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(hong).toEqual([]);
  });
});

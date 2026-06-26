import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { CATALOG_REGISTRY } from '../../catalog/catalog.registry';

/**
 * Validate giá trị thuộc danh mục Catalog.
 *
 * - kind 'legal': kiểm code nằm trong registry values (đồng bộ, không chạm DB).
 * - kind 'dynamic': PASS ở tầng DTO (giá trị động ở Directory) — validate tồn tại
 *   thực hiện ở service layer qua `CatalogService.isValid`.
 *
 * Dùng `{ each: true }` cho cột mảng (multi) — class-validator gọi validate từng phần tử.
 * Thay cho `@IsEnum`. Giá trị undefined/null/"" → pass (field optional).
 */
export function IsCatalogValue(key: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCatalogValue',
      target: object.constructor,
      propertyName,
      constraints: [key],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === '') return true;
          const e = CATALOG_REGISTRY[key];
          if (!e || e.kind !== 'legal') return true; // dynamic → validate ở service
          return e.values.some((v) => v.code === value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} "${args.value}" không thuộc danh mục ${key}`;
        },
      },
    });
  };
}

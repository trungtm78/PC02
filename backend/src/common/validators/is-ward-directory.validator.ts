import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * v0.33.0.0: validate that string value is an id of Directory(type='WARD').
 * FK constraint alone không enforce type — admin có thể assign Crime id làm wardId.
 * App-level guard defense in depth.
 */
@ValidatorConstraint({ async: true, name: 'IsWardDirectory' })
@Injectable()
export class IsWardDirectoryConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: string | undefined | null): Promise<boolean> {
    if (value === undefined || value === null || value === '') return true; // optional
    const dir = await this.prisma.directory.findFirst({
      where: { id: value, type: 'WARD' },
      select: { id: true },
    });
    return !!dir;
  }

  defaultMessage(): string {
    return 'Phường không hợp lệ (id không tồn tại hoặc không phải loại WARD)';
  }
}

export function IsWardDirectory(opts?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'IsWardDirectory',
      target: object.constructor,
      propertyName,
      options: opts,
      validator: IsWardDirectoryConstraint,
    });
}

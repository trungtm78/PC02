import { Module } from '@nestjs/common';
import { OcrBinder } from './ocr-binder';

/**
 * The binder alone, with no dependencies, so the modules that create records can import it without importing
 * the rest of scan intake (which depends on documents, and would risk an import cycle).
 */
@Module({ providers: [OcrBinder], exports: [OcrBinder] })
export class OcrBindingModule {}

import type { StorageEngine } from 'multer';
import { mkdir, open, createWriteStream, unlink } from 'node:fs';
import { join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream';
import { BadRequestException, ConflictException } from '@nestjs/common';
const safeName = (name: string) =>
  !!name &&
  name !== '.' &&
  name !== '..' &&
  !/[\\/:]/.test(name) &&
  !name.includes('\0');
export function immutableDocumentStorage(
  root = join(process.cwd(), 'uploads', 'documents'),
  filename?: () => string,
): StorageEngine {
  return {
    _handleFile(_req, file, callback) {
      const name = filename
        ? filename()
        : `${Date.now()}-${randomBytes(16).toString('hex')}${extname(file.originalname)}`;
      if (!safeName(name)) {
        callback(new BadRequestException('Invalid server upload filename'));
        return;
      }
      const fullPath = join(root, name);
      mkdir(root, { recursive: true }, (mkdirError) => {
        if (mkdirError) {
          callback(new BadRequestException('Upload storage unavailable'));
          return;
        }
        // O_EXCL: even an accidental server nonce collision cannot overwrite any original.
        open(fullPath, 'wx', (openError, fd) => {
          if (openError) {
            callback(
              openError.code === 'EEXIST'
                ? new ConflictException(
                    'Upload filename already exists; retry upload',
                  )
                : new BadRequestException('Upload storage unavailable'),
            );
            return;
          }
          const output = createWriteStream(fullPath, { fd, autoClose: true });
          pipeline(file.stream, output, (error) => {
            if (error) {
              unlink(fullPath, () =>
                callback(new BadRequestException('Upload stream failed')),
              );
              return;
            }
            callback(null, {
              destination: root,
              filename: name,
              path: fullPath,
              size: output.bytesWritten,
            });
          });
        });
      });
    },
    _removeFile(_req, file, callback) {
      if (!safeName(file.filename)) {
        callback(new BadRequestException('Invalid server upload filename'));
        return;
      }
      unlink(join(root, file.filename), (error) => callback(error));
    },
  };
}

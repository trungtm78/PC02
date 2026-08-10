import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateInvestigationSupplementDto } from './create-investigation-supplement.dto';

/**
 * D5 — sửa yêu cầu điều tra bổ sung.
 *
 * `PartialType` chứ không chép tay danh sách trường: bản sao tay sẽ lệch khỏi
 * DTO tạo ngay lần đầu ai đó thêm trường, và lệch im lặng — trường mới sửa được
 * lúc tạo, không sửa được lúc cập nhật, không lỗi nào báo.
 *
 * `caseId` bị loại (`OmitType`) chứ không chỉ bỏ qua: khác hai module kia, cha
 * ở đây nằm trong THÂN yêu cầu chứ không phải đường dẫn. Nhận nó ở bản cập
 * nhật là mở đúng lỗ ND-18 — đổi cha mà chỉ kiểm cha cũ. Đổi cha phải là một
 * thao tác riêng, có kiểm phạm vi cả hai đầu.
 */
export class UpdateInvestigationSupplementDto extends PartialType(
  OmitType(CreateInvestigationSupplementDto, ['caseId'] as const),
) {}

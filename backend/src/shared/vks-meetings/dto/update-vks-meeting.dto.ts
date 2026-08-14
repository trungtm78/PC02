import { PartialType } from '@nestjs/mapped-types';
import { CreateVksMeetingDto } from './create-vks-meeting.dto';

/**
 * D5 — sửa biên bản họp VKS.
 *
 * `PartialType` chứ không viết lại danh sách trường: một bản sao chép tay sẽ
 * lệch khỏi DTO tạo ngay lần đầu ai đó thêm trường, và lệch một cách im lặng —
 * trường mới sửa được ở lúc tạo, không sửa được ở lúc cập nhật, không lỗi nào
 * báo.
 *
 * Không có trường cha (`caseId`/`incidentId`) để bỏ: chúng nằm trên đường dẫn,
 * nên không có cách nào đổi cha bằng thân yêu cầu — đúng khuôn PR-A2.
 */
export class UpdateVksMeetingDto extends PartialType(CreateVksMeetingDto) {}

import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';

class RegisterDeviceDto {
  @IsString()
  @Length(1, 4096)
  fcmToken: string;

  @IsIn(['android', 'ios'])
  platform: string;
}

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(201)
  register(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(req.user.id, dto.fcmToken, dto.platform);
  }

  @Delete(':token')
  @HttpCode(200)
  unregister(@Req() req: any, @Param('token') token: string) {
    return this.devicesService.unregister(token, req.user.id);
  }
}

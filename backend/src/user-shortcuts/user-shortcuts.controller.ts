import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserShortcutsService } from './user-shortcuts.service';
import { UpsertShortcutDto } from './dto/upsert-shortcut.dto';
import { SwapShortcutsDto } from './dto/swap-shortcuts.dto';

@UseGuards(JwtAuthGuard)
@Controller('user-shortcuts')
export class UserShortcutsController {
  constructor(private readonly service: UserShortcutsService) {}

  @Get()
  list(@Request() req: any) {
    return this.service.list(req.user.id);
  }

  // Static path BEFORE parameterised — same pattern as abbreviations.controller
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  resetAll(@Request() req: any) {
    return this.service.resetAll(req.user.id);
  }

  @Post('swap')
  @HttpCode(HttpStatus.OK)
  swap(@Request() req: any, @Body() dto: SwapShortcutsDto) {
    return this.service.swap(req.user.id, dto);
  }

  @Put(':action')
  upsert(
    @Request() req: any,
    @Param('action') action: string,
    @Body() dto: UpsertShortcutDto,
  ) {
    return this.service.upsert(req.user.id, action, dto);
  }

  @Delete(':action')
  remove(@Request() req: any, @Param('action') action: string) {
    return this.service.remove(req.user.id, action);
  }
}

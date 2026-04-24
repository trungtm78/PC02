import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AbbreviationsService } from './abbreviations.service';
import { CopyAbbreviationsDto } from './dto/copy-abbreviations.dto';
import { UpsertAbbreviationDto } from './dto/upsert-abbreviation.dto';

@UseGuards(JwtAuthGuard)
@Controller('abbreviations')
export class AbbreviationsController {
  constructor(private readonly service: AbbreviationsService) {}

  // FINDING-2: static route /users must be declared BEFORE parameterised /:shortcut
  @Get('users')
  listUsers(@Request() req: any) {
    return this.service.listUsers(req.user.id);
  }

  @Get()
  list(@Request() req: any) {
    return this.service.list(req.user.id);
  }

  @Put(':shortcut')
  upsert(
    @Request() req: any,
    @Param('shortcut') shortcut: string,
    @Body() dto: UpsertAbbreviationDto,
  ) {
    return this.service.upsert(req.user.id, shortcut, dto);
  }

  @Delete(':shortcut')
  remove(@Request() req: any, @Param('shortcut') shortcut: string) {
    return this.service.remove(req.user.id, shortcut);
  }

  @Post('copy')
  copyFrom(@Request() req: any, @Body() dto: CopyAbbreviationsDto) {
    return this.service.copyFrom(req.user.id, dto);
  }
}

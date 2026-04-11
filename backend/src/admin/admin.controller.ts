import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  UpdateRolePermissionsDto,
  UpdateRoleDto,
} from './dto/update-role-permissions.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateDataGrantDto } from './dto/create-data-grant.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Users ─────────────────────────────────────────────
  @Get('users')
  @RequirePermissions({ action: 'read', subject: 'User' })
  getUsers(@Query() query: QueryUsersDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @RequirePermissions({ action: 'read', subject: 'User' })
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Post('users')
  @RequirePermissions({ action: 'write', subject: 'User' })
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.createUser(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch('users/:id')
  @RequirePermissions({ action: 'write', subject: 'User' })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.updateUser(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'User' })
  deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.deleteUser(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Roles ─────────────────────────────────────────────
  @Get('roles')
  @RequirePermissions({ action: 'read', subject: 'User' })
  getRoles() {
    return this.adminService.getRoles();
  }

  @Get('roles/:id')
  @RequirePermissions({ action: 'read', subject: 'User' })
  getRoleById(@Param('id') id: string) {
    return this.adminService.getRoleById(id);
  }

  @Patch('roles/:id')
  @RequirePermissions({ action: 'write', subject: 'User' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.updateRole(id, dto, user.id);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'User' })
  deleteRole(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.adminService.deleteRole(id, user.id);
  }

  // ── Permission Matrix ─────────────────────────────────
  @Get('permissions')
  @RequirePermissions({ action: 'read', subject: 'User' })
  getAllPermissions() {
    return this.adminService.getAllPermissions();
  }

  @Patch('roles/:id/permissions')
  @RequirePermissions({ action: 'write', subject: 'User' })
  updateRolePermissions(
    @Param('id') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.updateRolePermissions(roleId, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Data Access Grants ───────────────────────────────
  @Get('data-grants')
  @RequirePermissions({ action: 'read', subject: 'User' })
  listDataAccessGrants() {
    return this.adminService.listDataAccessGrants();
  }

  @Post('data-grants')
  @RequirePermissions({ action: 'write', subject: 'User' })
  createDataAccessGrant(
    @Body() dto: CreateDataGrantDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.createDataAccessGrant(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('data-grants/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'User' })
  revokeDataAccessGrant(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.revokeDataAccessGrant(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

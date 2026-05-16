import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuditModule } from '../audit/audit.module';
import { TeamsModule } from '../teams/teams.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuditModule, TeamsModule, forwardRef(() => AuthModule)],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}

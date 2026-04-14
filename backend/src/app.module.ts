import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { DirectoryModule } from './directory/directory.module';
import { CasesModule } from './cases/cases.module';
import { SubjectsModule } from './subjects/subjects.module';
import { LawyersModule } from './lawyers/lawyers.module';
import { PetitionsModule } from './petitions/petitions.module';
import { IncidentsModule } from './incidents/incidents.module';
import { DocumentsModule } from './documents/documents.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CalendarModule } from './calendar/calendar.module';
import { ReportsModule } from './reports/reports.module';
import { ProposalsModule } from './proposals/proposals.module';
import { GuidanceModule } from './guidance/guidance.module';
import { ExchangesModule } from './exchanges/exchanges.module';
import { DelegationsModule } from './delegations/delegations.module';
import { ConclusionsModule } from './conclusions/conclusions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvestigationSupplementsModule } from './investigation-supplements/investigation-supplements.module';
import { MasterClassModule } from './master-class/master-class.module';
import { TeamsModule } from './teams/teams.module';
import { SettingsModule } from './settings/settings.module';
import { UnitScopeService } from './auth/services/unit-scope.service';
import { DataScopeInterceptor } from './auth/interceptors/data-scope.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    AuthModule,
    AuditModule,
    AdminModule,
    DirectoryModule,
    CasesModule,
    SubjectsModule,
    LawyersModule,
    PetitionsModule,
    IncidentsModule,
    DocumentsModule,
    DashboardModule,
    CalendarModule,
    ReportsModule,
    ProposalsModule,
    GuidanceModule,
    ExchangesModule,
    DelegationsModule,
    ConclusionsModule,
    NotificationsModule,
    InvestigationSupplementsModule,
    MasterClassModule,
    TeamsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    UnitScopeService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DataScopeInterceptor,
    },
  ],
})
export class AppModule {}

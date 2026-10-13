import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { QuestionBankModule } from './modules/question-bank/question-bank.module';
import { QuestionTagModule } from './modules/question-tag/question-tag.module';
import { SubjectModule } from './modules/subject/subject.module';
import { PracticeRecordModule } from './modules/practice-record/practice-record.module';
import { AuthModule } from './modules/auth/auth.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { QuestionModule } from './modules/question/question.module';
import { StatsModule } from './modules/stats/stats.module';
import { HealthModule } from './modules/health/health.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { UserSettingsModule } from './modules/user-settings/user-settings.module';
import { SmartPracticeModule } from './modules/smart-practice/smart-practice.module';
import { FavoriteGroupModule } from './modules/favorite-group/favorite-group.module';
import { AdminFeedbackModule } from './modules/admin-feedback/admin-feedback.module';
import { BankCollaborationModule } from './modules/bank-collaboration/bank-collaboration.module';
import { BankRatingModule } from './modules/bank-rating/bank-rating.module';
import { AdminOperationLogModule } from './modules/admin-operation-log/admin-operation-log.module';
import { SystemLogModule } from './modules/system-log/system-log.module';
import { ImageProxyModule } from './modules/image-proxy/image-proxy.module';
import { ViewModule } from './modules/view/view.module';
import { AppJwtAuthModule } from './app-jwt-auth.module';

@Module({
  imports: [
    // 应用级 JWT 预认证中间件：解析 Authorization header 并持久化 userId 到 req.userContext
    // 必须放在 PlatformModule 之前，确保先运行（用 Proxy 防止被 UserContextMiddleware 覆盖）
    AppJwtAuthModule,
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    ImageProxyModule,
    QuestionBankModule,
    QuestionTagModule,
    SubjectModule,
    PracticeRecordModule,
    AuthModule,
    CheckinModule,
    QuestionModule,
    StatsModule,
    HealthModule,
    MonitorModule,
    UserSettingsModule,
    SmartPracticeModule,
    FavoriteGroupModule,
    AdminFeedbackModule,
    BankCollaborationModule,
    BankRatingModule,
    AdminOperationLogModule,
    SystemLogModule,
    // ====== @route-section: business-modules END ======
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}

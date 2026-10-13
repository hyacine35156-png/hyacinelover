import { Module } from '@nestjs/common';
import { ErrorReportController } from './error-report.controller';
import { PerformanceReportController } from './performance-report.controller';
import { ClientErrorController } from './client-error.controller';
import { ClientPerfController } from './client-perf.controller';
import { MonitorService } from './monitor.service';
import { AdminFeedbackModule } from '../admin-feedback/admin-feedback.module';

@Module({
  imports: [AdminFeedbackModule],
  controllers: [
    ErrorReportController,
    PerformanceReportController,
    ClientErrorController,
    ClientPerfController,
  ],
  providers: [MonitorService],
})
export class MonitorModule {}

export default MonitorModule;

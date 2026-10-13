import { Module } from '@nestjs/common';

import { AdminOperationLogController } from './admin-operation-log.controller';
import { AdminOperationLogService } from './admin-operation-log.service';

@Module({
  controllers: [AdminOperationLogController],
  providers: [AdminOperationLogService],
  exports: [AdminOperationLogService],
})
export class AdminOperationLogModule {}

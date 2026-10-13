import { Global, Module } from '@nestjs/common';

import { SystemLogController } from './system-log.controller';
import { SystemLogService } from './system-log.service';

@Global()
@Module({
  controllers: [SystemLogController],
  providers: [SystemLogService],
  exports: [SystemLogService],
})
export class SystemLogModule {}

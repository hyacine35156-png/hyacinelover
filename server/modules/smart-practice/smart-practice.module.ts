import { Module } from '@nestjs/common';
import { SmartPracticeController } from './smart-practice.controller';
import { SmartPracticeService } from './smart-practice.service';

@Module({
  controllers: [SmartPracticeController],
  providers: [SmartPracticeService],
})
export class SmartPracticeModule {}

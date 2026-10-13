import { Module } from '@nestjs/common';
import { PracticeRecordController } from './practice-record.controller';
import { PracticeRecordService } from './practice-record.service';
import { WrongBookController } from './wrong-book.controller';
import { WrongBookService } from './wrong-book.service';

@Module({
  controllers: [PracticeRecordController, WrongBookController],
  providers: [PracticeRecordService, WrongBookService],
})
export class PracticeRecordModule {}

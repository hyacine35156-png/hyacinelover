import { Module } from '@nestjs/common';
import { QuestionTagController } from './question-tag.controller';
import { QuestionTagService } from './question-tag.service';

@Module({
  controllers: [QuestionTagController],
  providers: [QuestionTagService],
  exports: [QuestionTagService],
})
export class QuestionTagModule {}

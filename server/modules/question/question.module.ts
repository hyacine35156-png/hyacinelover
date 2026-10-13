import { Module } from '@nestjs/common';

import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { AdminFeedbackModule } from '../admin-feedback/admin-feedback.module';

@Module({
  imports: [AdminFeedbackModule],
  controllers: [QuestionController],
  providers: [QuestionService],
})
export class QuestionModule {}

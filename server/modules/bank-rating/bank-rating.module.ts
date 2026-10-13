import { Module } from '@nestjs/common';

import { BankRatingController } from './bank-rating.controller';
import { BankRatingService } from './bank-rating.service';

@Module({
  controllers: [BankRatingController],
  providers: [BankRatingService],
  exports: [BankRatingService],
})
export class BankRatingModule {}

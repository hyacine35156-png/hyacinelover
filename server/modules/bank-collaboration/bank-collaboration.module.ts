import { Module } from '@nestjs/common';
import { BankCollaborationController } from './bank-collaboration.controller';
import { BankCollaborationService } from './bank-collaboration.service';

@Module({
  controllers: [BankCollaborationController],
  providers: [BankCollaborationService],
})
export class BankCollaborationModule {}

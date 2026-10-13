import { Module } from '@nestjs/common';
import { FavoriteGroupController } from './favorite-group.controller';
import { FavoriteGroupService } from './favorite-group.service';

@Module({
  controllers: [FavoriteGroupController],
  providers: [FavoriteGroupService],
  exports: [FavoriteGroupService],
})
export class FavoriteGroupModule {}

import { Module } from '@nestjs/common';
import { AnticheatService } from './anticheat.service';

@Module({
  providers: [AnticheatService],
  exports: [AnticheatService],
})
export class AnticheatModule {}

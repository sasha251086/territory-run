import { Module } from '@nestjs/common';
import { RivalsController } from './rivals.controller';
import { RivalsService } from './rivals.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RivalsController],
  providers: [RivalsService],
  exports: [RivalsService],
})
export class RivalsModule {}

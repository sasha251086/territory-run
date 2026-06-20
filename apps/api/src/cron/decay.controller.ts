import { Controller, Post, UseGuards } from '@nestjs/common';
import { DecayService } from './decay.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cron')
export class DecayController {
  constructor(private decayService: DecayService) {}

  @Post('decay')
  @UseGuards(JwtAuthGuard)
  async triggerDecay() {
    await this.decayService.runDecayManually();
    return { success: true, message: 'Decay triggered manually' };
  }
}

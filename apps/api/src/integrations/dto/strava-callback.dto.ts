import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StravaCallbackDto {
  @ApiProperty({ description: 'Authorization code from Strava OAuth redirect' })
  @IsString()
  code!: string;
}

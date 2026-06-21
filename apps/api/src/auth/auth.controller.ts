import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      example: {
        success: true,
        data: { accessToken: 'jwt', refreshToken: 'jwt' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email or nickname already exists',
    schema: {
      example: {
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already exists' },
      },
    },
  })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.nickname, body.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: { accessToken: 'jwt', refreshToken: 'jwt' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    schema: {
      example: {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      },
    },
  })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: { accessToken: 'jwt' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    schema: {
      example: {
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Refresh token is invalid or expired' },
      },
    },
  })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }
}

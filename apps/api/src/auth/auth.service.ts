import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, nickname: string, password: string) {
    const existingEmail = await this.usersService.findByEmail(email);
    if (existingEmail) {
      throw new ApiException(
        ErrorCodes.EMAIL_ALREADY_EXISTS,
        'Email already exists',
        HttpStatus.CONFLICT,
      );
    }

    const existingNickname = await this.usersService.findByNickname(nickname);
    if (existingNickname) {
      throw new ApiException(
        ErrorCodes.NICKNAME_ALREADY_EXISTS,
        'Nickname already exists',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(email, nickname, passwordHash);

    return this.generateTokens(user.id);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new ApiException(
        ErrorCodes.INVALID_CREDENTIALS,
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ApiException(
        ErrorCodes.INVALID_CREDENTIALS,
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.generateTokens(user.id);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.getRefreshSecret(),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new ApiException(
          ErrorCodes.TOKEN_EXPIRED,
          'Refresh token is invalid or expired',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const accessToken = this.jwtService.sign(
        { sub: payload.sub },
        { expiresIn: '15m', secret: this.getAccessSecret() },
      );

      return { accessToken };
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        ErrorCodes.TOKEN_EXPIRED,
        'Refresh token is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async generateTokens(userId: string) {
    const payload = { sub: userId };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: this.getAccessSecret(),
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
      secret: this.getRefreshSecret(),
    });
    return { accessToken, refreshToken };
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }

  private getAccessSecret(): string {
    return process.env.JWT_SECRET || 'default_secret_change_me';
  }

  private getRefreshSecret(): string {
    return (
      process.env.JWT_REFRESH_SECRET ||
      process.env.JWT_SECRET ||
      'default_refresh_secret_change_me'
    );
  }
}

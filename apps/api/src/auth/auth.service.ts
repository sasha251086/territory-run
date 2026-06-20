import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, nickname: string, password: string) {
    const existingEmail = await this.usersService.findByEmail(email);
    if (existingEmail) throw new ConflictException('Email already exists');

    const existingNickname = await this.usersService.findByNickname(nickname);
    if (existingNickname) throw new ConflictException('Nickname already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(email, nickname, passwordHash);

    return this.generateTokens(user.id);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(user.id);
  }

  async generateTokens(userId: string) {
    const payload = { sub: userId };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });
    return { accessToken, refreshToken };
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }
}

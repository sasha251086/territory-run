import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';

const mockUsersService = {
  findByEmail: jest.fn(),
  findByNickname: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockPrisma = {
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('refresh', () => {
    it('should return new tokens for a valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockUsersService.findById.mockResolvedValue({ id: 'user-1' });
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockJwtService.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw TOKEN_EXPIRED for invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('invalid-token')).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_EXPIRED,
      });
      await expect(service.refresh('invalid-token')).rejects.toBeInstanceOf(ApiException);
    });

    it('should throw TOKEN_EXPIRED when user no longer exists', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'missing-user' });
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        userId: 'missing-user',
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refresh('valid-refresh-token')).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_EXPIRED,
      });
    });
  });
});

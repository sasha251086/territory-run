import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('refresh', () => {
    it('should return a new access token for a valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockUsersService.findById.mockResolvedValue({ id: 'user-1' });
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: expect.any(String),
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
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refresh('valid-refresh-token')).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_EXPIRED,
      });
    });
  });
});

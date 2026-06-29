import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ApiException } from './api.exception';
import { ErrorCodes } from './error-codes';
import { captureException } from './sentry.util';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{
      method?: string;
      url?: string;
      user?: { id?: string };
    }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL_ERROR;
    let message = 'Internal server error';

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = ErrorCodes.RATE_LIMIT_EXCEEDED;
      message = 'Too many requests';
    } else if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      const body = exception.getResponse() as { message?: string };
      message = body.message || 'Error';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null && 'code' in body) {
        const typed = body as { code?: string; message?: string | string[] };
        code = typed.code || this.mapStatusToCode(status);
        message = this.extractMessage(typed.message) || exception.message;
      } else {
        code = this.mapStatusToCode(status, body);
        message = this.extractMessage(body) || exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error && exception.stack) {
      this.logger.error(exception.stack);
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      captureException(exception, {
        method: request.method,
        url: request.url,
        userId: request.user?.id,
        status,
        code,
      });
      this.logger.error({
        msg: message,
        err: exception,
        method: request.method,
        url: request.url,
        userId: request.user?.id,
        status,
        code,
      });
    }

    (response as { status: (code: number) => { json: (body: unknown) => void } })
      .status(status)
      .json({
        success: false,
        error: { code, message },
      });
  }

  private mapStatusToCode(status: number, body?: unknown): string {
    if (status === HttpStatus.BAD_REQUEST) {
      return ErrorCodes.VALIDATION_ERROR;
    }
    if (status === HttpStatus.UNAUTHORIZED) {
      return ErrorCodes.AUTH_REQUIRED;
    }
    if (status === HttpStatus.NOT_FOUND) {
      return ErrorCodes.NOT_FOUND;
    }
    if (status === HttpStatus.CONFLICT) {
      const text = this.extractMessage(body)?.toLowerCase() || '';
      if (text.includes('nickname')) {
        return ErrorCodes.NICKNAME_ALREADY_EXISTS;
      }
      return ErrorCodes.EMAIL_ALREADY_EXISTS;
    }
    return ErrorCodes.INTERNAL_ERROR;
  }

  private extractMessage(body: unknown): string | undefined {
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        return message.join('; ');
      }
      return message;
    }
    return undefined;
  }
}

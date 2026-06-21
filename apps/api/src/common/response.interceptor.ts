import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { serializeForJson } from './json-serialize.util';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        const serialized = serializeForJson(data);
        if (serialized && typeof serialized === 'object' && 'success' in serialized) {
          return serialized;
        }
        return { success: true, data: serialized };
      }),
    );
  }
}

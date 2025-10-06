import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { IdGeneratorUtil } from '../utils/id-generator.util';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    let request: unknown;
    let response: unknown;
    try {
      request = context.switchToHttp().getRequest?.();
    } catch {
      request = undefined;
    }
    try {
      response = context.switchToHttp().getResponse?.();
    } catch {
      response = undefined;
    }

    // Type guards for request/response
    const hasHeaders = (
      obj: unknown,
    ): obj is { headers: Record<string, string> } => {
      return (
        typeof obj === 'object' &&
        obj !== null &&
        'headers' in obj &&
        typeof (obj as { headers?: unknown }).headers === 'object'
      );
    };

    const canSetHeader = (
      obj: unknown,
    ): obj is { setHeader: (name: string, value: string) => void } => {
      return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof (obj as { setHeader?: unknown }).setHeader === 'function'
      );
    };

    // Generate or use existing request ID
    const requestId =
      hasHeaders(request) && typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : IdGeneratorUtil.generateRequestId();

    // Set request ID in request object for downstream use
    if (typeof request === 'object' && request !== null) {
      (request as { requestId?: string }).requestId = requestId;
    }

    // Set response header
    if (canSetHeader(response)) {
      response.setHeader('X-Request-ID', requestId);
    }

    return next.handle();
  }
}
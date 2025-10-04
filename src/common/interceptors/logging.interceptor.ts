import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, headers, body } = request;
    const requestId = request.requestId;
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(`Incoming ${method} ${url}`, {
      requestId,
      method,
      url,
      userAgent: headers['user-agent'],
      contentType: headers['content-type'],
      bodySize: JSON.stringify(body || {}).length,
    });

    return next.handle().pipe(
      tap((responseData) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log(`Outgoing ${method} ${url} - ${statusCode} in ${duration}ms`, {
          requestId,
          method,
          url,
          statusCode,
          duration,
          responseSize: JSON.stringify(responseData || {}).length,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode || 500;

        this.logger.error(`Error ${method} ${url} - ${statusCode} in ${duration}ms`, {
          requestId,
          method,
          url,
          statusCode,
          duration,
          error: error.message,
          stack: error.stack,
        });

        return throwError(() => error);
      }),
    );
  }
}
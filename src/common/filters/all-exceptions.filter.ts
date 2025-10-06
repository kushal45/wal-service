import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string;
    const timestamp = new Date().toISOString();

    let status: number;
    let errorResponse: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      errorResponse = {
        success: false,
        error: {
          code:
            typeof exceptionResponse === 'object'
              ? (exceptionResponse as any).error || 'HTTP_EXCEPTION'
              : 'HTTP_EXCEPTION',
          message:
            typeof exceptionResponse === 'object'
              ? (exceptionResponse as any).message || exception.message
              : exceptionResponse,
          details:
            typeof exceptionResponse === 'object'
              ? exceptionResponse
              : undefined,
        },
        metadata: {
          requestId,
          timestamp,
          path: request.url,
          method: request.method,
        },
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        metadata: {
          requestId,
          timestamp,
          path: request.url,
          method: request.method,
        },
      };
    }

    response.status(status).json(errorResponse);
  }
}

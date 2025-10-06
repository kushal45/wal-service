import { LoggingInterceptor } from './logging.interceptor';

import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockLogger: Partial<Logger>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    interceptor = new LoggingInterceptor();
    // @ts-ignore override private logger
    interceptor.logger = mockLogger as Logger;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log request and response details (positive)', (done) => {
    const mockRequest = {
      method: 'POST',
      url: '/api/test',
      headers: { 'user-agent': 'jest', 'content-type': 'application/json' },
      body: { foo: 'bar' },
      requestId: 'req-1',
    };
    const mockResponse = { statusCode: 200 };
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
    const mockHandler: CallHandler = {
      handle: () => of({ result: 'ok' }),
    };
    interceptor
      .intercept(mockContext as ExecutionContext, mockHandler)
      .subscribe({
        next: () => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('Incoming POST /api/test'),
            expect.objectContaining({
              requestId: 'req-1',
              method: 'POST',
              url: '/api/test',
            }),
          );
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('Outgoing POST /api/test'),
            expect.objectContaining({ statusCode: 200 }),
          );
          done();
        },
      });
  });

  it('should handle logging errors gracefully (negative)', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/api/error',
      headers: {},
      body: {},
      requestId: 'req-2',
    };
    const mockResponse = { statusCode: 500 };
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
    const mockHandler: CallHandler = {
      handle: () => throwError(() => new Error('Simulated error')),
    };
    interceptor
      .intercept(mockContext as ExecutionContext, mockHandler)
      .subscribe({
        error: (err) => {
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error GET /api/error'),
            expect.objectContaining({
              statusCode: 500,
              error: 'Simulated error',
            }),
          );
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('Simulated error');
          done();
        },
      });
  });

  it('should handle missing context data (edge)', (done) => {
    const mockRequest = {};
    const mockResponse = {};
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
    const mockHandler: CallHandler = {
      handle: () => of({}),
    };
    interceptor
      .intercept(mockContext as ExecutionContext, mockHandler)
      .subscribe({
        next: () => {
          expect(mockLogger.log).toHaveBeenCalled();
          done();
        },
      });
  });
});

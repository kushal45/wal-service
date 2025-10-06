import { RequestIdInterceptor } from './request-id.interceptor';

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { IdGeneratorUtil } from '../utils/id-generator.util';

describe('RequestIdInterceptor', () => {
  let interceptor: RequestIdInterceptor;

  beforeEach(() => {
    interceptor = new RequestIdInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should propagate request ID from header (positive)', (done) => {
    const mockRequest = { headers: { 'x-request-id': 'abc-123' } };
    const mockResponse = { setHeader: jest.fn() };
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
    const mockHandler: CallHandler = { handle: () => of('ok') };
    interceptor
      .intercept(mockContext as ExecutionContext, mockHandler)
      .subscribe({
        next: () => {
          expect(mockRequest.requestId).toBe('abc-123');
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Request-ID',
            'abc-123',
          );
          done();
        },
      });
  });

  it('should generate request ID if missing (negative)', (done) => {
    jest.spyOn(IdGeneratorUtil, 'generateRequestId').mockReturnValue('gen-456');
    const mockRequest = { headers: {} };
    const mockResponse = { setHeader: jest.fn() };
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
    const mockHandler: CallHandler = { handle: () => of('ok') };
    interceptor
      .intercept(mockContext as ExecutionContext, mockHandler)
      .subscribe({
        next: () => {
          expect(mockRequest.requestId).toBe('gen-456');
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Request-ID',
            'gen-456',
          );
          done();
        },
      });
  });

  it('should handle invalid context (edge)', (done) => {
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => undefined,
        getResponse: () => undefined,
      }),
    };
    const mockHandler: CallHandler = { handle: () => of('ok') };
    expect(() => {
      interceptor
        .intercept(mockContext as ExecutionContext, mockHandler)
        .subscribe({
          next: () => done(),
        });
    }).not.toThrow();
  });
});

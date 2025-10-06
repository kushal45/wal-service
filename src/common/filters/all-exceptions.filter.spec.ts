import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockRequest = {
      headers: { 'x-request-id': 'req_123' },
      url: '/api/test',
      method: 'POST',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should handle HttpException and format error response', () => {
    const exception = new HttpException(
      { error: 'TEST_ERROR', message: 'Test error occurred' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error occurred',
          details: { error: 'TEST_ERROR', message: 'Test error occurred' },
        },
        metadata: expect.objectContaining({
          requestId: 'req_123',
          path: '/api/test',
          method: 'POST',
        }),
      }),
    );
  });

  it('should handle non-HttpException and format generic error response', () => {
    const exception = new Error('Unexpected failure');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        metadata: expect.objectContaining({
          requestId: 'req_123',
          path: '/api/test',
          method: 'POST',
        }),
      }),
    );
  });

  it('should include timestamp in metadata', () => {
    const exception = new Error('Any error');
    filter.catch(exception, mockHost);
    const jsonArg = mockResponse.json.mock.calls[0][0];
    expect(jsonArg.metadata.timestamp).toBeDefined();
    expect(typeof jsonArg.metadata.timestamp).toBe('string');
  });
});

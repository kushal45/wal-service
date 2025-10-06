import { ApiKeyAuth, extractApiKey } from './api-key-auth.decorator';

describe('ApiKeyAuth Decorator', () => {
  it('should be defined', () => {
    expect(ApiKeyAuth).toBeDefined();
  });

  it('should extract API key from headers', () => {
    const mockCtx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-api-key': 'test-key' } }),
      }),
    };
    const result = extractApiKey(mockCtx);
    expect(result).toBe('test-key');
  });

  it('should fallback to request.apiKey if header missing', () => {
    const mockCtx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ apiKey: 'fallback-key', headers: {} }),
      }),
    };
    const result = extractApiKey(mockCtx);
    expect(result).toBe('fallback-key');
  });

  it('should return undefined if API key missing', () => {
    const mockCtx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    };
    const result = extractApiKey(mockCtx);
    expect(result).toBeUndefined();
  });

  it('should handle invalid API key format', () => {
    const mockCtx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-api-key': 12345 } }),
      }),
    };
    const result = extractApiKey(mockCtx);
    expect(result).toBe('12345');
  });
});

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export function extractApiKey(ctx: ExecutionContext): string | undefined {
  const request = ctx.switchToHttp().getRequest();
  if (typeof request !== 'object' || request === null) return undefined;
  const hasHeaders = (obj: unknown): obj is { headers: Record<string, any> } =>
    typeof obj === 'object' &&
    obj !== null &&
    'headers' in obj &&
    typeof (obj as any).headers === 'object';
  const hasApiKey = (obj: unknown): obj is { apiKey: any } =>
    typeof obj === 'object' && obj !== null && 'apiKey' in obj;
  if (
    hasHeaders(request) &&
    typeof request.headers['x-api-key'] !== 'undefined'
  ) {
    return String(request.headers['x-api-key']);
  }
  if (hasApiKey(request) && typeof request.apiKey !== 'undefined') {
    return String(request.apiKey);
  }
  return undefined;
}

export const ApiKeyAuth = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    return extractApiKey(ctx);
  },
);

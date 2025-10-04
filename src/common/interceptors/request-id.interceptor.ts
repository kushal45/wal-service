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
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Generate or use existing request ID
    const requestId = request.headers['x-request-id'] || IdGeneratorUtil.generateRequestId();
    
    // Set request ID in request object for downstream use
    request.requestId = requestId;
    
    // Set response header
    response.setHeader('X-Request-ID', requestId);

    return next.handle();
  }
}
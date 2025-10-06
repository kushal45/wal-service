import { HttpException, HttpStatus } from '@nestjs/common';

export class NamespaceNotFoundException extends HttpException {
  constructor(namespace: string) {
    super(
      {
        error: 'NAMESPACE_NOT_FOUND',
        message: `Namespace '${namespace}' not found`,
        namespace,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class MessageSizeLimitExceededException extends HttpException {
  constructor(actualSize: number, maxSize: number) {
    super(
      {
        error: 'MESSAGE_SIZE_LIMIT_EXCEEDED',
        message: `Message size ${actualSize} bytes exceeds limit of ${maxSize} bytes`,
        actualSize,
        maxSize,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ProducerUnavailableException extends HttpException {
  constructor(backend: string, error: string) {
    super(
      {
        error: 'PRODUCER_UNAVAILABLE',
        message: `Producer for backend '${backend}' is unavailable: ${error}`,
        backend,
        details: error,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

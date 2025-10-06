import {
  NamespaceNotFoundException,
  MessageSizeLimitExceededException,
  ProducerUnavailableException,
} from './wal.exceptions';

describe('WAL Exceptions', () => {
  it('NamespaceNotFoundException should set correct status and message', () => {
    const ex = new NamespaceNotFoundException('test-ns');
    expect(ex.getStatus()).toBe(404);
    expect(ex.getResponse()).toMatchObject({
      error: 'NAMESPACE_NOT_FOUND',
      message: "Namespace 'test-ns' not found",
      namespace: 'test-ns',
    });
  });

  it('MessageSizeLimitExceededException should set correct status and message', () => {
    const ex = new MessageSizeLimitExceededException(2048, 1024);
    expect(ex.getStatus()).toBe(400);
    expect(ex.getResponse()).toMatchObject({
      error: 'MESSAGE_SIZE_LIMIT_EXCEEDED',
      message: 'Message size 2048 bytes exceeds limit of 1024 bytes',
      actualSize: 2048,
      maxSize: 1024,
    });
  });

  it('ProducerUnavailableException should set correct status and message', () => {
    const ex = new ProducerUnavailableException('redis', 'connection refused');
    expect(ex.getStatus()).toBe(503);
    expect(ex.getResponse()).toMatchObject({
      error: 'PRODUCER_UNAVAILABLE',
      message: "Producer for backend 'redis' is unavailable: connection refused",
      backend: 'redis',
      details: 'connection refused',
    });
  });
});

import { IdGeneratorUtil } from './id-generator.util';

describe('IdGeneratorUtil', () => {
  it('should generate a valid message ID', () => {
    const id = IdGeneratorUtil.generateMessageId();
    expect(id).toMatch(/^wal_\d{13}_[a-f0-9]{16}$/);
  });

  it('should generate a valid transaction ID', () => {
    const id = IdGeneratorUtil.generateTransactionId();
    expect(id).toMatch(/^txn_\d{13}_[a-f0-9]{24}$/);
  });

  it('should generate a valid request ID', () => {
    const id = IdGeneratorUtil.generateRequestId();
    expect(id).toMatch(/^req_\d{13}_[a-f0-9]{12}$/);
  });

  it('should generate a valid correlation ID', () => {
    const id = IdGeneratorUtil.generateCorrelationId();
    expect(id).toMatch(/^cor_\d{13}_[a-f0-9]{16}$/);
  });

  it('should generate consistent shard key for same input', () => {
    const key1 = IdGeneratorUtil.generateShardKey('test', 10);
    const key2 = IdGeneratorUtil.generateShardKey('test', 10);
    expect(key1).toBe(key2);
    expect(key1).toBeGreaterThanOrEqual(0);
    expect(key1).toBeLessThan(10);
  });

  it('should generate different shard keys for different input', () => {
    const key1 = IdGeneratorUtil.generateShardKey('foo', 10);
    const key2 = IdGeneratorUtil.generateShardKey('bar', 10);
    expect(key1).not.toBe(key2);
  });

  it('should validate correct message ID format', () => {
    const id = IdGeneratorUtil.generateMessageId();
    expect(IdGeneratorUtil.isValidMessageId(id)).toBe(true);
    expect(IdGeneratorUtil.isValidMessageId('invalid')).toBe(false);
  });
});

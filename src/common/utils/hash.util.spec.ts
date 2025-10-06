import { HashUtil } from './hash.util';

describe('HashUtil', () => {
  it('should create SHA-256 hash as number', () => {
    const hash = HashUtil.hash('test');
    expect(typeof hash).toBe('number');
    expect(hash).toBeGreaterThanOrEqual(0);
  });

  it('should create SHA-256 hash as hex string', () => {
    const hex = HashUtil.hashToHex('test');
    expect(hex).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should create MD5 hash as hex string', () => {
    const md5 = HashUtil.md5Hash('test');
    expect(md5).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should create and verify HMAC signature', () => {
    const message = 'hello';
    const secret = 'supersecret';
    const signature = HashUtil.createHmac(message, secret);
    expect(HashUtil.verifyHmac(message, signature, secret)).toBe(true);
    expect(HashUtil.verifyHmac(message, 'invalid', secret)).toBe(false);
  });

  it('should produce consistent hash for load balancing', () => {
    const bucket1 = HashUtil.consistentHash('foo', 10);
    const bucket2 = HashUtil.consistentHash('foo', 10);
    expect(bucket1).toBe(bucket2);
    expect(bucket1).toBeGreaterThanOrEqual(0);
    expect(bucket1).toBeLessThan(10);
  });

  it('should produce different buckets for different input', () => {
    const bucket1 = HashUtil.consistentHash('foo', 10);
    const bucket2 = HashUtil.consistentHash('bar', 10);
    expect(bucket1).not.toBe(bucket2);
  });

  it('should safely compare strings', () => {
  // @ts-expect-error: Testing private method
  expect(HashUtil['safeCompare']('abc', 'abc')).toBe(true);
  // @ts-expect-error: Testing private method
  expect(HashUtil['safeCompare']('abc', 'def')).toBe(false);
  // @ts-expect-error: Testing private method
  expect(HashUtil['safeCompare']('abc', 'abcd')).toBe(false);
  });
});

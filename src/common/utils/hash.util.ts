import { createHash, createHmac } from 'crypto';

export class HashUtil {
  /**
   * Creates SHA-256 hash of input string
   */
  static hash(input: string): number {
    const hash = createHash('sha256').update(input).digest('hex');
    // Convert first 8 characters of hash to number for partitioning
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Creates SHA-256 hash and returns as hex string
   */
  static hashToHex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Creates MD5 hash for non-cryptographic use cases
   */
  static md5Hash(input: string): string {
    return createHash('md5').update(input).digest('hex');
  }

  /**
   * Creates HMAC signature for message integrity
   */
  static createHmac(message: string, secret: string, algorithm = 'sha256'): string {
    return createHmac(algorithm, secret).update(message).digest('hex');
  }

  /**
   * Verifies HMAC signature
   */
  static verifyHmac(
    message: string,
    signature: string,
    secret: string,
    algorithm = 'sha256',
  ): boolean {
    const expectedSignature = this.createHmac(message, secret, algorithm);
    return this.safeCompare(signature, expectedSignature);
  }

  /**
   * Consistent hash function for load balancing
   */
  static consistentHash(input: string, bucketCount: number): number {
    const hash = this.hash(input);
    return Math.abs(hash) % bucketCount;
  }

  /**
   * Safe string comparison to prevent timing attacks
   */
  private static safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Generates checksum for data integrity verification
   */
  static generateChecksum(data: any): string {
    const serializedData = JSON.stringify(data, Object.keys(data).sort());
    return this.hashToHex(serializedData).substring(0, 16);
  }

  /**
   * Verifies data integrity using checksum
   */
  static verifyChecksum(data: any, expectedChecksum: string): boolean {
    const actualChecksum = this.generateChecksum(data);
    return this.safeCompare(actualChecksum, expectedChecksum);
  }
}
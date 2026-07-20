import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string) {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

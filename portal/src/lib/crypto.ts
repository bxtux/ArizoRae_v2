import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from './env';

function derivedKey(): Buffer {
  return createHash('sha256').update(`${env.AUTH_SECRET_KEY}:anthropic-key`).digest();
}

export function encryptApiKey(plaintext: string): string {
  const key = derivedKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptApiKey(ciphertext: string): string {
  const key = derivedKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

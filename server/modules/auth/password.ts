import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/** Password hashing with scrypt and a per-user salt, stored as `scrypt$<salt hex>$<key hex>`. */

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const key = await derive(password, Buffer.from(saltHex, 'hex'));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Checked against when the email has no account, so timing doesn't reveal which emails exist. */
export const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(KEY_LENGTH)}`;

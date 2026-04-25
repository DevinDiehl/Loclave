
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
export interface EncryptedPayload {
  iv:         string;
  authTag:    string;
  ciphertext: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Encrypts a plain-text password string using AES-256-GCM.
 *
 * A fresh random IV is generated on every call — never reuse an IV
 * with the same key. The GCM auth tag protects against tampering.
 *
 * @param plaintext   The raw password string to encrypt
 * @param sessionKey  The active session key buffer from session.ts
 * @returns           EncryptedPayload — serialize with encryptToString()
 * @throws            If sessionKey is null
 */
export function encryptPassword(plaintext: string, sessionKey: Buffer): EncryptedPayload {
  const iv     = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, sessionKey, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    iv:         iv.toString('hex'),
    authTag:    cipher.getAuthTag().toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

/**
 * Decrypts an EncryptedPayload back to the original plain-text password.
 *
 * The GCM auth tag is verified automatically — if the stored data has
 * been tampered with, this will throw before returning anything.
 *
 * @param payload     The EncryptedPayload from the database
 * @param sessionKey  The active session key buffer from session.ts
 * @returns           The original plain-text password
 * @throws            If sessionKey is null, or if auth tag verification fails
 */
export function decryptPassword(payload: EncryptedPayload, sessionKey: Buffer): string {
  const iv         = Buffer.from(payload.iv,         'hex');
  const authTag    = Buffer.from(payload.authTag,    'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const decipher = createDecipheriv(ALGORITHM, sessionKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}


/**
 * Encrypts a password and serializes the result to a JSON string
 * ready to store directly in the database password field.
 *
 * @param plaintext   Raw password string
 * @param sessionKey  Active session key buffer
 * @returns           JSON string — store this in the db
 */
export function encryptToString(plaintext: string, sessionKey: Buffer): string {
  return JSON.stringify(encryptPassword(plaintext, sessionKey));
}

/**
 * Deserializes a JSON string from the database and decrypts it.
 *
 * @param stored      JSON string from the db password field
 * @param sessionKey  Active session key buffer
 * @returns           Original plain-text password
 */
export function decryptFromString(stored: string, sessionKey: Buffer): string {
  return decryptPassword(JSON.parse(stored) as EncryptedPayload, sessionKey);
}
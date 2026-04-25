import { scryptSync, randomBytes } from 'crypto';
import { hash, verify }            from '@node-rs/argon2';
import {
  saveKeyToKeychain,
  clearKeyFromKeychain,
} from '../cryptography/keychain';


type LockCallback = () => void;

const KEY_LENGTH         = 32;   
const SALT_LENGTH        = 32;   
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; 

let sessionKey:     Buffer | null = null;
let lockTimer:      ReturnType<typeof setTimeout> | null = null;
let lockTimeoutMs:  number        = DEFAULT_TIMEOUT_MS;
let onLockCallback: LockCallback | null = null;

/**
 * Hashes the master password with argon2id.
 * Store the returned string in your settings table as 'master_hash'.
 *
 * @param masterPassword  Plain-text password entered by the user
 * @returns               argon2id hash string (includes salt internally)
 */
export async function hashMasterPassword(masterPassword: string): Promise<string> {
  return await hash(masterPassword, {
    algorithm:   2,      // 2 = Argon2id (most secure variant)
    memoryCost:  65536,  // 64 MB memory usage
    timeCost:    3,      // 3 iterations
    parallelism: 1,
  });
}

/**
 * Verifies a plain-text password against the stored argon2 hash.
 *
 * @param storedHash      The hash string from settings
 * @param masterPassword  Plain-text password to check
 * @returns               true if the password matches
 */
export async function verifyMasterPassword(
  storedHash:     string,
  masterPassword: string,
): Promise<boolean> {
  return await verify(storedHash, masterPassword);
}

/**
 * Derives a 256-bit AES key from the master password + salt using scrypt.
 *
 * On first launch, omit saltHex to generate a new salt.
 * On subsequent unlocks, pass the salt stored in settings as 'key_salt'.
 *
 * @param masterPassword  Plain-text master password
 * @param saltHex         Hex-encoded salt (omit on first launch)
 * @returns               { key: Buffer, saltHex: string }
 */
export function deriveKey(
  masterPassword: string,
  saltHex?:       string,
): { key: Buffer; saltHex: string } {
  const salt = saltHex
    ? Buffer.from(saltHex, 'hex')
    : randomBytes(SALT_LENGTH);

  const key = scryptSync(masterPassword, salt, KEY_LENGTH, {
    N: 16384,
    r: 8,
    p: 1,
  });

  return {
    key,
    saltHex: salt.toString('hex'),
  };
}

/**
 * Unlocks the app — sets the in-memory session key, persists it to
 * the Keychain, and starts the idle lock timer.
 *
 * Call this after successfully verifying the master password.
 *
 * @param key  Derived key buffer from deriveKey()
 */
export async function unlockSession(key: Buffer): Promise<void> {
  sessionKey = key;
  await saveKeyToKeychain(key);
  resetLockTimer();
}

/**
 * Locks the app — clears the in-memory session key and stops the timer.
 * Does NOT remove the Keychain entry so the user can re-unlock
 * without re-entering their master password.
 *
 * Fires the registered onLock callback so the renderer can show
 * the lock screen.
 */
export function lockSession(): void {
  sessionKey = null;
  clearLockTimer();
  onLockCallback?.();
}

/**
 * Fully logs out — clears the in-memory key AND removes the Keychain entry.
 * The user must re-enter their master password on next launch.
 */
export async function logoutSession(): Promise<void> {
  sessionKey = null;
  clearLockTimer();
  await clearKeyFromKeychain();
  onLockCallback?.();
}

/**
 * @returns the current session key, or null if locked.
 * Pass this into encryptPassword() / decryptPassword() in encryption.ts.
 */
export function getSessionKey(): Buffer | null {
  return sessionKey;
}

/**
 * @returns true if the app is currently unlocked.
 */
export function isUnlocked(): boolean {
  return sessionKey !== null;
}

/**
 * Registers a callback that fires whenever the app locks (idle timeout
 * or explicit lock). Use this in main.ts to notify the renderer.
 *
 * @param cb  Function to call on lock
 */
export function onLock(cb: LockCallback): void {
  onLockCallback = cb;
}

/**
 * Sets the idle timeout duration.
 * Call on startup after reading the user's preference from settings.
 *
 * @param ms  Milliseconds before auto-lock
 */
export function setLockTimeout(ms: number): void {
  lockTimeoutMs = ms;
}

/**
 * Resets the idle timer back to the full duration.
 * Call this from main.ts on any user activity (mouse, keyboard, IPC).
 */
export function resetLockTimer(): void {
  clearLockTimer();
  lockTimer = setTimeout(() => {
    console.log('[session] Idle timeout — locking session.');
    lockSession();
  }, lockTimeoutMs);
}

function clearLockTimer(): void {
  if (lockTimer) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }
}
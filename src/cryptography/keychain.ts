import keytar from 'keytar';

const KEYCHAIN_SERVICE = 'com.devindiehl.loclave';
const KEYCHAIN_ACCOUNT = 'session-key';

/**
 * Saves the derived session key to the macOS Keychain.
 * This allows the app to stay unlocked across restarts without
 * requiring the master password to be re-entered every launch.
 *
 * @param key  The derived key buffer from crypto.ts
 */
export async function saveKeyToKeychain(key: Buffer): Promise<void> {
  await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, key.toString('hex'));
}

/**
 * Loads the derived session key from the macOS Keychain.
 * Returns null if no key is stored (first launch or after logout).
 *
 * @returns  The derived key buffer, or null if not found
 */
export async function loadKeyFromKeychain(): Promise<Buffer | null> {
  const hex = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  return hex ? Buffer.from(hex, 'hex') : null;
}

/**
 * @removes the derived session key from the macOS Keychain.
 * Call this on explicit logout or when the master password changes.
 */
export async function clearKeyFromKeychain(): Promise<void> {
  await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
}

/**
 * @returns true if a session key currently exists in the Keychain.
 * Useful for deciding whether to show the unlock screen on launch.
 */
export async function hasKeychainKey(): Promise<boolean> {
  const hex = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  return hex !== null;
}

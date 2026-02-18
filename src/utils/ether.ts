// normalizeKey removes the "0x" prefix from a hexadecimal string if it exists, ensuring a consistent format for key identifiers.
export function normalizeKey(keyId: string): string {
  return keyId.startsWith("0x") ? keyId.slice(2) : keyId;
}

// add hex prefix if missing, ensuring the key is in the correct format for cryptographic operations
export function addHexPrefix(keyId: string): string {
  return keyId.startsWith("0x") ? keyId : `0x${keyId}`;
}

/**
 * データを暗号化（AES-256-GCM）
 */
export async function encrypt(data: string, key: string): Promise<string> {
  if (key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const keyBuffer = encoder.encode(key.substring(0, 32));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );

  const encrypted = new Uint8Array(encryptedBuffer);
  const result = new Uint8Array(iv.length + encrypted.length);
  result.set(iv);
  result.set(encrypted, iv.length);

  return btoa(String.fromCharCode(...result));
}

/**
 * データを復号化（AES-256-GCM）
 */
export async function decrypt(encrypted: string, key: string): Promise<string> {
  if (key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(key.substring(0, 32));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const encryptedData = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

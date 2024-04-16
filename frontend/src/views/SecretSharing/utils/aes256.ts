export const uin8ArrayToBase64 = (buff: Uint8Array) =>
  btoa(new Uint8Array(buff).reduce((data, byte) => data + String.fromCharCode(byte), ""));

export const base64ToBuffer = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const getPasswordKey = (password: string) =>
  window.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);

const deriveKey = (passwordKey: CryptoKey, salt: BufferSource, keyUsage: KeyUsage[]) =>
  window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    keyUsage
  );

export async function encrypt(data: string, password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt, ["encrypt"]);
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    aesKey,
    encoder.encode(data)
  );

  const encryptedContentArr = new Uint8Array(encryptedContent);
  const buffer = new Uint8Array(salt.byteLength + iv.byteLength + encryptedContentArr.byteLength);
  buffer.set(salt, 0);
  buffer.set(iv, salt.byteLength);
  buffer.set(encryptedContentArr, salt.byteLength + iv.byteLength);
  const base64Buff = uin8ArrayToBase64(buffer);
  return base64Buff;
}

export async function decrypt(encryptedData: string, password: string) {
  const encryptedDataBuff = base64ToBuffer(encryptedData);
  const salt = encryptedDataBuff.slice(0, 16);
  const iv = encryptedDataBuff.slice(16, 16 + 12);
  const data = encryptedDataBuff.slice(16 + 12);
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt, ["decrypt"]);
  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    aesKey,
    data
  );
  return decoder.decode(decryptedContent);
}

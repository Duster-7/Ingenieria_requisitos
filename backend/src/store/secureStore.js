/**
 * RNF-02 — Persistencia del expediente clínico cifrado en reposo con AES-256-GCM.
 *
 * Formato del archivo: JSON { v, alg, iv, tag, data } donde `data` es el
 * contenido cifrado en base64. Nunca se escribe información clínica en claro.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALG = 'aes-256-gcm';

export function resolveKey(hex) {
  if (hex) {
    const key = Buffer.from(hex, 'hex');
    if (key.length !== 32) {
      throw new Error('DATA_ENCRYPTION_KEY debe tener 32 bytes (64 caracteres hexadecimales) para AES-256');
    }
    return key;
  }
  console.warn('[seguridad] DATA_ENCRYPTION_KEY no definida: se usa una clave de desarrollo derivada. NO usar en producción.');
  return scryptSync('mediguard-dev-passphrase', 'mediguard-salt', 32);
}

export function encrypt(obj, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return {
    v: 1,
    alg: ALG,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  };
}

export function decrypt(envelope, key) {
  const decipher = createDecipheriv(ALG, key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

export class SecureFileStore {
  constructor(filePath, key) {
    this.filePath = filePath;
    this.key = key;
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return null;
    const envelope = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    return decrypt(envelope, this.key);
  }

  save(state) {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(encrypt(state, this.key)));
    fs.renameSync(tmp, this.filePath);
  }
}

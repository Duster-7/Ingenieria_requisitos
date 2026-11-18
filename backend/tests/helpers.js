import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { createContainer } from '../src/container.js';
import { createApp } from '../src/app.js';

export const KEY_HEX = 'a'.repeat(64);

export function crearEntorno() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediguard-'));
  const config = loadConfig({
    dataFile: path.join(dir, 'datos.enc'),
    encryptionKeyHex: KEY_HEX,
    jwtSecret: 'test-secret',
    gatewayApiKey: 'gw-test',
    gatewayLatencyMs: 5,
    persistDebounceMs: 10,
    thresholds: { hrHigh: 140, hrLow: 45, anaphylaxis: 0.7 },
    simulator: { enabled: false }
  });
  const ctx = createContainer(config);
  const app = createApp(ctx, { logRequests: false });
  const api = request(app);

  const login = async (rfid = 'RFID-MED-001') => (await api.post('/api/auth/rfid').send({ rfid })).body.token;
  const enviar = (lectura) => api.post('/api/gateway/telemetry').set('x-gateway-key', 'gw-test').send(lectura);

  return { ctx, app, api, login, enviar, dir, config };
}

import 'dotenv/config';

const num = (v, def) => (v === undefined || v === '' ? def : Number(v));
const bool = (v, def) => (v === undefined || v === '' ? def : v === 'true' || v === '1');

/**
 * Construye la configuración a partir de variables de entorno.
 * Se pueden pasar `overrides` (útil en pruebas).
 */
export function loadConfig(overrides = {}) {
  const base = {
    port: num(process.env.PORT, 3000),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    jwtSecret: process.env.JWT_SECRET || 'mediguard-dev-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    encryptionKeyHex: process.env.DATA_ENCRYPTION_KEY || '',
    gatewayApiKey: process.env.GATEWAY_API_KEY || 'gw-uci-demo-key',
    dataFile: process.env.DATA_FILE || './data/mediguard.enc',
    thresholds: {
      hrHigh: num(process.env.HR_HIGH, 140),
      hrLow: num(process.env.HR_LOW, 45),
      anaphylaxis: num(process.env.ANAPHYLAXIS_THRESHOLD, 0.7)
    },
    simulator: {
      enabled: bool(process.env.SIMULATOR_ENABLED, true),
      intervalMs: num(process.env.SIMULATOR_INTERVAL_MS, 1000),
      packetLoss: num(process.env.SIMULATOR_PACKET_LOSS, 0)
    },
    persistDebounceMs: 3000,
    maxReadings: 50000
  };
  return {
    ...base,
    ...overrides,
    thresholds: { ...base.thresholds, ...(overrides.thresholds || {}) },
    simulator: { ...base.simulator, ...(overrides.simulator || {}) }
  };
}

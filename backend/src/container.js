/**
 * Composición de dependencias (componentes del Diagrama de Clases).
 */
import { EventEmitter } from 'node:events';
import { resolveKey, SecureFileStore } from './store/secureStore.js';
import { Repository } from './store/repository.js';
import { MonitoringService } from './services/monitoringService.js';
import { MetricsService } from './services/metricsService.js';
import { NotificationService } from './services/notificationService.js';
import { AlarmService } from './services/alarmService.js';
import { AnaphylaxisDetector } from './services/anaphylaxisDetector.js';
import { GatewayService } from './services/gatewayService.js';
import { IncidentService } from './services/incidentService.js';
import { TelemetryService } from './services/telemetryService.js';
import { AuthService } from './services/authService.js';
import { SensorSimulator } from './simulator/sensorSimulator.js';

export function createContainer(config) {
  const bus = new EventEmitter();
  bus.setMaxListeners(50);

  const key = resolveKey(config.encryptionKeyHex);
  const secureStore = config.dataFile ? new SecureFileStore(config.dataFile, key) : null;
  const repo = new Repository({ secureStore, persistDebounceMs: config.persistDebounceMs, maxReadings: config.maxReadings });

  // Umbrales: valores del .env sobrescritos por la configuración guardada (PUT /api/config)
  const getThresholds = () => ({ ...config.thresholds, ...(repo.state.configuracion || {}) });

  const metrics = new MetricsService();
  const monitoring = new MonitoringService({ repo, bus });
  const notifications = new NotificationService({ bus });
  const alarms = new AlarmService({ repo, bus, monitoring, notifications, getThresholds });
  const gateway = new GatewayService({ repo, bus, monitoring, latenciaRedMs: config.gatewayLatencyMs ?? 40 });
  const incidents = new IncidentService({ repo, bus, monitoring, alarms, notifications, gateway });
  const detector = new AnaphylaxisDetector({
    repo,
    getThresholds,
    onDeteccion: (d) => incidents.registrarDeteccion(d)
  });
  const telemetry = new TelemetryService({ repo, bus, metrics, monitoring, alarms, detector });
  const auth = new AuthService({ repo, jwtSecret: config.jwtSecret, jwtExpiresIn: config.jwtExpiresIn });
  const simulator = new SensorSimulator({
    repo,
    telemetry,
    intervalMs: config.simulator.intervalMs,
    packetLoss: config.simulator.packetLoss
  });

  return { config, bus, repo, getThresholds, metrics, monitoring, notifications, alarms, gateway, incidents, detector, telemetry, auth, simulator };
}

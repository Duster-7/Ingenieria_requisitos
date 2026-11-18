import http from 'node:http';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';
import { attachSocket } from './realtime/socket.js';

const config = loadConfig();
const ctx = createContainer(config);
const app = createApp(ctx);
const server = http.createServer(app);
attachSocket(server, ctx);

ctx.monitoring.iniciarWatchdog();
if (config.simulator.enabled) ctx.simulator.iniciar();

server.listen(config.port, () => {
  console.log(`\n  MediGuard IoT backend escuchando en http://localhost:${config.port}`);
  console.log('  Tarjetas RFID de prueba: RFID-MED-001 · RFID-MED-002 (médicos) · RFID-ENF-001 (enfermera)\n');
});

const apagar = () => {
  console.log('\nGuardando datos cifrados y cerrando...');
  ctx.simulator.detener();
  ctx.monitoring.detener();
  ctx.repo.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);

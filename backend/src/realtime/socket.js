/**
 * Canal en tiempo real (Socket.IO) entre la plataforma central y los clientes
 * (pantalla bedside y app móvil). Publica telemetría, alarmas, incidentes y
 * notificaciones push (RF-06).
 */
import { Server } from 'socket.io';
import { Ev } from '../services/events.js';

export function attachSocket(httpServer, ctx) {
  const io = new Server(httpServer, {
    cors: { origin: ctx.config.corsOrigin.split(','), credentials: true }
  });

  io.use((socket, next) => {
    try {
      socket.data.usuario = ctx.auth.verificar(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('No autorizado'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.usuario;
    socket.join('clinicos');
    socket.join(u.rol);

    // RNF-01: la pantalla reporta la latencia E2E medida (sensor -> render)
    socket.on('metricas:latencia', (muestras) => {
      if (Array.isArray(muestras)) muestras.slice(0, 200).forEach((ms) => ctx.metrics.registrarE2E(Number(ms)));
    });
  });

  // Enrutamiento bus interno -> clientes
  const aClinicos = [Ev.TELEMETRIA, Ev.ALARMA_NUEVA, Ev.ALARMA_ACTUALIZADA, Ev.INCIDENTE_NUEVO, Ev.INCIDENTE_ACTUALIZADO, Ev.ORDEN_PARO, Ev.BOMBA_ESTADO, Ev.PACIENTE_ESTADO];
  for (const ev of aClinicos) {
    ctx.bus.on(ev, (payload) => {
      if (ev === Ev.TELEMETRIA) payload = { ...payload, timestampServidor: new Date().toISOString() };
      io.to('clinicos').emit(ev, payload);
    });
  }
  ctx.bus.on(Ev.NOTIFICACION_PUSH, (n) => io.to('MEDICO').emit(Ev.NOTIFICACION_PUSH, n));

  return io;
}

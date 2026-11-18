import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { requireAuth, requireGateway } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patients.routes.js';
import alarmRoutes from './routes/alarms.routes.js';
import incidentRoutes from './routes/incidents.routes.js';
import systemRoutes from './routes/system.routes.js';
import gatewayRoutes from './routes/gateway.routes.js';

export function createApp(ctx, { logRequests = true } = {}) {
  const app = express();
  const auth = requireAuth(ctx.auth);

  app.use(helmet());
  app.use(cors({ origin: ctx.config.corsOrigin.split(','), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (logRequests) app.use(morgan('dev', { skip: (req) => req.originalUrl.startsWith('/api/gateway') }));

  // RNF-03: endpoint de salud para monitorización de disponibilidad
  app.get('/api/health', (_req, res) => {
    res.json({ estado: 'OK', servicio: 'mediguard-iot-backend', uptimeSeg: Math.round(process.uptime()), fecha: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes(ctx, auth));
  app.use('/api/gateway', requireGateway(ctx.config.gatewayApiKey), gatewayRoutes(ctx));
  app.use('/api/patients', auth, patientRoutes(ctx));
  app.use('/api/alarms', auth, alarmRoutes(ctx));
  app.use('/api/incidents', auth, incidentRoutes(ctx));
  app.use('/api', auth, systemRoutes(ctx));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

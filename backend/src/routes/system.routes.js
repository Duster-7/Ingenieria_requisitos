import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../services/events.js';

/** Configuración de umbrales, métricas RNF, auditoría, notificaciones y simulador. */
export default function systemRoutes({ repo, getThresholds, metrics, notifications, simulator }) {
  const r = Router();

  r.get('/config', (_req, res) => res.json(getThresholds()));

  r.put('/config', requireRole('MEDICO'), (req, res) => {
    const { hrHigh, hrLow, anaphylaxis } = req.body || {};
    const nueva = { ...(repo.state.configuracion || {}) };
    if (hrHigh !== undefined) nueva.hrHigh = Number(hrHigh);
    if (hrLow !== undefined) nueva.hrLow = Number(hrLow);
    if (anaphylaxis !== undefined) nueva.anaphylaxis = Number(anaphylaxis);
    const final = { ...getThresholds(), ...nueva };
    if (!(final.hrLow > 0 && final.hrHigh > final.hrLow && final.hrHigh < 300)) throw new AppError(400, 'Umbrales de FC inválidos');
    if (!(final.anaphylaxis > 0 && final.anaphylaxis <= 1)) throw new AppError(400, 'El umbral de anafilaxia debe estar entre 0 y 1');
    repo.state.configuracion = nueva;
    repo.audit({ accion: 'CONFIGURACION_ACTUALIZADA', usuario: req.usuario, detalle: nueva });
    res.json(getThresholds());
  });

  r.get('/metrics', (_req, res) => res.json(metrics.snapshot()));

  r.get('/audit', (req, res) => {
    res.json(repo.listAudit({ pacienteId: req.query.pacienteId, limite: Math.min(Number(req.query.limite) || 200, 2000) }));
  });

  r.get('/notifications', (_req, res) => res.json(notifications.listar()));

  r.get('/simulator', (_req, res) => res.json(simulator.listar()));

  r.post('/simulator/:pacienteId/scenario', (req, res) => {
    const info = simulator.setEscenario(req.params.pacienteId, String(req.body?.escenario || '').toUpperCase());
    repo.audit({ accion: 'ESCENARIO_SIMULADOR', usuario: req.usuario, pacienteId: req.params.pacienteId, detalle: info });
    res.json(info);
  });

  return r;
}

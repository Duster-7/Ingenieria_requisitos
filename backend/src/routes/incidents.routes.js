import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';

/** UC-05 Detectar anafilaxia · UC-06 Detener infusión · UC-07 Reporte (RF-08, RF-09, RF-10) */
export default function incidentRoutes({ repo, incidents }) {
  const r = Router();

  r.get('/', (req, res) => {
    const { estado, pacienteId } = req.query;
    res.json(repo.listIncidents({ estado, pacienteId }));
  });

  r.get('/:id', (req, res) => {
    res.json(incidents._get(req.params.id));
  });

  // RF-09: confirmación médica -> orden de paro al gateway
  r.post('/:id/confirm', requireRole('MEDICO'), async (req, res) => {
    res.json(await incidents.confirmar(req.params.id, req.usuario));
  });

  r.post('/:id/discard', requireRole('MEDICO'), (req, res) => {
    res.json(incidents.descartar(req.params.id, req.usuario, req.body?.motivo));
  });

  r.post('/:id/resolve', requireRole('MEDICO'), (req, res) => {
    res.json(incidents.resolver(req.params.id, req.usuario, req.body?.nota));
  });

  // RF-10: reporte consolidado
  r.get('/:id/report', requireRole('MEDICO'), (req, res) => {
    res.json(incidents.reporte(req.params.id));
  });

  return r;
}

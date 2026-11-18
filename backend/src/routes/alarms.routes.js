import { Router } from 'express';

/** UC-03 Gestionar alarma crítica (RF-01, RF-07) */
export default function alarmRoutes({ repo, alarms }) {
  const r = Router();

  r.get('/', (req, res) => {
    const { estado, pacienteId } = req.query;
    const limite = Math.min(Number(req.query.limite) || 200, 1000);
    res.json(repo.listAlarms({ estado, pacienteId }).slice(0, limite));
  });

  r.post('/:id/ack', (req, res) => {
    res.json(alarms.confirmar(req.params.id, req.usuario));
  });

  return r;
}

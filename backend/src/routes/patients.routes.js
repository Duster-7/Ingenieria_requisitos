import { Router } from 'express';
import { AppError } from '../services/events.js';
import { TipoSigno } from '../domain/entities.js';
import { requireRole } from '../middleware/auth.js';

/** UC-01 Monitorizar paciente · UC-02 Consultar historial (RF-03) */
export default function patientRoutes({ repo, gateway }) {
  const r = Router();

  const conResumen = (p) => ({
    ...p,
    ultimasLecturas: repo.latestReadings(p.id),
    alarmasActivas: repo.listAlarms({ pacienteId: p.id, estado: 'ACTIVA' }).length,
    incidenteAbierto: repo.findOpenIncident(p.id)?.id ?? null
  });

  const getPaciente = (id) => {
    const p = repo.findPatient(id);
    if (!p) throw new AppError(404, 'Paciente no encontrado');
    return p;
  };

  r.get('/', (_req, res) => {
    res.json(repo.listPatients().map(conResumen));
  });

  r.get('/:id', (req, res) => {
    res.json(conResumen(getPaciente(req.params.id)));
  });

  // RF-03: historial por rango de fecha y tipo de signo vital
  r.get('/:id/vitals', (req, res) => {
    const p = getPaciente(req.params.id);
    const { tipo, desde, hasta } = req.query;
    if (tipo && !Object.values(TipoSigno).includes(tipo)) throw new AppError(400, 'tipo debe ser FC, SPO2, PA o TEMP');
    if (desde && Number.isNaN(Date.parse(desde))) throw new AppError(400, 'desde no es una fecha válida');
    if (hasta && Number.isNaN(Date.parse(hasta))) throw new AppError(400, 'hasta no es una fecha válida');
    const limite = Math.min(Number(req.query.limite) || 2000, 10000);
    const lecturas = repo.queryReadings({
      pacienteId: p.id,
      tipo,
      desde: desde ? new Date(desde).toISOString() : undefined,
      hasta: hasta ? new Date(hasta).toISOString() : undefined,
      limite
    });
    res.json({ pacienteId: p.id, tipo: tipo || 'TODOS', desde: desde || null, hasta: hasta || null, total: lecturas.length, lecturas });
  });

  r.get('/:id/alarms', (req, res) => {
    getPaciente(req.params.id);
    res.json(repo.listAlarms({ pacienteId: req.params.id }));
  });

  r.post('/:id/pump/resume', requireRole('MEDICO'), (req, res) => {
    getPaciente(req.params.id);
    res.json(gateway.reanudarInfusion(req.params.id, req.usuario));
  });

  return r;
}

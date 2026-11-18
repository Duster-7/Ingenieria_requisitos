/**
 * RF-02 — Recepción y transmisión de lecturas (FC, SpO2, PA, TEMP)
 * sensor -> gateway -> plataforma central, conservando paciente y marca de tiempo.
 */
import { crearLectura, TipoSigno } from '../domain/entities.js';
import { Ev, AppError } from './events.js';

const RANGOS = {
  FC: [0, 300],
  SPO2: [0, 100],
  TEMP: [25, 45]
};

export function validarLectura(dto, repo) {
  const { pacienteId, tipo, valor } = dto || {};
  if (!pacienteId || !repo.findPatient(pacienteId)) throw new AppError(400, 'pacienteId inválido o inexistente');
  if (!Object.values(TipoSigno).includes(tipo)) throw new AppError(400, 'tipo debe ser FC, SPO2, PA o TEMP');
  if (tipo === TipoSigno.PA) {
    if (!valor || !Number.isFinite(valor.sistolica) || !Number.isFinite(valor.diastolica)) {
      throw new AppError(400, 'PA requiere valor { sistolica, diastolica }');
    }
  } else {
    const [min, max] = RANGOS[tipo];
    if (!Number.isFinite(valor) || valor < min || valor > max) throw new AppError(400, `valor fuera de rango para ${tipo}`);
  }
  if (dto.timestampSensor && Number.isNaN(Date.parse(dto.timestampSensor))) {
    throw new AppError(400, 'timestampSensor debe ser una fecha ISO-8601');
  }
}

export class TelemetryService {
  constructor({ repo, bus, metrics, monitoring, alarms, detector }) {
    this.repo = repo;
    this.bus = bus;
    this.metrics = metrics;
    this.monitoring = monitoring;
    this.alarms = alarms;
    this.detector = detector;
  }

  ingerir(dto) {
    validarLectura(dto, this.repo);
    const paciente = this.repo.findPatient(dto.pacienteId);
    const sensorId = dto.sensorId || paciente.sensores.find((s) => s.tipo === dto.tipo)?.id;
    const lectura = crearLectura({ ...dto, sensorId });

    this.repo.addReading(lectura);
    this.metrics.registrarIngesta(lectura);
    this.bus.emit(Ev.TELEMETRIA, lectura);

    this.monitoring.registrarSenal(lectura.pacienteId);
    const alarma = this.alarms.evaluarLectura(lectura);
    const deteccion = this.detector.evaluar(lectura.pacienteId);
    return { lectura, alarma, deteccion };
  }

  ingerirLote(lecturas) {
    if (!Array.isArray(lecturas) || !lecturas.length) throw new AppError(400, 'Se esperaba un arreglo de lecturas');
    return lecturas.map((l) => this.ingerir(l).lectura);
  }
}

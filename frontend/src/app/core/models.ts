/** Modelos compartidos con el backend (ver Diagrama de Clases). */

export type Rol = 'MEDICO' | 'ENFERMERA';
export type TipoSigno = 'FC' | 'SPO2' | 'PA' | 'TEMP';
export type EstadoMonitorizacion =
  | 'SIN_SENAL'
  | 'MONITORIZANDO'
  | 'ALARMA_ACTIVA'
  | 'ALARMA_CONFIRMADA'
  | 'EMERGENCIA_ANAFILAXIA'
  | 'INFUSION_DETENIDA';

export interface Usuario {
  id: string;
  nombre: string;
  rol: Rol;
  especialidad?: string;
}

export interface PresionArterial {
  sistolica: number;
  diastolica: number;
}

export interface Lectura {
  id: string;
  pacienteId: string;
  sensorId: string;
  tipo: TipoSigno;
  valor: number | PresionArterial;
  unidad: string;
  seq: number | null;
  timestampSensor: string;
  timestampRecepcion: string;
  timestampServidor?: string;
}

export interface Bomba {
  id: string;
  medicamento: string;
  velocidadMlH: number;
  estado: 'INFUNDIENDO' | 'DETENIDA';
  actualizadoEn: string;
}

export interface Paciente {
  id: string;
  nombre: string;
  cama: string;
  edad: number;
  diagnostico: string;
  estado: EstadoMonitorizacion;
  bomba: Bomba;
  sensores: { id: string; tipo: TipoSigno; modelo: string }[];
  ultimasLecturas: Partial<Record<TipoSigno, Lectura>>;
  alarmasActivas: number;
  incidenteAbierto: string | null;
}

export interface Confirmacion {
  usuarioId: string;
  usuarioNombre: string;
  rol: Rol;
  pacienteId: string;
  fechaHora: string;
}

export interface Alarma {
  id: string;
  pacienteId: string;
  tipo: 'FC_ALTA' | 'FC_BAJA' | 'ANAFILAXIA';
  prioridad: 'ALTA';
  valor: number;
  mensaje: string;
  estado: 'ACTIVA' | 'CONFIRMADA' | 'RESUELTA';
  creadaEn: string;
  confirmacion: Confirmacion | null;
  incidenteId?: string | null;
  cama?: string;
  paciente?: string;
}

export interface OrdenParo {
  id: string;
  incidenteId: string;
  pacienteId: string;
  bombaId: string;
  emitidaPor: { id: string; nombre: string };
  estado: 'ENVIADA' | 'RECIBIDA' | 'EJECUTADA' | 'RECHAZADA';
  enviadaEn: string;
  recibidaEn: string | null;
  ejecutadaEn: string | null;
  motivoRechazo: string | null;
}

export interface Incidente {
  id: string;
  pacienteId: string;
  tipo: 'ANAFILAXIA';
  puntaje: number;
  factores: string[];
  alarmaId: string | null;
  estado: 'DETECTADO' | 'CONFIRMADO' | 'DESCARTADO' | 'RESUELTO';
  creadoEn: string;
  confirmadoPor: { id: string; nombre: string } | null;
  confirmadoEn: string | null;
  cerradoPor: { id: string; nombre: string } | null;
  cerradoEn: string | null;
  motivoCierre?: string;
  ordenParo: OrdenParo | null;
  signosAlDetectar?: { fc: number | null; spo2: number | null; pas: number | null };
}

export interface NotificacionPush {
  id: string;
  titulo: string;
  cuerpo: string;
  pacienteId: string;
  cama: string;
  alarmaId: string | null;
  incidenteId: string | null;
  prioridad: 'ALTA';
  enviadaEn: string;
}

export interface RegistroAuditoria {
  id: string;
  accion: string;
  usuarioId: string;
  usuarioNombre: string;
  pacienteId: string | null;
  detalle: unknown;
  fechaHora: string;
}

export interface ResumenSerie {
  muestras: number;
  min: number;
  max: number;
  promedio: number;
}

export interface ReporteIncidente {
  generadoEn: string;
  ventana: { desde: string; hasta: string };
  paciente: Pick<Paciente, 'id' | 'nombre' | 'cama' | 'edad' | 'diagnostico'>;
  incidente: Incidente;
  signosVitales: {
    resumen: Record<'FC' | 'SPO2' | 'PAS' | 'PAD' | 'TEMP', ResumenSerie | null>;
    totalLecturas: number;
    serie: Lectura[];
  };
  alarmas: Alarma[];
  confirmaciones: (Confirmacion & { alarmaId: string; tipo: string })[];
  accionesEmergencia: RegistroAuditoria[];
  ordenParo: OrdenParo | null;
}

export interface Umbrales {
  hrHigh: number;
  hrLow: number;
  anaphylaxis: number;
}

export interface ResumenLatencia {
  muestras: number;
  promedioMs: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

export interface Metricas {
  latenciaIngesta: ResumenLatencia;
  latenciaE2E: ResumenLatencia & { objetivoMs: number; cumple: boolean | null };
  perdidaPaquetes: { recibidos: number; perdidos: number; porcentaje: number; objetivoPorcentaje: number; cumple: boolean };
  disponibilidad: { enLineaDesde: string; uptimeSeg: number; objetivoPorcentaje: number };
}

export type Escenario = 'NORMAL' | 'TAQUICARDIA' | 'BRADICARDIA' | 'ANAFILAXIA';

export const ETIQUETA_ESTADO: Record<EstadoMonitorizacion, string> = {
  SIN_SENAL: 'Sin señal',
  MONITORIZANDO: 'Monitorizando',
  ALARMA_ACTIVA: 'Alarma activa',
  ALARMA_CONFIRMADA: 'Alarma confirmada',
  EMERGENCIA_ANAFILAXIA: 'Emergencia: anafilaxia',
  INFUSION_DETENIDA: 'Infusión detenida'
};

export const ETIQUETA_SIGNO: Record<TipoSigno, string> = {
  FC: 'Frecuencia cardíaca',
  SPO2: 'SpO₂',
  PA: 'Presión arterial',
  TEMP: 'Temperatura'
};

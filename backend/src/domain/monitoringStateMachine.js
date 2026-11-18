/**
 * Máquina de estados de la monitorización del paciente
 * (Diagrama de Estados, 02_PlantUML/05_estados_monitorizacion.puml).
 *
 *  SIN_SENAL ──lectura──▶ MONITORIZANDO ──umbral FC──▶ ALARMA_ACTIVA ──confirmar──▶ ALARMA_CONFIRMADA
 *      ▲                     ▲   │                          │                           │
 *      └──timeout señal──────┘   │                          └──────valores normales─────┴──▶ MONITORIZANDO
 *                                └──anafilaxia (RF-08)──▶ EMERGENCIA_ANAFILAXIA
 *                                                            │ confirmar + orden de paro (RF-09)
 *                                                            ▼
 *                                                        INFUSION_DETENIDA ──resolver──▶ MONITORIZANDO
 *                                  EMERGENCIA_ANAFILAXIA ──descartar──▶ MONITORIZANDO
 */
export const EstadoMonitorizacion = Object.freeze({
  SIN_SENAL: 'SIN_SENAL',
  MONITORIZANDO: 'MONITORIZANDO',
  ALARMA_ACTIVA: 'ALARMA_ACTIVA',
  ALARMA_CONFIRMADA: 'ALARMA_CONFIRMADA',
  EMERGENCIA_ANAFILAXIA: 'EMERGENCIA_ANAFILAXIA',
  INFUSION_DETENIDA: 'INFUSION_DETENIDA'
});

export const Evento = Object.freeze({
  LECTURA_RECIBIDA: 'LECTURA_RECIBIDA',
  UMBRAL_SUPERADO: 'UMBRAL_SUPERADO',
  ALARMA_CONFIRMADA: 'ALARMA_CONFIRMADA',
  VALORES_NORMALES: 'VALORES_NORMALES',
  ANAFILAXIA_DETECTADA: 'ANAFILAXIA_DETECTADA',
  INFUSION_DETENIDA: 'INFUSION_DETENIDA',
  INCIDENTE_DESCARTADO: 'INCIDENTE_DESCARTADO',
  INCIDENTE_RESUELTO: 'INCIDENTE_RESUELTO',
  SENAL_PERDIDA: 'SENAL_PERDIDA'
});

const E = EstadoMonitorizacion;
const V = Evento;

/** Tabla de transiciones: estadoActual -> evento -> estadoSiguiente */
const TRANSICIONES = {
  [E.SIN_SENAL]: {
    [V.LECTURA_RECIBIDA]: E.MONITORIZANDO
  },
  [E.MONITORIZANDO]: {
    [V.UMBRAL_SUPERADO]: E.ALARMA_ACTIVA,
    [V.ANAFILAXIA_DETECTADA]: E.EMERGENCIA_ANAFILAXIA,
    [V.SENAL_PERDIDA]: E.SIN_SENAL
  },
  [E.ALARMA_ACTIVA]: {
    [V.ALARMA_CONFIRMADA]: E.ALARMA_CONFIRMADA,
    [V.ANAFILAXIA_DETECTADA]: E.EMERGENCIA_ANAFILAXIA,
    [V.SENAL_PERDIDA]: E.SIN_SENAL
  },
  [E.ALARMA_CONFIRMADA]: {
    [V.VALORES_NORMALES]: E.MONITORIZANDO,
    [V.UMBRAL_SUPERADO]: E.ALARMA_ACTIVA,
    [V.ANAFILAXIA_DETECTADA]: E.EMERGENCIA_ANAFILAXIA,
    [V.SENAL_PERDIDA]: E.SIN_SENAL
  },
  [E.EMERGENCIA_ANAFILAXIA]: {
    [V.INFUSION_DETENIDA]: E.INFUSION_DETENIDA,
    [V.INCIDENTE_DESCARTADO]: E.MONITORIZANDO
  },
  [E.INFUSION_DETENIDA]: {
    [V.INCIDENTE_RESUELTO]: E.MONITORIZANDO
  }
};

/**
 * Devuelve el siguiente estado o `null` si la transición no está permitida
 * (el evento se ignora en ese estado).
 */
export function siguienteEstado(estadoActual, evento) {
  return TRANSICIONES[estadoActual]?.[evento] ?? null;
}

export function transicionesPermitidas(estado) {
  return Object.keys(TRANSICIONES[estado] || {});
}

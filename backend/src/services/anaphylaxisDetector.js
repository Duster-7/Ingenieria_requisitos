/**
 * RF-08 — Detección de anafilaxia inminente.
 *
 * Algoritmo de puntuación (0..1) inspirado en los criterios clínicos de
 * anafilaxia (compromiso cardiovascular + respiratorio):
 *   - Taquicardia:  FC > 110 → 0.15 · FC > 120 → 0.30
 *   - Hipoxemia:    SpO2 < 94 → 0.15 · SpO2 < 92 → 0.35
 *   - Hipotensión:  PAS < 100 → 0.15 · PAS < 90  → 0.35
 * Se genera evento cuando el puntaje ≥ umbral clínico configurado (por defecto 0.7)
 * durante `confirmaciones` evaluaciones consecutivas y con lecturas recientes.
 *
 * NOTA: algoritmo académico/demostrativo; no tiene validez clínica.
 */
export function calcularPuntajeAnafilaxia({ fc, spo2, pas }) {
  const factores = [];
  let puntaje = 0;

  if (fc != null) {
    if (fc > 120) { puntaje += 0.3; factores.push(`Taquicardia marcada (${fc} BPM)`); }
    else if (fc > 110) { puntaje += 0.15; factores.push(`Taquicardia (${fc} BPM)`); }
  }
  if (spo2 != null) {
    if (spo2 < 92) { puntaje += 0.35; factores.push(`Hipoxemia (SpO2 ${spo2}%)`); }
    else if (spo2 < 94) { puntaje += 0.15; factores.push(`Desaturación (SpO2 ${spo2}%)`); }
  }
  if (pas != null) {
    if (pas < 90) { puntaje += 0.35; factores.push(`Hipotensión (PAS ${pas} mmHg)`); }
    else if (pas < 100) { puntaje += 0.15; factores.push(`PAS limítrofe (${pas} mmHg)`); }
  }
  return { puntaje: +Math.min(1, puntaje).toFixed(2), factores };
}

export class AnaphylaxisDetector {
  constructor({ repo, getThresholds, onDeteccion, confirmaciones = 2, ventanaMs = 15000 }) {
    this.repo = repo;
    this.getThresholds = getThresholds;
    this.onDeteccion = onDeteccion;
    this.confirmaciones = confirmaciones;
    this.ventanaMs = ventanaMs;
    this.consecutivos = new Map();
  }

  evaluar(pacienteId) {
    const ult = this.repo.latestReadings(pacienteId);
    const now = Date.now();
    const fresca = (l) => l && now - new Date(l.timestampRecepcion).getTime() <= this.ventanaMs;

    const entrada = {
      fc: fresca(ult.FC) ? ult.FC.valor : null,
      spo2: fresca(ult.SPO2) ? ult.SPO2.valor : null,
      pas: fresca(ult.PA) ? ult.PA.valor?.sistolica : null
    };
    const { puntaje, factores } = calcularPuntajeAnafilaxia(entrada);
    const umbral = this.getThresholds().anaphylaxis;

    if (puntaje < umbral) {
      this.consecutivos.set(pacienteId, 0);
      return { puntaje, factores, evento: false };
    }
    const n = (this.consecutivos.get(pacienteId) || 0) + 1;
    this.consecutivos.set(pacienteId, n);
    if (n < this.confirmaciones || this.repo.findOpenIncident(pacienteId)) {
      return { puntaje, factores, evento: false };
    }
    const incidente = this.onDeteccion({ pacienteId, puntaje, factores, signos: entrada });
    return { puntaje, factores, evento: true, incidente };
  }
}

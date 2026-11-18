/**
 * Simulador de sensores biomédicos inalámbricos (A-03).
 * Genera FC, SpO2, PA y TEMP por paciente y las entrega al gateway
 * (TelemetryService) con número de secuencia por sensor.
 *
 * Escenarios: NORMAL, TAQUICARDIA, BRADICARDIA, ANAFILAXIA.
 */
import { AppError } from '../services/events.js';

export const Escenarios = Object.freeze({
  NORMAL: 'NORMAL',
  TAQUICARDIA: 'TAQUICARDIA',
  BRADICARDIA: 'BRADICARDIA',
  ANAFILAXIA: 'ANAFILAXIA'
});

const OBJETIVOS = {
  NORMAL: (b) => b,
  TAQUICARDIA: (b) => ({ ...b, fc: 152 }),
  BRADICARDIA: (b) => ({ ...b, fc: 40 }),
  ANAFILAXIA: (b) => ({ fc: 136, spo2: 87, pas: 78, pad: 44, temp: b.temp + 0.4 })
};

const ruido = (amp) => (Math.random() * 2 - 1) * amp;
const acercar = (actual, objetivo, k) => actual + (objetivo - actual) * k;

export class SensorSimulator {
  constructor({ repo, telemetry, intervalMs = 1000, packetLoss = 0 }) {
    this.repo = repo;
    this.telemetry = telemetry;
    this.intervalMs = intervalMs;
    this.packetLoss = packetLoss;
    this.estado = new Map();
    this._timer = null;

    const basales = [
      { fc: 78, spo2: 97, pas: 122, pad: 79, temp: 36.8 },
      { fc: 84, spo2: 96, pas: 116, pad: 74, temp: 37.1 },
      { fc: 92, spo2: 95, pas: 108, pad: 68, temp: 37.6 },
      { fc: 72, spo2: 98, pas: 126, pad: 82, temp: 36.6 }
    ];
    this.repo.listPatients().forEach((p, i) => {
      const basal = basales[i % basales.length];
      this.estado.set(p.id, { escenario: Escenarios.NORMAL, basal, actual: { ...basal }, seq: {} });
    });
  }

  iniciar() {
    if (this._timer) return;
    this._timer = setInterval(() => this.tick(), this.intervalMs);
    this._timer.unref?.();
    console.log(`[simulador] ${this.estado.size} pacientes · cada ${this.intervalMs} ms`);
  }

  detener() {
    clearInterval(this._timer);
    this._timer = null;
  }

  setEscenario(pacienteId, escenario) {
    const st = this.estado.get(pacienteId);
    if (!st) throw new AppError(404, 'Paciente no encontrado en el simulador');
    if (!Escenarios[escenario]) throw new AppError(400, `Escenario inválido. Usa: ${Object.keys(Escenarios).join(', ')}`);
    st.escenario = escenario;
    return this.info(pacienteId);
  }

  info(pacienteId) {
    const st = this.estado.get(pacienteId);
    return st ? { pacienteId, escenario: st.escenario } : null;
  }

  listar() {
    return [...this.estado.keys()].map((id) => this.info(id));
  }

  tick() {
    for (const [pacienteId, st] of this.estado) {
      const obj = OBJETIVOS[st.escenario](st.basal);
      const k = st.escenario === Escenarios.ANAFILAXIA ? 0.12 : 0.25;
      const a = st.actual;
      a.fc = acercar(a.fc, obj.fc, k);
      a.spo2 = acercar(a.spo2, obj.spo2, k);
      a.pas = acercar(a.pas, obj.pas, k);
      a.pad = acercar(a.pad, obj.pad, k);
      a.temp = acercar(a.temp, obj.temp, 0.05);

      const ts = new Date().toISOString();
      const lecturas = [
        { tipo: 'FC', valor: Math.round(a.fc + ruido(2)) },
        { tipo: 'SPO2', valor: Math.min(100, Math.round(a.spo2 + ruido(0.6))) },
        { tipo: 'PA', valor: { sistolica: Math.round(a.pas + ruido(2)), diastolica: Math.round(a.pad + ruido(2)) } },
        { tipo: 'TEMP', valor: +(a.temp + ruido(0.05)).toFixed(1) }
      ];
      for (const l of lecturas) {
        st.seq[l.tipo] = (st.seq[l.tipo] || 0) + 1;
        if (this.packetLoss > 0 && Math.random() < this.packetLoss) continue; // paquete perdido
        try {
          this.telemetry.ingerir({ pacienteId, tipo: l.tipo, valor: l.valor, timestampSensor: ts, seq: st.seq[l.tipo] });
        } catch (err) {
          console.error('[simulador]', err.message);
        }
      }
    }
  }
}

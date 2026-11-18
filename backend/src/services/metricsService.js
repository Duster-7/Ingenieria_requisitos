/**
 * RNF-01 (latencia), RNF-03 (disponibilidad) y RNF-05 (pérdida de paquetes).
 */
export class MetricsService {
  constructor({ sampleSize = 2000 } = {}) {
    this.sampleSize = sampleSize;
    this.latenciasIngesta = [];
    this.latenciasE2E = [];
    this.lastSeq = new Map();
    this.recibidos = 0;
    this.perdidos = 0;
    this.inicio = Date.now();
  }

  _push(arr, v) {
    arr.push(v);
    if (arr.length > this.sampleSize) arr.shift();
  }

  /** Latencia sensor -> plataforma central (ms). */
  registrarIngesta(lectura) {
    const lat = new Date(lectura.timestampRecepcion) - new Date(lectura.timestampSensor);
    if (Number.isFinite(lat) && lat >= 0) this._push(this.latenciasIngesta, lat);

    // Pérdida de paquetes por huecos en el número de secuencia de cada sensor
    this.recibidos++;
    if (lectura.seq != null && lectura.sensorId) {
      const prev = this.lastSeq.get(lectura.sensorId);
      if (prev != null && lectura.seq > prev + 1) this.perdidos += lectura.seq - prev - 1;
      if (prev == null || lectura.seq > prev) this.lastSeq.set(lectura.sensorId, lectura.seq);
    }
  }

  /** Latencia de extremo a extremo reportada por la pantalla bedside (sensor -> render). */
  registrarE2E(ms) {
    if (Number.isFinite(ms) && ms >= 0 && ms < 60000) this._push(this.latenciasE2E, ms);
  }

  static resumen(arr) {
    if (!arr.length) return { muestras: 0, promedioMs: null, p95Ms: null, maxMs: null };
    const s = [...arr].sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    return {
      muestras: s.length,
      promedioMs: +avg.toFixed(1),
      p95Ms: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
      maxMs: s[s.length - 1]
    };
  }

  snapshot() {
    const total = this.recibidos + this.perdidos;
    const e2e = MetricsService.resumen(this.latenciasE2E);
    const perdida = total ? +((this.perdidos / total) * 100).toFixed(3) : 0;
    return {
      latenciaIngesta: MetricsService.resumen(this.latenciasIngesta),
      latenciaE2E: { ...e2e, objetivoMs: 500, cumple: e2e.p95Ms == null ? null : e2e.p95Ms < 500 },
      perdidaPaquetes: {
        recibidos: this.recibidos,
        perdidos: this.perdidos,
        porcentaje: perdida,
        objetivoPorcentaje: 0.1,
        cumple: perdida <= 0.1
      },
      disponibilidad: {
        enLineaDesde: new Date(this.inicio).toISOString(),
        uptimeSeg: Math.round((Date.now() - this.inicio) / 1000),
        objetivoPorcentaje: 99.99
      }
    };
  }
}

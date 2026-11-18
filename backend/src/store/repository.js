/**
 * Repositorio en memoria con persistencia cifrada diferida.
 * Centraliza el acceso a datos de todos los servicios.
 */
import { seedState } from './seed.js';
import { crearRegistroAuditoria } from '../domain/entities.js';

export class Repository {
  constructor({ secureStore, persistDebounceMs = 3000, maxReadings = 50000 }) {
    this.secureStore = secureStore;
    this.persistDebounceMs = persistDebounceMs;
    this.maxReadings = maxReadings;
    this._timer = null;
    this.state = this._load();
  }

  _load() {
    try {
      const loaded = this.secureStore?.load();
      if (loaded) return { ...seedState(), ...loaded };
    } catch (err) {
      console.error('[repositorio] No se pudo descifrar el archivo de datos, se reinicia con datos semilla:', err.message);
    }
    return seedState();
  }

  /** Programa una escritura cifrada (agrupa muchas lecturas en una sola escritura). */
  touch() {
    if (!this.secureStore || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, this.persistDebounceMs);
    this._timer.unref?.();
  }

  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.secureStore?.save(this.state);
  }

  // ---------- Usuarios ----------
  findUserByRfid(rfid) {
    return this.state.usuarios.find((u) => u.rfid === rfid) || null;
  }
  findUserById(id) {
    return this.state.usuarios.find((u) => u.id === id) || null;
  }

  // ---------- Pacientes ----------
  listPatients() {
    return this.state.pacientes;
  }
  findPatient(id) {
    return this.state.pacientes.find((p) => p.id === id) || null;
  }
  updatePatient(id, patch) {
    const p = this.findPatient(id);
    if (!p) return null;
    Object.assign(p, patch);
    this.touch();
    return p;
  }

  // ---------- Lecturas ----------
  addReading(lectura) {
    this.state.lecturas.push(lectura);
    if (this.state.lecturas.length > this.maxReadings) {
      this.state.lecturas.splice(0, this.state.lecturas.length - this.maxReadings);
    }
    this.touch();
    return lectura;
  }

  queryReadings({ pacienteId, tipo, desde, hasta, limite }) {
    const d = desde ? new Date(desde).getTime() : -Infinity;
    const h = hasta ? new Date(hasta).getTime() : Infinity;
    let res = this.state.lecturas.filter((l) => {
      if (pacienteId && l.pacienteId !== pacienteId) return false;
      if (tipo && l.tipo !== tipo) return false;
      const t = new Date(l.timestampSensor).getTime();
      return t >= d && t <= h;
    });
    if (limite && res.length > limite) res = res.slice(res.length - limite);
    return res;
  }

  latestReadings(pacienteId) {
    const out = {};
    for (let i = this.state.lecturas.length - 1; i >= 0; i--) {
      const l = this.state.lecturas[i];
      if (l.pacienteId === pacienteId && !out[l.tipo]) {
        out[l.tipo] = l;
        if (Object.keys(out).length === 4) break;
      }
    }
    return out;
  }

  // ---------- Alarmas ----------
  addAlarm(a) {
    this.state.alarmas.push(a);
    this.touch();
    return a;
  }
  findAlarm(id) {
    return this.state.alarmas.find((a) => a.id === id) || null;
  }
  listAlarms({ estado, pacienteId } = {}) {
    return this.state.alarmas
      .filter((a) => (!estado || a.estado === estado) && (!pacienteId || a.pacienteId === pacienteId))
      .slice()
      .reverse();
  }
  findOpenAlarm(pacienteId, tipo) {
    return this.state.alarmas.find((a) => a.pacienteId === pacienteId && a.tipo === tipo && a.estado !== 'RESUELTA') || null;
  }

  // ---------- Incidentes ----------
  addIncident(i) {
    this.state.incidentes.push(i);
    this.touch();
    return i;
  }
  findIncident(id) {
    return this.state.incidentes.find((i) => i.id === id) || null;
  }
  listIncidents({ estado, pacienteId } = {}) {
    return this.state.incidentes
      .filter((i) => (!estado || i.estado === estado) && (!pacienteId || i.pacienteId === pacienteId))
      .slice()
      .reverse();
  }
  findOpenIncident(pacienteId) {
    return this.state.incidentes.find(
      (i) => i.pacienteId === pacienteId && (i.estado === 'DETECTADO' || i.estado === 'CONFIRMADO')
    ) || null;
  }

  // ---------- Auditoría ----------
  audit({ accion, usuario, pacienteId, detalle }) {
    const r = crearRegistroAuditoria({ accion, usuario, pacienteId, detalle });
    this.state.auditoria.push(r);
    this.touch();
    return r;
  }
  listAudit({ pacienteId, limite = 200 } = {}) {
    return this.state.auditoria
      .filter((r) => !pacienteId || r.pacienteId === pacienteId)
      .slice(-limite)
      .reverse();
  }
}

/**
 * Pruebas de aceptación derivadas de la columna "Criterio de aceptación /
 * verificación" del SRS (README.md, secciones 3 y 4).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { crearEntorno, KEY_HEX } from './helpers.js';
import { evaluarFrecuenciaCardiaca } from '../src/services/alarmService.js';
import { calcularPuntajeAnafilaxia } from '../src/services/anaphylaxisDetector.js';
import { siguienteEstado, EstadoMonitorizacion as E, Evento } from '../src/domain/monitoringStateMachine.js';
import { decrypt } from '../src/store/secureStore.js';

describe('RF-01 Alarma por frecuencia cardíaca', () => {
  const umbrales = { hrHigh: 140, hrLow: 45 };
  test('valores límite: 141 y 44 generan alarma; 140 y 45 no', () => {
    assert.equal(evaluarFrecuenciaCardiaca(141, umbrales), 'FC_ALTA');
    assert.equal(evaluarFrecuenciaCardiaca(44, umbrales), 'FC_BAJA');
    assert.equal(evaluarFrecuenciaCardiaca(140, umbrales), null);
    assert.equal(evaluarFrecuenciaCardiaca(45, umbrales), null);
  });

  test('simulación 141 BPM y 44 BPM genera alarmas de prioridad alta sonora y visual', async () => {
    const { enviar, ctx } = crearEntorno();
    const r1 = await enviar({ pacienteId: 'P-001', tipo: 'FC', valor: 141 });
    const r2 = await enviar({ pacienteId: 'P-002', tipo: 'FC', valor: 44 });
    assert.equal(r1.body.alarmaGenerada.tipo, 'FC_ALTA');
    assert.equal(r2.body.alarmaGenerada.tipo, 'FC_BAJA');
    for (const a of [r1.body.alarmaGenerada, r2.body.alarmaGenerada]) {
      assert.equal(a.prioridad, 'ALTA');
      assert.equal(a.sonora, true);
      assert.equal(a.visual, true);
    }
    assert.equal(ctx.repo.findPatient('P-001').estado, E.ALARMA_ACTIVA);
  });
});

describe('RF-02 Recepción de telemetría', () => {
  test('acepta los cuatro tipos de lectura conservando paciente y marca de tiempo', async () => {
    const { enviar, api, login } = crearEntorno();
    const ts = '2026-11-18T10:00:00.000Z';
    const lecturas = [
      { pacienteId: 'P-003', tipo: 'FC', valor: 80, timestampSensor: ts },
      { pacienteId: 'P-003', tipo: 'SPO2', valor: 97, timestampSensor: ts },
      { pacienteId: 'P-003', tipo: 'PA', valor: { sistolica: 120, diastolica: 80 }, timestampSensor: ts },
      { pacienteId: 'P-003', tipo: 'TEMP', valor: 36.7, timestampSensor: ts }
    ];
    const res = await enviar(lecturas);
    assert.equal(res.status, 201);
    assert.equal(res.body.recibidas, 4);
    for (const l of res.body.lecturas) {
      assert.equal(l.pacienteId, 'P-003');
      assert.equal(l.timestampSensor, ts);
      assert.ok(l.timestampRecepcion);
    }
    const token = await login();
    const hist = await api.get('/api/patients/P-003/vitals').set('Authorization', `Bearer ${token}`);
    assert.equal(hist.body.total, 4);
  });

  test('rechaza gateway no autorizado y lecturas inválidas', async () => {
    const { api, enviar } = crearEntorno();
    const r1 = await api.post('/api/gateway/telemetry').send({ pacienteId: 'P-001', tipo: 'FC', valor: 80 });
    assert.equal(r1.status, 401);
    const r2 = await enviar({ pacienteId: 'P-001', tipo: 'XX', valor: 80 });
    assert.equal(r2.status, 400);
  });
});

describe('RF-03 Historial de signos vitales', () => {
  test('consulta por paciente, tipo de signo y periodo', async () => {
    const { enviar, api, login } = crearEntorno();
    await enviar([
      { pacienteId: 'P-001', tipo: 'FC', valor: 70, timestampSensor: '2026-11-01T08:00:00Z' },
      { pacienteId: 'P-001', tipo: 'FC', valor: 72, timestampSensor: '2026-11-02T08:00:00Z' },
      { pacienteId: 'P-001', tipo: 'SPO2', valor: 98, timestampSensor: '2026-11-02T08:00:00Z' },
      { pacienteId: 'P-002', tipo: 'FC', valor: 90, timestampSensor: '2026-11-02T08:00:00Z' }
    ]);
    const token = await login();
    const res = await api
      .get('/api/patients/P-001/vitals?tipo=FC&desde=2026-11-02T00:00:00Z&hasta=2026-11-03T00:00:00Z')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.lecturas[0].valor, 72);
  });
});

describe('RF-04 Autenticación RFID', () => {
  test('solo una tarjeta autorizada obtiene sesión clínica', async () => {
    const { api } = crearEntorno();
    const ok = await api.post('/api/auth/rfid').send({ rfid: 'RFID-MED-001' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.usuario.rol, 'MEDICO');
    assert.equal(ok.body.usuario.rfid, undefined);

    const bad = await api.post('/api/auth/rfid').send({ rfid: 'RFID-FALSA-999' });
    assert.equal(bad.status, 401);

    const sinSesion = await api.get('/api/patients');
    assert.equal(sinSesion.status, 401);
    const conSesion = await api.get('/api/patients').set('Authorization', `Bearer ${ok.body.token}`);
    assert.equal(conSesion.status, 200);
    assert.equal(conSesion.body.length, 4);
  });
});

describe('RF-06 Notificación push', () => {
  test('un evento crítico genera notificación al médico', async () => {
    const { enviar, ctx } = crearEntorno();
    const recibidas = [];
    ctx.bus.on('notificacion:push', (n) => recibidas.push(n));
    await enviar({ pacienteId: 'P-004', tipo: 'FC', valor: 150 });
    assert.equal(recibidas.length, 1);
    assert.equal(recibidas[0].pacienteId, 'P-004');
    assert.equal(recibidas[0].destinatarioRol, 'MEDICO');
  });
});

describe('RF-07 Confirmación de alarma', () => {
  test('persiste usuario, paciente y timestamp', async () => {
    const { enviar, api, login, ctx } = crearEntorno();
    const { body } = await enviar({ pacienteId: 'P-001', tipo: 'FC', valor: 160 });
    const token = await login('RFID-ENF-001');
    const res = await api.post(`/api/alarms/${body.alarmaGenerada.id}/ack`).set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'CONFIRMADA');
    assert.equal(res.body.confirmacion.usuarioId, 'U-003');
    assert.equal(res.body.confirmacion.pacienteId, 'P-001');
    assert.ok(Date.parse(res.body.confirmacion.fechaHora));
    assert.equal(ctx.repo.findPatient('P-001').estado, E.ALARMA_CONFIRMADA);

    const dup = await api.post(`/api/alarms/${body.alarmaGenerada.id}/ack`).set('Authorization', `Bearer ${token}`);
    assert.equal(dup.status, 409);

    // al volver la FC a rango, la alarma confirmada se resuelve
    await enviar({ pacienteId: 'P-001', tipo: 'FC', valor: 80 });
    assert.equal(ctx.repo.findPatient('P-001').estado, E.MONITORIZANDO);
  });
});

describe('RF-08 / RF-09 / RF-10 Anafilaxia, paro de infusión y reporte', () => {
  test('puntaje del algoritmo', () => {
    assert.ok(calcularPuntajeAnafilaxia({ fc: 135, spo2: 88, pas: 80 }).puntaje >= 0.7);
    assert.ok(calcularPuntajeAnafilaxia({ fc: 80, spo2: 97, pas: 120 }).puntaje < 0.7);
  });

  test('flujo completo: detección -> confirmación -> orden de paro -> reporte', async () => {
    const { enviar, api, login, ctx } = crearEntorno();
    const signos = [
      { pacienteId: 'P-002', tipo: 'FC', valor: 135 },
      { pacienteId: 'P-002', tipo: 'SPO2', valor: 88 },
      { pacienteId: 'P-002', tipo: 'PA', valor: { sistolica: 80, diastolica: 45 } }
    ];
    await enviar(signos);
    await enviar(signos);

    const inc = ctx.repo.findOpenIncident('P-002');
    assert.ok(inc, 'debe generarse un incidente de anafilaxia');
    assert.equal(inc.estado, 'DETECTADO');
    assert.equal(ctx.repo.findPatient('P-002').estado, E.EMERGENCIA_ANAFILAXIA);

    // la enfermera no puede confirmar
    const tokenEnf = await login('RFID-ENF-001');
    const prohibido = await api.post(`/api/incidents/${inc.id}/confirm`).set('Authorization', `Bearer ${tokenEnf}`);
    assert.equal(prohibido.status, 403);

    const token = await login('RFID-MED-002');
    const res = await api.post(`/api/incidents/${inc.id}/confirm`).set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'CONFIRMADO');
    assert.equal(res.body.ordenParo.estado, 'EJECUTADA');
    assert.equal(ctx.repo.findAlarm(inc.alarmaId).confirmacion.usuarioId, 'U-002');
    assert.ok(res.body.ordenParo.enviadaEn && res.body.ordenParo.recibidaEn && res.body.ordenParo.ejecutadaEn);
    assert.equal(ctx.repo.findPatient('P-002').bomba.estado, 'DETENIDA');
    assert.equal(ctx.repo.findPatient('P-002').estado, E.INFUSION_DETENIDA);

    const rep = await api.get(`/api/incidents/${inc.id}/report`).set('Authorization', `Bearer ${token}`);
    assert.equal(rep.status, 200);
    assert.ok(rep.body.signosVitales.totalLecturas >= 6);
    assert.ok(rep.body.alarmas.some((a) => a.tipo === 'ANAFILAXIA'));
    const acciones = rep.body.accionesEmergencia.map((a) => a.accion);
    for (const a of ['ANAFILAXIA_DETECTADA', 'ANAFILAXIA_CONFIRMADA', 'ORDEN_PARO_ENVIADA', 'INFUSION_DETENIDA']) {
      assert.ok(acciones.includes(a), `el reporte debe incluir ${a}`);
    }

    const resuelto = await api.post(`/api/incidents/${inc.id}/resolve`).set('Authorization', `Bearer ${token}`).send({ nota: 'Adrenalina IM, estable' });
    assert.equal(resuelto.body.estado, 'RESUELTO');
    const reanudar = await api.post('/api/patients/P-002/pump/resume').set('Authorization', `Bearer ${token}`);
    assert.equal(reanudar.body.estado, 'INFUNDIENDO');
  });
});

describe('RNF-02 Cifrado AES-256 en reposo', () => {
  test('el archivo de datos no contiene información clínica en claro', async () => {
    const { enviar, ctx, config } = crearEntorno();
    await enviar({ pacienteId: 'P-001', tipo: 'FC', valor: 77 });
    ctx.repo.flush();
    const raw = fs.readFileSync(config.dataFile, 'utf8');
    assert.ok(!raw.includes('Carlos'), 'no debe aparecer el nombre del paciente');
    assert.ok(!raw.includes('P-001'));
    const env = JSON.parse(raw);
    assert.equal(env.alg, 'aes-256-gcm');
    const plano = decrypt(env, Buffer.from(KEY_HEX, 'hex'));
    assert.equal(plano.pacientes[0].nombre, 'Carlos Méndez Ruiz');
  });
});

describe('RNF-05 Pérdida de paquetes', () => {
  test('los huecos de secuencia se contabilizan como pérdida', async () => {
    const { enviar, ctx } = crearEntorno();
    for (const seq of [1, 2, 3, 5, 6]) await enviar({ pacienteId: 'P-001', tipo: 'TEMP', valor: 36.5, seq });
    const m = ctx.metrics.snapshot().perdidaPaquetes;
    assert.equal(m.recibidos, 5);
    assert.equal(m.perdidos, 1);
  });
});

describe('Diagrama de estados', () => {
  test('transiciones permitidas y no permitidas', () => {
    assert.equal(siguienteEstado(E.SIN_SENAL, Evento.LECTURA_RECIBIDA), E.MONITORIZANDO);
    assert.equal(siguienteEstado(E.MONITORIZANDO, Evento.UMBRAL_SUPERADO), E.ALARMA_ACTIVA);
    assert.equal(siguienteEstado(E.EMERGENCIA_ANAFILAXIA, Evento.INFUSION_DETENIDA), E.INFUSION_DETENIDA);
    assert.equal(siguienteEstado(E.INFUSION_DETENIDA, Evento.UMBRAL_SUPERADO), null);
  });
});

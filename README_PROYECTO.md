# MediGuard IoT — Implementación del SRS

Implementación de referencia de la plataforma **MediGuard IoT** descrita en el [`README.md`](README.md) (SRS, MoSCoW, trazabilidad y modelos UML).

| Capa | Tecnología |
|---|---|
| Backend (plataforma central) | Node.js · Express 5 · Socket.IO · JWT · AES-256-GCM (`node:crypto`) |
| Frontend (app médica + pantalla bedside) | Angular 22 (componentes standalone, signals, zoneless) · socket.io-client · Canvas |
| Sensores / gateway / bomba | Simulador integrado en el backend + endpoint REST para un gateway físico |
| Pruebas | `node:test` + Supertest (criterios de aceptación del SRS) |

## 1. Requisitos previos

- **Node.js 22 LTS o superior** (`node -v`)
- npm 10+
- VS Code (recomendadas: Angular Language Service, PlantUML, REST Client)

## 2. Puesta en marcha

Desde la carpeta raíz del repositorio (`Ingenieria_requisitos-main`), en la terminal de VS Code:

```bash
npm run install:all     # instala raíz, backend y frontend
npm run dev             # levanta backend (:3000) y frontend (:4200) a la vez
```

Abre **http://localhost:4200** y entra con una tarjeta de demostración:

| RFID | Usuario | Rol |
|---|---|---|
| `RFID-MED-001` | Dra. Ana Torres | Médico |
| `RFID-MED-002` | Dr. Luis Herrera | Médico |
| `RFID-ENF-001` | Enf. María López | Enfermería (no puede confirmar anafilaxia ni ver reportes) |

También puedes usar **Terminal → Ejecutar tarea → "MediGuard: iniciar todo"**, o arrancar cada parte por separado (`npm run backend` / `npm run frontend`).

### Configuración opcional

Copia `backend/.env.example` a `backend/.env` para cambiar puerto, umbrales, clave AES-256 (`DATA_ENCRYPTION_KEY`), clave del gateway, etc. Sin `.env` el sistema arranca con valores de desarrollo.

## 3. Demostración guiada

1. **Central**: los 4 pacientes muestran FC, SpO₂, PA y temperatura en tiempo real.
2. En la tarjeta de UCI-01 cambia el **Simulador** a `TAQUICARDIA` → al superar 140 BPM aparece la alarma roja, suena el patrón de alarma y llega la notificación push (RF-01, RF-06).
3. Pulsa **Confirmar lectura** → queda registrado usuario, paciente y hora (RF-07; ver *Alarmas* y *Sistema → Auditoría*).
4. Abre **Bedside** de un paciente: curva ECG y pletismografía a 60 FPS con medidor de FPS y de latencia (RF-05, RNF-01).
5. Cambia UCI-03 a `ANAFILAXIA` → el algoritmo genera el incidente (RF-08). En **Incidentes**, un médico confirma y se envía la orden de paro: gateway → bomba detenida (RF-09).
6. Abre **Reporte** del incidente → signos, alarmas, confirmaciones, orden de paro y auditoría; se puede imprimir/guardar como PDF (RF-10).
7. **Historial**: consulta por paciente, tipo de signo y rango de fechas (RF-03).

## 4. Pruebas de aceptación

```bash
npm test
```

`backend/tests/requisitos.test.js` implementa los criterios de verificación del SRS: valores 141/44 BPM y límites 140/45, cuatro tipos de lectura con trazabilidad, consultas de historial, RFID autorizado vs. no autorizado, push, confirmación auditada, flujo completo de anafilaxia → paro → reporte, archivo cifrado sin datos en claro y conteo de pérdida de paquetes.

## 5. Trazabilidad requisito → código

| Requisito | Backend | Frontend |
|---|---|---|
| RF-01 Alarma FC > 140 / < 45 | `services/alarmService.js` (`evaluarFrecuenciaCardiaca`) | `core/alarm-sound.service.ts`, banner en `layout/shell.component.html` |
| RF-02 Telemetría sensor → gateway → plataforma | `services/telemetryService.js`, `routes/gateway.routes.js`, `simulator/sensorSimulator.js` | `core/realtime.service.ts` |
| RF-03 Historial por fecha y signo | `GET /api/patients/:id/vitals` (`routes/patients.routes.js`) | `pages/history.component.ts` |
| RF-04 Autenticación RFID | `services/authService.js`, `middleware/auth.js` | `pages/login.component.ts`, `core/guards.ts` |
| RF-05 ECG bedside ≥ 60 FPS | — | `shared/waveform-monitor.component.ts`, `pages/bedside.component.ts` |
| RF-06 Notificación push | `services/notificationService.js`, `realtime/socket.js` | toasts + Notification API en `realtime.service.ts` |
| RF-07 Confirmación de alarma | `AlarmService.confirmar` · `POST /api/alarms/:id/ack` | `pages/alarms.component.ts`, bedside, banner |
| RF-08 Detección de anafilaxia | `services/anaphylaxisDetector.js` | `pages/incidents.component.ts` |
| RF-09 Orden de paro de infusión | `services/gatewayService.js`, `IncidentService.confirmar` | `pages/incidents.component.ts` |
| RF-10 Reporte de incidente | `IncidentService.reporte` · `GET /api/incidents/:id/report` | `pages/report.component.ts` |
| RNF-01 Latencia E2E < 500 ms | `services/metricsService.js` | medición en `realtime.service.ts`, `pages/system.component.ts` |
| RNF-02 AES-256 en reposo | `store/secureStore.js` (AES-256-GCM) | — |
| RNF-03 Disponibilidad 99.99 % | `GET /api/health`, uptime en métricas | `pages/system.component.ts` |
| RNF-04 Usabilidad SUS ≥ 80 | — (se verifica con usuarios) | interfaz responsive, alarmas de alto contraste |
| RNF-05 Pérdida ≤ 0.1 % | secuencia por sensor en `metricsService.js` (`SIMULATOR_PACKET_LOSS` para probar) | `pages/system.component.ts` |
| Diagrama de estados | `domain/monitoringStateMachine.js` | insignias de estado por paciente |
| Diagrama de clases | `domain/entities.js`, `container.js` | `core/models.ts` |

## 6. Estructura

```text
backend/
  src/
    domain/        entidades y máquina de estados (UML)
    services/      telemetría, alarmas, detección, gateway, incidentes, auth, métricas
    store/         repositorio + persistencia cifrada AES-256-GCM
    routes/        API REST
    realtime/      Socket.IO
    simulator/     sensores biomédicos simulados
  tests/           pruebas de aceptación del SRS
  api.http         peticiones de ejemplo (REST Client)
frontend/
  src/app/
    core/          servicios (API, auth, tiempo real, sonido) y modelos
    layout/        barra, banner de alarmas, notificaciones push
    pages/         login, central, bedside, historial, alarmas, incidentes, reporte, sistema
    shared/        monitor de ondas ECG/pleth, gráfica de tendencias, formatos
```

## 7. Limitaciones (alcance académico)

- El algoritmo de anafilaxia es **demostrativo** y no tiene validez clínica.
- La curva ECG se sintetiza en el cliente a partir de la FC real del paciente (no se transmiten muestras de 250 Hz).
- La "notificación push" usa el canal en tiempo real + Notification API del navegador; para push con la app cerrada haría falta Web Push/FCM.
- La persistencia es un archivo cifrado (`backend/data/mediguard.enc`); en producción se usaría una base de datos con cifrado en reposo.

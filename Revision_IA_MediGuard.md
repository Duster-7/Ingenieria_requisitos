# Evaluación del SRS de MediGuard IoT

Revisión de claridad, completitud, consistencia y verificabilidad del documento SRS\_MediGuard\_IoT.md

## Conclusión

**No, el documento no es suficiente tal como está.** Sirve como esqueleto de alto nivel o para un entregable académico, pero un desarrollador tendría que hacer muchas suposiciones, y en un sistema de UCI las suposiciones son un riesgo de seguridad.

| Criterio | Valoración | Resumen |
| --- | --- | --- |
| Claridad | Media | Redacción ordenada, pero con términos y umbrales sin definir |
| Completitud | Baja | Faltan interfaces, modos degradados, seguridad, regulación y alarmas técnicas |
| Consistencia | Media-baja | Hay contradicciones entre RF, UC y matriz |
| Verificabilidad | Media | Algunos requisitos se prueban bien, otros dependen de algo no definido |

## Lo que está bien

- Usa IDs, MoSCoW y criterios de aceptación por requisito.
- Tiene RNF cuantificados (500 ms, 99.99 %, AES-256, SUS ≥ 80, ≤ 0.1 % de pérdida).
- Incluye una matriz de trazabilidad.
- RF-01, RF-04 y RF-07 son claramente comprobables.

## Problemas de claridad

- **RF-01:** no dice cuánto tiempo debe mantenerse el valor fuera de rango (¿una lectura o varias?), en qué dispositivos suena la alarma, qué es "prioridad alta" ni cómo se silencia. Tampoco hay umbrales para SpO2, presión y temperatura, aunque RF-02 los captura.
- **RF-05:** "60 FPS" es una tasa de refresco, pero no se define la frecuencia de muestreo del ECG, el número de derivaciones ni la resolución.
- **RF-08:** "algoritmo de detección" y "umbral clínico configurado" no se definen. No se sabe quién configura el umbral, cuál es el valor por defecto ni qué sensibilidad o especificidad se exige.
- **RNF-01:** no indica entre qué puntos se mide la latencia "extremo a extremo" ni con qué percentil (media, P95, P99).
- **RNF-05:** "condiciones normales" no está definido.
- **RF-01 y RF-02** mezclan varias exigencias en una sola frase, así que no son requisitos "singulares" según ISO 29148.

## Problemas de completitud

- **Interfaces externas:** no hay protocolos (BLE, MQTT, HL7/FHIR, IEEE 11073), formatos de datos, unidades ni la interfaz con la bomba de infusión.
- **Modo degradado:** no se dice qué pasa si cae Internet o el enlace gateway-nube. RF-08 y RF-09 parecen depender de la nube, lo cual es muy delicado con un límite de 500 ms.
- **Alarmas técnicas:** faltan sensor desconectado, batería baja, pérdida de señal y fallo de la bomba.
- **Gestión de alarmas:** no hay prioridades media y baja, escalamiento si nadie confirma, reintentos de la notificación push ni umbrales por paciente.
- **Operación clínica:** no se describe la asociación paciente-sensor, el alta y baja de pacientes ni la sincronización de relojes (clave si todo depende de timestamps).
- **Seguridad:** solo se cifra en reposo. Faltan cifrado en tránsito, autenticación de dispositivos, roles y permisos (la enfermera A-02 nunca se autentica), expiración de sesión, gestión de claves, auditoría de accesos y respaldos.
- **Cumplimiento:** no se citan normas como IEC 62304, ISO 14971, IEC 60601-1-8, ni la normativa de privacidad aplicable (por ejemplo LFPDPPP y NOM-024-SSA3 en México).
- **Capacidad:** no se indica cuántas camas, pacientes, sensores ni muestras por segundo se esperan, y sin eso RNF-01, RNF-03 y RNF-05 no son dimensionables.
- **Retención de datos:** no hay periodo de conservación del historial.
- **Contexto técnico:** faltan glosario, supuestos, plataformas del móvil, idiomas y restricciones tecnológicas.

## Inconsistencias

1. **Confirmación de anafilaxia:** RF-08 genera un evento de anafilaxia "inminente", pero RF-09 actúa ante uno "confirmado". No se define quién o qué lo confirma. Si es automático, detener una infusión sin confirmación humana es un riesgo de seguridad que debería tener requisitos propios (confirmación del médico, ventana de cancelación, manejo de falsos positivos).
2. **Dónde se detecta:** RF-08 dice "el sistema", UC-05 dice que lo hace el gateway y la introducción habla de microservicios en la nube.
3. **Actores:** UC-05 y UC-06 usan "Servicio de detección" y "Servicio de control", que no están en la tabla de actores.
4. **Persistencia vs. prioridad:** UC-01 promete telemetría "persistida", pero el almacenamiento (RF-03) es solo SHOULD. Además RF-07 (MUST) y RF-10 dependen de datos que RF-03 almacena.
5. **Matriz de trazabilidad:** mezcla fuentes "N-xx" y "RS-01", y ninguna está definida en el documento. Además RNF-02 (cifrado del expediente) se liga al caso de uso de autenticar médico, que no es el más natural.
6. **RNF-03:** 99.99 % equivale a unos 4 minutos de caída al mes, pero el alcance ("servicios centrales") excluye gateway, apps y sensores, y no se definen ventanas de mantenimiento ni la arquitectura de redundancia necesaria.
7. **Referencias a artefactos externos:** los diagramas (UC, CL, SD-01, SD-02, ST) y el README no están en el documento, así que la matriz no se puede verificar desde el SRS.
8. **Residuos académicos:** las secciones "Nota de alcance", la referencia a "sección 5.1" y el "Criterio de completitud" hablan del entregable, no del sistema. Tampoco se distingue qué requisitos son literales de la guía y cuáles son "propuestas derivadas".

## Problemas de verificabilidad

- **RF-01:** probar solo 141 y 44 BPM es insuficiente. Faltan los valores frontera 140 y 45, y el tiempo máximo entre cruzar el umbral y emitir la alarma.
- **RF-06 y RF-09:** no tienen tiempo máximo de entrega ni de ejecución, así que "verificar recepción" puede cumplirse en un minuto o en una hora.
- **RF-08:** sin definición del algoritmo ni de la sensibilidad y especificidad exigidas, no hay criterio de aprobación.
- **RF-10:** "contiene todos los eventos relacionados" no define qué eventos ni qué ventana de tiempo.
- **RNF-03:** no se fijan fórmula ni exclusiones para medir el uptime.
- **RNF-04:** SUS con 10 usuarios es una muestra débil, y no se aclara si incluye la pantalla bedside.

## Qué corregir primero

1. Resolver el flujo de anafilaxia: dónde se detecta, quién confirma, tiempos máximos y comportamiento ante fallo de la bomba o de la red.
2. Añadir un requisito de modo degradado y de funcionamiento local en el gateway.
3. Definir umbrales para los cuatro signos vitales, tiempos de persistencia y la política completa de alarmas.
4. Agregar una sección de interfaces externas y un glosario.
5. Completar los requisitos de seguridad y privacidad, y citar las normas aplicables.
6. Redactar las necesidades N-xx y RS-xx, y limpiar la matriz de trazabilidad y los actores.
7. Reformular los RNF con alcance, percentil y condiciones de medición explícitos.

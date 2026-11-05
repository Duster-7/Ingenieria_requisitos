# Revisión por IA — Ingeniería de Requisitos MediGuard IoT

**Objeto revisado:** `README.md` / SRS de MediGuard IoT y sus modelos PlantUML.

## Dictamen

**Resultado académico:** APTO como entrega de la actividad, con mejoras recomendadas.

**Resultado para construcción de software real:** NO completamente listo todavía. El documento proporciona una base sólida, pero un desarrollador todavía necesitaría aclaraciones para varios requisitos críticos antes de implementar componentes de seguridad clínica y control de infusión.

## Fortalezas encontradas

1. Hay 10 requisitos funcionales identificados y priorizados con MoSCoW.
2. Hay 5 requisitos no funcionales con métricas verificables.
3. Existe una matriz de trazabilidad entre necesidades, requisitos, casos de uso, modelos y verificación.
4. Los cinco modelos pedidos están representados en PlantUML y cuentan con exportaciones gráficas.
5. Los requisitos RF-01 y RF-05, y los RNF-01 a RNF-05, contienen métricas concretas que permiten plantear pruebas.

## Hallazgos que conviene corregir antes de una implementación real

### 1. RF-08 — detección de anafilaxia

**Problema:** la frase «cuando el algoritmo de detección supere el umbral clínico configurado» no especifica cuáles son las entradas, unidades, ventana temporal, reglas/algoritmo, umbral(es), ni el comportamiento ante datos incompletos.

**Acción recomendada:** documentar como requisito adicional una especificación del algoritmo/reglas de detección que defina, como mínimo, entradas, unidades, ventana de evaluación, umbrales configurables, versión del algoritmo y comportamiento con lecturas faltantes.

### 2. RF-09 — paro de infusión

**Problema:** la secuencia define el envío de `STOP`, pero no define qué ocurre si el gateway no confirma, la bomba no responde, la conexión se pierde o existe una orden duplicada.

**Acción recomendada:** añadir requisitos de excepción para timeout, reintentos, idempotencia, confirmación de estado y registro del resultado del paro.

### 3. RF-02 — telemetría

**Problema:** identifica los cuatro signos vitales, pero no define frecuencia de muestreo, unidades normalizadas, identificador del sensor, calidad de dato ni política de lecturas inválidas.

**Acción recomendada:** especificar el contrato de la lectura `VitalReading` y sus reglas de validación.

### 4. RNF-02 — seguridad

**Problema:** solo fija cifrado en reposo con AES-256. Para una solución distribuida quedan sin especificar aspectos de autenticación, autorización, transporte seguro y auditoría.

**Acción recomendada:** incorporar requisitos adicionales de seguridad de comunicaciones, control de acceso por rol y auditoría de acciones clínicas.

### 5. RNF-03 y RNF-05 — condiciones de medición

**Problema:** las métricas son buenas, pero frases como «disponibilidad mensual» o «durante condiciones normales de operación» necesitan definir el intervalo de medición y las condiciones del ensayo.

**Acción recomendada:** documentar periodo de medición, fuentes de observabilidad y condiciones de prueba.

### 6. Casos de uso

**Problema:** el documento contiene casos de uso resumidos, pero no especifica precondiciones, flujo principal, flujos alternos, excepciones y postcondiciones para cada caso.

**Acción recomendada:** ampliar al menos los casos críticos `UC-03`, `UC-05` y `UC-06` antes de que un desarrollador los tome como especificación de implementación.

## Conclusión

La especificación está **bien encaminada y es adecuada como entrega académica**. Para considerarla una SRS suficientemente precisa para construcción, se deben cerrar principalmente las ambigüedades de detección de anafilaxia, control de la bomba, contrato de telemetría, seguridad distribuida y flujos alternos de los casos críticos.

> **Recomendación para la entrega:** conservar este informe como evidencia de la revisión realizada por IA y presentar la versión mejorada del `README.md` como documento principal del repositorio.

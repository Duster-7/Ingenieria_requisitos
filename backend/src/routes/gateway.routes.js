import { Router } from 'express';

/**
 * Endpoint de ingesta para el gateway hospitalario físico (RF-02).
 * Autenticado con el header `x-gateway-key`.
 *
 * POST /api/gateway/telemetry
 *   { pacienteId, tipo: 'FC'|'SPO2'|'PA'|'TEMP', valor, timestampSensor?, sensorId?, seq? }
 *   o un arreglo de lecturas.
 */
export default function gatewayRoutes({ telemetry }) {
  const r = Router();

  r.post('/telemetry', (req, res) => {
    if (Array.isArray(req.body)) {
      const lecturas = telemetry.ingerirLote(req.body);
      return res.status(201).json({ recibidas: lecturas.length, lecturas });
    }
    const { lectura, alarma, deteccion } = telemetry.ingerir(req.body);
    res.status(201).json({ lectura, alarmaGenerada: alarma, deteccionAnafilaxia: deteccion });
  });

  return r;
}

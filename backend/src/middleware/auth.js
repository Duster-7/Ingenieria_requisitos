import { AppError } from '../services/events.js';

export function requireAuth(authService) {
  return (req, _res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return next(new AppError(401, 'Autenticación RFID requerida'));
    try {
      req.usuario = authService.verificar(token);
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return next(new AppError(403, `Acción permitida solo para: ${roles.join(', ')}`));
    }
    next();
  };
}

/** Autenticación del gateway hospitalario por API key. */
export function requireGateway(apiKey) {
  return (req, _res, next) => {
    if (req.headers['x-gateway-key'] !== apiKey) return next(new AppError(401, 'Gateway no autorizado'));
    next();
  };
}

/** RF-04 — Autenticación de médicos mediante tarjeta RFID. */
import jwt from 'jsonwebtoken';
import { AppError } from './events.js';

export class AuthService {
  constructor({ repo, jwtSecret, jwtExpiresIn }) {
    this.repo = repo;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
  }

  loginRfid(rfid) {
    const tag = typeof rfid === 'string' ? rfid.trim().toUpperCase() : '';
    if (!tag) throw new AppError(400, 'Se requiere el identificador de la tarjeta RFID');
    const usuario = this.repo.findUserByRfid(tag);
    if (!usuario) {
      this.repo.audit({ accion: 'RFID_RECHAZADO', detalle: { rfid: tag.slice(0, 4) + '***' } });
      throw new AppError(401, 'Tarjeta RFID no autorizada');
    }
    const token = jwt.sign({ sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });
    this.repo.audit({ accion: 'SESION_INICIADA', usuario });
    return { token, usuario: this.publico(usuario) };
  }

  verificar(token) {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      const usuario = this.repo.findUserById(payload.sub);
      if (!usuario) throw new Error('usuario inexistente');
      return this.publico(usuario);
    } catch {
      throw new AppError(401, 'Sesión inválida o expirada');
    }
  }

  publico(u) {
    const { rfid, ...rest } = u;
    return rest;
  }
}

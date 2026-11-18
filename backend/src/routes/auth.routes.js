import { Router } from 'express';

/** UC-04 Autenticar médico (RF-04) */
export default function authRoutes({ auth }, requireAuth) {
  const r = Router();

  r.post('/rfid', (req, res) => {
    res.json(auth.loginRfid(req.body?.rfid));
  });

  r.get('/me', requireAuth, (req, res) => {
    res.json(req.usuario);
  });

  return r;
}

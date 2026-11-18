import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? true : inject(Router).createUrlTree(['/login']);
};

export const medicoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.esMedico() ? true : inject(Router).createUrlTree(['/dashboard']);
};

export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

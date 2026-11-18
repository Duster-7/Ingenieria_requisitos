import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Usuario } from './models';

const STORAGE_KEY = 'mediguard.sesion';

interface Sesion {
  token: string;
  usuario: Usuario;
}

/** RF-04 — Sesión clínica obtenida con tarjeta RFID. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private sesion = signal<Sesion | null>(this.leer());

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly token = computed(() => this.sesion()?.token ?? null);
  readonly autenticado = computed(() => !!this.sesion());
  readonly esMedico = computed(() => this.usuario()?.rol === 'MEDICO');

  async loginRfid(rfid: string): Promise<Usuario> {
    const s = await firstValueFrom(this.http.post<Sesion>('/api/auth/rfid', { rfid }));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    this.sesion.set(s);
    return s.usuario;
  }

  logout(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.sesion.set(null);
    this.router.navigate(['/login']);
  }

  private leer(): Sesion | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Sesion) : null;
    } catch {
      return null;
    }
  }
}

import { Pipe, PipeTransform } from '@angular/core';
import { EstadoMonitorizacion, ETIQUETA_ESTADO, Lectura, PresionArterial, TipoSigno } from '../core/models';

export const COLOR_SIGNO: Record<TipoSigno, string> = {
  FC: '#3ef07a',
  SPO2: '#38d6ff',
  PA: '#ff8f6b',
  TEMP: '#ffd95a'
};

export function valorTexto(l: Lectura | undefined | null): string {
  if (!l) return '--';
  if (l.tipo === 'PA') {
    const v = l.valor as PresionArterial;
    return `${v.sistolica}/${v.diastolica}`;
  }
  return l.tipo === 'TEMP' ? (l.valor as number).toFixed(1) : String(l.valor);
}

@Pipe({ name: 'valorSigno' })
export class ValorSignoPipe implements PipeTransform {
  transform(l: Lectura | undefined | null): string {
    return valorTexto(l);
  }
}

@Pipe({ name: 'estadoTexto' })
export class EstadoTextoPipe implements PipeTransform {
  transform(e: EstadoMonitorizacion | undefined | null): string {
    return e ? ETIQUETA_ESTADO[e] : '';
  }
}

/** Clase CSS para la insignia de estado de monitorización. */
export function claseEstado(e: EstadoMonitorizacion | undefined): string {
  switch (e) {
    case 'ALARMA_ACTIVA':
    case 'EMERGENCIA_ANAFILAXIA':
      return 'badge badge--critico';
    case 'ALARMA_CONFIRMADA':
    case 'INFUSION_DETENIDA':
      return 'badge badge--aviso';
    case 'MONITORIZANDO':
      return 'badge badge--ok';
    default:
      return 'badge badge--neutro';
  }
}

@Pipe({ name: 'claseEstado' })
export class ClaseEstadoPipe implements PipeTransform {
  transform(e: EstadoMonitorizacion | undefined): string {
    return claseEstado(e);
  }
}

export const ETIQUETA_ALARMA: Record<string, string> = {
  FC_ALTA: 'FC alta',
  FC_BAJA: 'FC baja',
  ANAFILAXIA: 'Anafilaxia'
};

@Pipe({ name: 'tipoAlarma' })
export class TipoAlarmaPipe implements PipeTransform {
  transform(t: string): string {
    return ETIQUETA_ALARMA[t] ?? t;
  }
}

/** Convierte una fecha a valor para <input type="datetime-local">. */
export function aInputLocal(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

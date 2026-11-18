import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';

export interface SeriePunto {
  t: number;
  v: number;
  v2?: number;
}

/** Gráfica de tendencia ligera en <canvas> (historial RF-03 y reporte RF-10). */
@Component({
  selector: 'app-trend-chart',
  template: `<canvas #canvas class="trend-canvas" [style.height.px]="alto()"></canvas>`,
  host: { class: 'trend-host' }
})
export class TrendChartComponent implements AfterViewInit, OnDestroy {
  readonly puntos = input<SeriePunto[]>([]);
  readonly color = input('#3ef07a');
  readonly color2 = input('#ff8f6b');
  readonly alto = input(220);
  readonly compacto = input(false);
  readonly unidad = input('');
  readonly lineasReferencia = input<{ valor: number; etiqueta: string }[]>([]);

  private canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private ro?: ResizeObserver;

  constructor() {
    effect(() => {
      this.puntos();
      this.lineasReferencia();
      this.dibujar();
    });
  }

  ngAfterViewInit(): void {
    this.ro = new ResizeObserver(() => this.dibujar());
    this.ro.observe(this.canvas()!.nativeElement);
    this.dibujar();
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private dibujar(): void {
    const el = this.canvas()?.nativeElement;
    if (!el || !el.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    const ctx = el.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pts = this.puntos();
    const compacto = this.compacto();
    const m = compacto ? { l: 2, r: 2, t: 4, b: 4 } : { l: 44, r: 12, t: 12, b: 26 };
    const pw = w - m.l - m.r;
    const ph = h - m.t - m.b;

    if (!pts.length) {
      if (!compacto) {
        ctx.fillStyle = '#7f8ea3';
        ctx.font = '13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Sin datos en el periodo seleccionado', w / 2, h / 2);
      }
      return;
    }

    const valores = pts.flatMap((p) => (p.v2 != null ? [p.v, p.v2] : [p.v]));
    this.lineasReferencia().forEach((r) => valores.push(r.valor));
    let min = Math.min(...valores);
    let max = Math.max(...valores);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t || t0 + 1;
    const X = (t: number) => m.l + (t1 === t0 ? pw / 2 : ((t - t0) / (t1 - t0)) * pw);
    const Y = (v: number) => m.t + ph - ((v - min) / (max - min)) * ph;

    if (!compacto) {
      ctx.strokeStyle = 'rgba(127,142,163,0.18)';
      ctx.fillStyle = '#7f8ea3';
      ctx.font = '11px system-ui';
      ctx.lineWidth = 1;
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const v = min + ((max - min) * i) / 4;
        const y = Y(v);
        ctx.beginPath();
        ctx.moveTo(m.l, y);
        ctx.lineTo(w - m.r, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(max - min < 10 ? 1 : 0), m.l - 6, y + 4);
      }
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const t = t0 + ((t1 - t0) * i) / 4;
        ctx.fillText(new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }), X(t), h - 8);
      }
      for (const r of this.lineasReferencia()) {
        ctx.strokeStyle = 'rgba(255,92,92,0.6)';
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(m.l, Y(r.valor));
        ctx.lineTo(w - m.r, Y(r.valor));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,92,92,0.85)';
        ctx.textAlign = 'left';
        ctx.fillText(r.etiqueta, m.l + 4, Y(r.valor) - 4);
      }
    }

    const linea = (sel: (p: SeriePunto) => number | undefined, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = compacto ? 1.5 : 2;
      ctx.beginPath();
      let empezado = false;
      for (const p of pts) {
        const v = sel(p);
        if (v == null) continue;
        if (!empezado) {
          ctx.moveTo(X(p.t), Y(v));
          empezado = true;
        } else ctx.lineTo(X(p.t), Y(v));
      }
      ctx.stroke();
    };
    linea((p) => p.v, this.color());
    if (pts.some((p) => p.v2 != null)) linea((p) => p.v2, this.color2());
  }
}

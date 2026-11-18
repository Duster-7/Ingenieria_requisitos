import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild } from '@angular/core';

const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

/** Morfología sintética de un latido (fase 0..1) a partir de la FC real del paciente. */
function ecg(fase: number): number {
  return (
    0.12 * gauss(fase, 0.18, 0.025) -
    0.12 * gauss(fase, 0.36, 0.009) +
    1.0 * gauss(fase, 0.39, 0.011) -
    0.28 * gauss(fase, 0.425, 0.012) +
    0.3 * gauss(fase, 0.63, 0.045)
  );
}

function pleth(fase: number): number {
  return 0.85 * gauss(fase, 0.28, 0.09) + 0.32 * gauss(fase, 0.56, 0.07);
}

/**
 * RF-05 — Curva ECG en la pantalla bedside con refresco ≥ 60 FPS.
 * Dibujo con barrido tipo monitor sobre <canvas> usando requestAnimationFrame;
 * reporta los FPS medidos cada segundo para su verificación.
 */
@Component({
  selector: 'app-waveform-monitor',
  template: `<canvas #canvas class="wave-canvas" [style.height.px]="alto()"></canvas>`,
  host: { class: 'wave-host' }
})
export class WaveformMonitorComponent implements AfterViewInit, OnDestroy {
  readonly tipo = input<'ecg' | 'pleth'>('ecg');
  readonly frecuencia = input<number | null>(null);
  readonly color = input('#3ef07a');
  readonly alto = input(180);
  readonly velocidad = input(150); // px/s (~25 mm/s)
  readonly fps = output<number>();

  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;
  private ultimo = 0;
  private x = 0;
  private yPrev: number | null = null;
  private fase = 0;
  private frames = 0;
  private inicioVentana = 0;
  private dpr = 1;
  private ancho = 0;
  private altoPx = 0;
  private ro?: ResizeObserver;

  constructor() {
    effect(() => {
      // al cambiar el color/tipo se reinicia el trazo
      this.color();
      this.tipo();
      if (this.ctx) this.limpiar();
    });
  }

  ngAfterViewInit(): void {
    const c = this.canvas().nativeElement;
    this.ctx = c.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.ajustarTamano());
    this.ro.observe(c);
    this.ajustarTamano();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  private ajustarTamano(): void {
    const c = this.canvas().nativeElement;
    this.dpr = window.devicePixelRatio || 1;
    this.ancho = c.clientWidth;
    this.altoPx = c.clientHeight;
    c.width = Math.round(this.ancho * this.dpr);
    c.height = Math.round(this.altoPx * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.limpiar();
  }

  private limpiar(): void {
    this.ctx.clearRect(0, 0, this.ancho, this.altoPx);
    this.x = 0;
    this.yPrev = null;
  }

  private valor(fase: number): number {
    return this.tipo() === 'ecg' ? ecg(fase) : pleth(fase);
  }

  private frame(t: number): void {
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    if (!this.ultimo) {
      this.ultimo = t;
      this.inicioVentana = t;
      return;
    }
    const dt = Math.min(0.1, (t - this.ultimo) / 1000);
    this.ultimo = t;

    // medición de FPS
    this.frames++;
    if (t - this.inicioVentana >= 1000) {
      this.fps.emit(Math.round((this.frames * 1000) / (t - this.inicioVentana)));
      this.frames = 0;
      this.inicioVentana = t;
    }

    const ctx = this.ctx;
    const h = this.altoPx;
    const fc = this.frecuencia();
    const avancePx = this.velocidad() * dt;
    const latidosPorPx = fc ? fc / 60 / this.velocidad() : 0;
    const base = this.tipo() === 'ecg' ? h * 0.62 : h * 0.8;
    const escala = this.tipo() === 'ecg' ? h * 0.5 : h * 0.62;

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.color();
    ctx.shadowColor = this.color();
    ctx.shadowBlur = 6;

    let restante = avancePx;
    while (restante > 0) {
      const paso = Math.min(restante, this.ancho - this.x);
      // borra por delante del cursor (efecto barrido)
      ctx.clearRect(this.x, 0, paso + 14, h);
      ctx.beginPath();
      if (this.yPrev != null) ctx.moveTo(this.x, this.yPrev);
      for (let i = 0; i <= paso; i += 1) {
        this.fase = (this.fase + latidosPorPx) % 1;
        const ruido = fc ? (Math.random() - 0.5) * 0.015 : 0;
        const y = base - (fc ? this.valor(this.fase) + ruido : 0) * escala;
        if (this.yPrev == null) ctx.moveTo(this.x + i, y);
        else ctx.lineTo(this.x + i, y);
        this.yPrev = y;
      }
      ctx.stroke();
      this.x += paso;
      restante -= paso;
      if (this.x >= this.ancho) {
        this.x = 0;
        this.yPrev = null;
      }
    }
  }
}

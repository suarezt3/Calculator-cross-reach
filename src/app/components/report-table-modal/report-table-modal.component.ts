import { Component, Input, Output, EventEmitter, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryRow, PlatformReach } from '../../models/platform.models';
import { toBlob, toPng } from 'html-to-image';

@Component({
  selector: 'app-report-table-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <div class="header-icon">📸</div>
            <div>
              <h2 class="modal-title">Tabla Resumen para Reporte</h2>
              <p class="modal-subtitle">Estructura condensada para presentaciones ejecutivas y capturas de pantalla</p>
            </div>
          </div>

          <div class="header-actions">
            <!-- Selector de formato de porcentaje -->
            <div class="segmented-control">
              <button
                type="button"
                [class.active]="decimals() === 0"
                (click)="decimals.set(0)"
                class="seg-btn"
                title="Porcentajes enteros (ej. 85%)"
              >
                Enteros (85%)
              </button>
              <button
                type="button"
                [class.active]="decimals() === 1"
                (click)="decimals.set(1)"
                class="seg-btn"
                title="Porcentajes con decimal (ej. 85.2%)"
              >
                Decimal (85.2%)
              </button>
            </div>

            <!-- Toggle de incluir mercados -->
            <label class="toggle-label" title="Incluir u omitir Casaca / Latam en la tabla">
              <input
                type="checkbox"
                [checked]="includeMarkets()"
                (change)="includeMarkets.set(!includeMarkets())"
                class="toggle-checkbox"
              />
              <span class="toggle-text">Incluir Mercados</span>
            </label>

            <button type="button" class="btn-close" (click)="close.emit()" aria-label="Cerrar">✕</button>
          </div>
        </div>

        <!-- Toolbar de exportación rápida -->
        <div class="export-toolbar">
          <div class="toolbar-hint">
            <span>💡</span>
            <span>Usa <strong>Copiar Imagen</strong> para pegar directamente (Ctrl+V) en PowerPoint, Google Slides o Slack.</span>
          </div>

          <div class="btn-group">
            <button
              type="button"
              class="btn-action btn-copy"
              (click)="copyImageToClipboard()"
              [disabled]="isExporting()"
              title="Copiar imagen al portapapeles"
            >
              <span>{{ copyStatus() }}</span>
            </button>

            <button
              type="button"
              class="btn-action btn-download"
              (click)="downloadAsPng()"
              [disabled]="isExporting()"
              title="Descargar imagen en formato PNG"
            >
              <span>📥 Descargar PNG</span>
            </button>

            <button
              type="button"
              class="btn-action btn-excel"
              (click)="copyAsSpreadsheetTsv()"
              title="Copiar celdas de texto para Excel o Google Sheets"
            >
              <span>📋 Copiar Datos (Excel)</span>
            </button>
          </div>
        </div>

        <!-- Toast de confirmación -->
        @if (toastMessage()) {
          <div class="toast-banner">
            <span>✅</span>
            <span>{{ toastMessage() }}</span>
          </div>
        }

        <!-- Lienzo de la Tabla para Captura -->
        <div class="table-preview-scroll">
          <div class="screenshot-canvas-wrapper" #tableCanvasContainer>
            <table class="report-table">
              <thead>
                <tr>
                  <!-- Celda esquina superior izquierda -->
                  <th class="corner-cell"></th>
                  <!-- Cabeceras de Países / Mercados -->
                  @for (col of activeColumns(); track col.country) {
                    <th class="country-header-cell">
                      {{ getCountryCode(col.country) }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                <!-- Filas de Plataformas -->
                @for (platformName of activePlatforms(); track platformName) {
                  <tr>
                    <td class="platform-row-header">{{ platformName }}</td>
                    @for (col of activeColumns(); track col.country) {
                      <td class="data-cell">
                        {{ formatPercentage(getPlatformReachPercent(col, platformName)) }}
                      </td>
                    }
                  </tr>
                }

                <!-- Fila: Volumen total -->
                <tr class="summary-row-volume">
                  <td class="summary-label">Volumen total</td>
                  @for (col of activeColumns(); track col.country) {
                    <td class="data-cell-volume">
                      {{ formatVolume(col.crossReach ?? 0) }}
                    </td>
                  }
                </tr>

                <!-- Fila: Total % -->
                <tr class="summary-row-total">
                  <td class="summary-label">Total %</td>
                  @for (col of activeColumns(); track col.country) {
                    <td class="data-cell-total">
                      {{ formatPercentage(col.crossReachPercentage ?? 0) }}
                    </td>
                  }
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <span class="footer-note">
            Visualización con estilo idéntico al reporte ejecutivo (resolución optimizada para copiado nítido a 2x).
          </span>
          <button type="button" class="btn-done" (click)="close.emit()">
            Listo
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 16px;
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 980px;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: scale(0.97) translateY(8px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      width: 40px;
      height: 40px;
      background: #eff6ff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .modal-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 2px 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .segmented-control {
      display: inline-flex;
      background: #e2e8f0;
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }

    .seg-btn {
      border: none;
      background: transparent;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      user-select: none;
      background: #f1f5f9;
      padding: 5px 10px;
      border-radius: 8px;
    }

    .toggle-checkbox {
      cursor: pointer;
      accent-color: #2563eb;
    }

    .btn-close {
      background: transparent;
      border: 1px solid #cbd5e1;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 14px;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
    }

    .export-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 24px;
      background: #ffffff;
      border-bottom: 1px solid #f1f5f9;
    }

    .toolbar-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #475569;
    }

    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-action {
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      &.btn-copy {
        background: #2563eb;
        color: #ffffff;

        &:hover:not(:disabled) {
          background: #1d4ed8;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
      }

      &.btn-download {
        background: #0f172a;
        color: #ffffff;

        &:hover:not(:disabled) {
          background: #1e293b;
        }
      }

      &.btn-excel {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;

        &:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
      }
    }

    .toast-banner {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      padding: 10px 24px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .table-preview-scroll {
      padding: 32px 24px;
      background: #f8fafc;
      overflow-x: auto;
      display: flex;
      justify-content: center;
    }

    /* Contenedor exacto para captura de pantalla */
    .screenshot-canvas-wrapper {
      background: #ffffff;
      padding: 24px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      display: inline-block;
      min-width: 480px;
    }

    /* Tabla con estilo idéntico a la imagen adjunta */
    .report-table {
      border-collapse: collapse;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: #ffffff;
      width: 100%;

      th, td {
        border: 1px solid #cbd5e1;
        padding: 9px 20px;
      }
    }

    .corner-cell {
      border: none !important;
      background: transparent !important;
      min-width: 130px;
    }

    .country-header-cell {
      background-color: #B8D4EE !important; /* Azul pastel de la imagen */
      color: #0f172a !important;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 15px;
      font-weight: 800;
      text-align: center;
      letter-spacing: 0.04em;
      min-width: 90px;
      padding: 10px 20px;
    }

    .platform-row-header {
      background-color: #ffffff;
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      text-align: left;
      white-space: nowrap;
      padding: 9px 20px;
    }

    .data-cell {
      background-color: #ffffff;
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      text-align: right;
      font-variant-numeric: tabular-nums;
      padding: 9px 20px;
    }

    .summary-row-volume {
      .summary-label {
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        font-weight: 700;
        font-size: 14px;
        color: #0f172a;
        white-space: nowrap;
      }
      .data-cell-volume {
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        font-weight: 600;
        font-size: 14px;
        text-align: right;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
      }
    }

    .summary-row-total {
      .summary-label {
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        font-weight: 700;
        font-size: 14px;
        color: #0f172a;
      }
      .data-cell-total {
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        font-weight: 700;
        font-size: 14px;
        text-align: right;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
      }
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .footer-note {
      font-size: 12px;
      color: #64748b;
    }

    .btn-done {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: #1e293b;
      }
    }
  `]
})
export class ReportTableModalComponent {
  @Input() rows: CountryRow[] = [];
  @Output() close = new EventEmitter<void>();

  @ViewChild('tableCanvasContainer') tableContainer!: ElementRef<HTMLDivElement>;

  decimals = signal<number>(0);
  includeMarkets = signal<boolean>(false);
  isExporting = signal<boolean>(false);
  copyStatus = signal<string>('📷 Copiar Imagen');
  toastMessage = signal<string | null>(null);

  // Mapeo oficial de códigos de 3 letras
  private readonly countryCodeMap: { [key: string]: string } = {
    'colombia': 'COL',
    'chile': 'CHL',
    'peru': 'PER',
    'perú': 'PER',
    'costa rica': 'CRI',
    'mexico': 'MEX',
    'méxico': 'MEX',
    'argentina': 'ARG',
    'brasil': 'BRA',
    'brazil': 'BRA',
    'ecuador': 'ECU',
    'panama': 'PAN',
    'panamá': 'PAN',
    'guatemala': 'GTM',
    'españa': 'ESP',
    'spain': 'ESP',
    'estados unidos': 'USA',
    'usa': 'USA',
    'casaca': 'CASACA',
    'latam': 'LATAM'
  };

  activeColumns = computed(() => {
    const list = this.rows || [];
    if (this.includeMarkets()) {
      return list;
    }
    return list.filter(r => !r.isMarket);
  });

  activePlatforms = computed(() => {
    const cols = this.activeColumns();
    const set = new Set<string>();
    cols.forEach(col => {
      col.platforms.forEach(p => {
        if (p.platformName) set.add(p.platformName);
      });
    });

    // Orden canónico preferido si existen
    const canonicalOrder = ['Meta', 'YouTube', 'Youtube', 'TikTok', 'Tiktok', 'Display'];
    const sorted: string[] = [];
    canonicalOrder.forEach(name => {
      if (set.has(name) && !sorted.includes(name)) {
        sorted.push(name);
        set.delete(name);
      }
    });

    set.forEach(p => sorted.push(p));
    return sorted;
  });

  getCountryCode(country: string): string {
    const norm = (country || '').trim().toLowerCase();
    if (this.countryCodeMap[norm]) {
      return this.countryCodeMap[norm];
    }
    // Fallback: 3 primeras letras mayúsculas
    return country.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  }

  getPlatformReachPercent(row: CountryRow, platformName: string): number {
    const p = row.platforms.find(
      item => item.platformName.toLowerCase() === platformName.toLowerCase()
    );
    if (!p || !row.universe || row.universe === 0) return 0;
    return ((p.reach ?? 0) / row.universe) * 100;
  }

  formatPercentage(val: number): string {
    if (val === undefined || val === null || isNaN(val)) return '0%';
    const dec = this.decimals();
    return `${val.toFixed(dec)}%`;
  }

  formatVolume(num: number): string {
    if (!num) return '0';
    // Formato con punto como separador de miles tal como en la imagen (545.111)
    return Math.round(num)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  async copyImageToClipboard(): Promise<void> {
    if (!this.tableContainer?.nativeElement) return;
    this.isExporting.set(true);
    this.copyStatus.set('⏳ Copiando...');

    try {
      const node = this.tableContainer.nativeElement;
      const blob = await toBlob(node, {
        pixelRatio: 2.5, // Ultra nítido para Retina y presentaciones
        backgroundColor: '#ffffff'
      });

      if (!blob) throw new Error('No se pudo generar el blob de la imagen');

      // Intentar copiar con Clipboard API estándar
      if (navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        this.showToast('¡Imagen copiada al portapapeles! Lista para pegar (Ctrl+V) en tu presentación.');
      } else {
        // Fallback: descarga directa si el portapapeles no tiene permisos
        this.downloadBlob(blob, 'tabla_reporte_multialcance.png');
        this.showToast('Imagen descargada (tu navegador no permite acceso directo al portapapeles).');
      }
    } catch (err) {
      console.error('Error al copiar imagen:', err);
      // Fallback a descarga si falla la API
      await this.downloadAsPng();
      this.showToast('Imagen guardada como archivo PNG.');
    } finally {
      this.isExporting.set(false);
      this.copyStatus.set('📷 Copiar Imagen');
    }
  }

  async downloadAsPng(): Promise<void> {
    if (!this.tableContainer?.nativeElement) return;
    this.isExporting.set(true);

    try {
      const node = this.tableContainer.nativeElement;
      const dataUrl = await toPng(node, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff'
      });

      const link = document.createElement('a');
      link.download = `tabla_reporte_multialcance_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('¡Imagen PNG descargada con éxito!');
    } catch (err) {
      console.error('Error al descargar PNG:', err);
      this.showToast('Hubo un error al generar la imagen.');
    } finally {
      this.isExporting.set(false);
    }
  }

  copyAsSpreadsheetTsv(): void {
    const cols = this.activeColumns();
    const platforms = this.activePlatforms();

    // Fila cabecera
    const header = ['\t' + cols.map(c => this.getCountryCode(c.country)).join('\t')];

    // Filas plataformas
    const body = platforms.map(p => {
      const vals = cols.map(c => this.formatPercentage(this.getPlatformReachPercent(c, p)));
      return [p, ...vals].join('\t');
    });

    // Fila volumen total
    const volumeRow = [
      'Volumen total',
      ...cols.map(c => this.formatVolume(c.crossReach ?? 0))
    ].join('\t');

    // Fila total %
    const totalRow = [
      'Total %',
      ...cols.map(c => this.formatPercentage(c.crossReachPercentage ?? 0))
    ].join('\t');

    const tsv = [...header, ...body, volumeRow, totalRow].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(tsv).then(() => {
        this.showToast('¡Datos copiados! Pégalos directamente en celdas de Excel o Google Sheets.');
      });
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4000);
  }
}

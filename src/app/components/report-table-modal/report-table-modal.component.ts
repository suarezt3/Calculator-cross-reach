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

            <button type="button" class="btn-close" (click)="close.emit()" aria-label="Cerrar">✕</button>
          </div>
        </div>

        <!-- Panel de Selección de Columnas (Países y Mercados) -->
        <div class="column-selection-panel">
          <div class="selection-panel-header">
            <div class="panel-header-left">
              <span class="selection-icon">🎯</span>
              <span class="selection-title">Seleccionar columnas para la tabla:</span>
              <span class="selection-badge">
                {{ activeColumns().length }} de {{ allAvailableColumns().length }} seleccionados
              </span>
            </div>

            <div class="quick-select-actions">
              <button
                type="button"
                (click)="selectAllColumns()"
                class="btn-quick-select"
                title="Mostrar todas las columnas disponibles"
              >
                <span>✓ Marcar todos</span>
              </button>
              <button
                type="button"
                (click)="deselectAllColumns()"
                class="btn-quick-select"
                title="Desmarcar todas las columnas"
              >
                <span>✕ Desmarcar todos</span>
              </button>
            </div>
          </div>

          <div class="chips-container">
            @for (col of allAvailableColumns(); track getColumnKey(col)) {
              @let key = getColumnKey(col);
              @let isSelected = isColumnActive(key);
              <button
                type="button"
                (click)="toggleColumn(key)"
                class="country-chip"
                [class.selected]="isSelected"
                [class.is-market]="col.isMarket"
                [title]="col.isMarket ? ('Mercado regional: ' + getCountryCode(col.country)) : ('País: ' + col.country)"
              >
                <span class="chip-checkbox" [class.checked]="isSelected" [class.market-check]="col.isMarket">
                  @if (isSelected) {
                    <svg viewBox="0 0 20 20" fill="currentColor" class="chip-check-svg">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  }
                </span>

                <span class="chip-code">{{ getCountryCode(col.country) }}</span>

                @if (!col.isMarket) {
                  <span class="chip-name">{{ col.country }}</span>
                } @else {
                  <span class="chip-market-badge">REGIONAL</span>
                }
              </button>
            }
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
              [disabled]="isExporting() || activeColumns().length === 0"
              title="Copiar imagen al portapapeles"
            >
              <span>{{ copyStatus() }}</span>
            </button>

            <button
              type="button"
              class="btn-action btn-download"
              (click)="downloadAsPng()"
              [disabled]="isExporting() || activeColumns().length === 0"
              title="Descargar imagen en formato PNG"
            >
              <span>📥 Descargar PNG</span>
            </button>

            <button
              type="button"
              class="btn-action btn-excel"
              (click)="copyAsSpreadsheetTsv()"
              [disabled]="activeColumns().length === 0"
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
          @if (activeColumns().length === 0) {
            <div class="empty-columns-state">
              <div class="empty-icon">🗺️</div>
              <h3 class="empty-title">Ningún país o mercado seleccionado</h3>
              <p class="empty-desc">
                Haz clic en los chips superiores para seleccionar qué columnas deseas incluir en el reporte, o pulsa el botón siguiente:
              </p>
              <button
                type="button"
                class="btn-restore-selection"
                (click)="selectAllColumns()"
              >
                <span>✓ Seleccionar todos los países</span>
              </button>
            </div>
          } @else {
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
          }
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <span class="footer-note">
            Tipografía Plus Jakarta Sans y diseño idéntico al reporte ejecutivo (resolución 2.5x optimizada para copiado nítido).
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
      max-width: 1020px;
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
      padding: 18px 24px;
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

    /* Panel de selección interactiva de columnas */
    .column-selection-panel {
      padding: 14px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .selection-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 10px;
    }

    .panel-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .selection-icon {
      font-size: 15px;
    }

    .selection-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }

    .selection-badge {
      font-size: 11px;
      font-weight: 600;
      color: #2563eb;
      background: #dbeafe;
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .quick-select-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-quick-select {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #94a3b8;
      }
    }

    .chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .country-chip {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;

      &:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
      }

      &.selected {
        background: #eff6ff;
        border-color: #3b82f6;
        box-shadow: 0 1px 2px rgba(59, 130, 246, 0.1);

        .chip-code {
          color: #1d4ed8;
        }

        .chip-name {
          color: #3b82f6;
        }
      }

      &.is-market {
        border-style: dashed;
        border-color: #c084fc;

        &.selected {
          border-style: solid;
          background: #faf5ff;
          border-color: #9333ea;
          box-shadow: 0 1px 2px rgba(147, 51, 234, 0.12);

          .chip-code {
            color: #7e22ce;
          }
        }
      }
    }

    .chip-checkbox {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1.5px solid #94a3b8;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;

      &.checked {
        background: #2563eb;
        border-color: #2563eb;
        color: #ffffff;
      }

      &.checked.market-check {
        background: #9333ea;
        border-color: #9333ea;
      }
    }

    .chip-check-svg {
      width: 12px;
      height: 12px;
      stroke-width: 1;
    }

    .chip-code {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 800;
      color: #334155;
      letter-spacing: 0.02em;
    }

    .chip-name {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .chip-market-badge {
      font-size: 10px;
      font-weight: 800;
      color: #7e22ce;
      background: #f3e8ff;
      padding: 1px 6px;
      border-radius: 4px;
      letter-spacing: 0.05em;
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
        opacity: 0.45;
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

        &:hover:not(:disabled) {
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
      padding: 28px 24px;
      background: #f8fafc;
      overflow-x: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 240px;
    }

    /* Estado vacío si no hay columnas seleccionadas */
    .empty-columns-state {
      background: #ffffff;
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 36px 32px;
      text-align: center;
      max-width: 480px;
      margin: auto;
    }

    .empty-icon {
      font-size: 36px;
      margin-bottom: 8px;
    }

    .empty-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 6px;
    }

    .empty-desc {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 16px;
      line-height: 1.5;
    }

    .btn-restore-selection {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover {
        background: #1d4ed8;
      }
    }

    /* Contenedor exacto para captura de pantalla */
    .screenshot-canvas-wrapper {
      background: #ffffff;
      padding: 24px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      display: inline-block;
      min-width: 420px;
    }

    /* Tabla con estilo corporativo Plus Jakarta Sans */
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
      background-color: #B8D4EE !important; /* Azul pastel corporativo */
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
      flex-wrap: wrap;
      gap: 12px;
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
  private _rows = signal<CountryRow[]>([]);

  @Input() set rows(val: CountryRow[]) {
    const list = val || [];
    this._rows.set(list);
    // Inicializar selección con todas las columnas disponibles al cargar
    if (!this.initializedSelection && list.length > 0) {
      const allKeys = new Set(list.map(r => this.getColumnKey(r)));
      this.selectedColumnKeys.set(allKeys);
      this.initializedSelection = true;
    }
  }
  get rows(): CountryRow[] {
    return this._rows();
  }

  @Output() close = new EventEmitter<void>();

  @ViewChild('tableCanvasContainer') tableContainer!: ElementRef<HTMLDivElement>;

  decimals = signal<number>(0);
  isExporting = signal<boolean>(false);
  copyStatus = signal<string>('📷 Copiar Imagen');
  toastMessage = signal<string | null>(null);

  private initializedSelection = false;
  selectedColumnKeys = signal<Set<string>>(new Set());

  // Mapeo oficial de códigos de 3 letras y mercados en mayúsculas
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

  allAvailableColumns = computed(() => {
    return this._rows();
  });

  activeColumns = computed(() => {
    const list = this._rows();
    const selected = this.selectedColumnKeys();
    return list.filter(r => selected.has(this.getColumnKey(r)));
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

  getColumnKey(col: CountryRow): string {
    return col.id || col.country.trim().toLowerCase();
  }

  isColumnActive(key: string): boolean {
    return this.selectedColumnKeys().has(key);
  }

  toggleColumn(key: string): void {
    this.selectedColumnKeys.update(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  selectAllColumns(): void {
    const all = new Set(this.allAvailableColumns().map(c => this.getColumnKey(c)));
    this.selectedColumnKeys.set(all);
  }

  deselectAllColumns(): void {
    this.selectedColumnKeys.set(new Set());
  }

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
    if (!this.tableContainer?.nativeElement || this.activeColumns().length === 0) return;
    this.isExporting.set(true);
    this.copyStatus.set('Generando imagen...');

    try {
      const node = this.tableContainer.nativeElement;
      const blob = await toBlob(node, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff'
      });

      if (!blob) {
        throw new Error('No se pudo generar el Blob de la imagen');
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      this.copyStatus.set('✓ ¡Copiada!');
      this.showToast('¡Imagen copiada al portapapeles! Puedes pegarla con Ctrl+V.');
      setTimeout(() => {
        this.copyStatus.set('📷 Copiar Imagen');
      }, 3000);
    } catch (err) {
      console.error('Error al copiar imagen:', err);
      this.copyStatus.set('Error al copiar');
      this.showToast('No se pudo copiar automáticamente. Usa "Descargar PNG".');
      setTimeout(() => {
        this.copyStatus.set('📷 Copiar Imagen');
      }, 3000);
    } finally {
      this.isExporting.set(false);
    }
  }

  async downloadAsPng(): Promise<void> {
    if (!this.tableContainer?.nativeElement || this.activeColumns().length === 0) return;
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
    if (cols.length === 0) return;
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
    const totalPercentRow = [
      'Total %',
      ...cols.map(c => this.formatPercentage(c.crossReachPercentage ?? 0))
    ].join('\t');

    const tsvContent = [
      ...header,
      ...body,
      volumeRow,
      totalPercentRow
    ].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
      this.showToast('¡Datos copiados! Pégalos directamente en Excel o Google Sheets.');
    }).catch(err => {
      console.error('Error al copiar TSV:', err);
      this.showToast('Error al copiar datos en formato Excel.');
    });
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4000);
  }
}

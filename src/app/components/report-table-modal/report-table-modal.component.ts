import { Component, Input, Output, EventEmitter, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryRow, PlatformReach } from '../../models/platform.models';
import { toBlob, toPng } from 'html-to-image';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Camera01Icon,
  Download01Icon,
  Copy01Icon
} from '@hugeicons/core-free-icons';

export interface MediaRowReport {
  name: string;
  reach: number;
  percentage: number;
}

@Component({
  selector: 'app-report-table-modal',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <div class="header-icon">📸</div>
            <div>
              <h2 class="modal-title">Tabla Resumen para Reporte</h2>
              <p class="modal-subtitle">Estructuras ejecutivas optimizadas para presentaciones y capturas de pantalla</p>
            </div>
          </div>

          <div class="header-actions">
            <!-- Selector de 3 Vistas Principales -->
            <div class="view-mode-control">
              <button
                type="button"
                [class.active]="viewMode() === 'multi_matrix'"
                (click)="viewMode.set('multi_matrix')"
                class="view-btn"
                title="Tabla comparativa con varios países en columnas"
              >
                <span>📊 Matriz Multi-País</span>
              </button>
              <button
                type="button"
                [class.active]="viewMode() === 'single_card'"
                (click)="viewMode.set('single_card')"
                class="view-btn"
                title="Ficha individual vertical (MEDIO | REACH | %)"
              >
                <span>📑 Ficha Individual</span>
              </button>
              <button
                type="button"
                [class.active]="viewMode() === 'all_grid'"
                (click)="viewMode.set('all_grid')"
                class="view-btn"
                title="Ver todas las fichas lado a lado"
              >
                <span>🗂️ Ver Todas</span>
              </button>
            </div>

            <!-- Selector de formato de porcentaje / separador -->
            <div class="format-controls-group">
              <div class="segmented-control" title="Separador de miles">
                <button
                  type="button"
                  [class.active]="thousandsSeparator() === 'comma'"
                  (click)="thousandsSeparator.set('comma')"
                  class="seg-btn"
                  title="Comas: 19,716,710"
                >
                  ,
                </button>
                <button
                  type="button"
                  [class.active]="thousandsSeparator() === 'dot'"
                  (click)="thousandsSeparator.set('dot')"
                  class="seg-btn"
                  title="Puntos: 19.716.710"
                >
                  .
                </button>
              </div>

              <!-- Control Global de Decimales en Porcentajes -->
              <div class="segmented-control" title="Formato global de decimales en todos los porcentajes">
                <span class="control-label">%:</span>
                <button
                  type="button"
                  [class.active]="percentDecimals() === 0"
                  (click)="percentDecimals.set(0)"
                  class="seg-btn"
                  title="Porcentajes enteros en toda la tabla (37%, 64%)"
                >
                  37%
                </button>
                <button
                  type="button"
                  [class.active]="percentDecimals() === 2"
                  (click)="percentDecimals.set(2)"
                  class="seg-btn"
                  title="Dos decimales en toda la tabla (37.20%, 64.00%)"
                >
                  37.20%
                </button>
              </div>
            </div>

            <button type="button" class="btn-close" (click)="close.emit()" aria-label="Cerrar">✕</button>
          </div>
        </div>

        <!-- ========================================================
             SUB-TOOLBAR CONTEXTUAL SEGÚN LA VISTA
             ======================================================== -->
        
        <!-- VISTA 1: Selector de Columnas Multi-País -->
        @if (viewMode() === 'multi_matrix') {
          <div class="column-selection-panel">
            <div class="selection-panel-header">
              <div class="panel-header-left">
                <span class="selection-icon">🎯</span>
                <span class="selection-title">Seleccionar países a incluir en la matriz comparativa:</span>
                <span class="selection-badge">
                  {{ activeColumns().length }} de {{ allAvailableColumns().length }} seleccionados
                </span>
              </div>

              <div class="quick-select-actions">
                <button
                  type="button"
                  (click)="selectAllColumns()"
                  class="btn-quick-select"
                  title="Mostrar todas las columnas"
                >
                  <span>✓ Todos</span>
                </button>
                <button
                  type="button"
                  (click)="deselectAllColumns()"
                  class="btn-quick-select"
                  title="Desmarcar todas"
                >
                  <span>✕ Ninguno</span>
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
                  [title]="col.country"
                >
                  <span class="chip-checkbox" [class.checked]="isSelected" [class.market-check]="col.isMarket">
                    @if (isSelected) {
                      <svg viewBox="0 0 20 20" fill="currentColor" class="chip-check-svg">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    }
                  </span>

                  <span class="chip-code">{{ getCountryCode(col.country) }}</span>
                  <span class="chip-name">{{ col.country }}</span>
                  @if (col.isMarket) {
                    <span class="chip-market-badge">REGIONAL</span>
                  }
                </button>
              }
            </div>
          </div>
        }

        <!-- VISTA 2: Selector de Iniciales para Ficha Individual -->
        @if (viewMode() === 'single_card') {
          <div class="initials-selector-bar">
            <span class="initials-hint-label">Seleccionar país:</span>
            <div class="initials-tabs-wrap">
              @for (item of availableTargets(); track getTargetKey(item)) {
                @let key = getTargetKey(item);
                @let isSelected = selectedTargetKey() === key;
                <button
                  type="button"
                  (click)="selectTarget(key)"
                  class="initial-tab-btn"
                  [class.active]="isSelected"
                  [class.is-market]="item.isMarket"
                  [title]="item.country"
                >
                  <span class="initial-code">{{ getCountryCode(item.country) }}</span>
                  <span class="initial-subname">{{ item.country }}</span>
                </button>
              }
            </div>
          </div>
        }

        <!-- VISTA 3: Info Bar para Ver Todas -->
        @if (viewMode() === 'all_grid') {
          <div class="grid-info-bar">
            <span>💡</span>
            <span>
              Mostrando <strong>{{ availableTargets().length }} fichas ejecutivas</strong> adaptadas a sus medios activos. Puedes copiar o descargar cada tarjeta con sus botones dedicados.
            </span>
          </div>
        }

        <!-- Toolbar de exportación general (Activo para Matriz o Ficha Individual) -->
        @if (viewMode() !== 'all_grid') {
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
                [disabled]="isExporting() || (viewMode() === 'multi_matrix' && activeColumns().length === 0)"
                title="Copiar imagen al portapapeles"
              >
                <span>{{ copyStatus() }}</span>
              </button>

              <button
                type="button"
                class="btn-action btn-download"
                (click)="downloadAsPng()"
                [disabled]="isExporting() || (viewMode() === 'multi_matrix' && activeColumns().length === 0)"
                title="Descargar imagen en formato PNG"
              >
                <span>📥 Descargar PNG</span>
              </button>

              <button
                type="button"
                class="btn-action btn-excel"
                (click)="copyAsSpreadsheetTsv()"
                [disabled]="viewMode() === 'multi_matrix' && activeColumns().length === 0"
                title="Copiar celdas de texto para Excel o Google Sheets"
              >
                <span>📋 Copiar Datos (Excel)</span>
              </button>
            </div>
          </div>
        }

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

            <!-- ========================================================
                 VISTA 1: MATRIZ MULTI-PAÍS (ORIGINAL CONSOLIDADA)
                 ======================================================== -->
            @if (viewMode() === 'multi_matrix') {
              @if (activeColumns().length === 0) {
                <div class="empty-state-notice">
                  <span class="empty-icon">🗺️</span>
                  <p class="empty-text">Selecciona al menos un país arriba para generar la matriz comparativa.</p>
                </div>
              } @else {
                <table class="matrix-report-table">
                  <thead>
                    <tr>
                      <th class="corner-cell">MEDIO</th>
                      @for (col of activeColumns(); track col.country) {
                        <th class="country-header-cell" [class.header-market]="col.isMarket">
                          {{ getCountryCode(col.country) }}
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (platformName of activePlatforms(); track platformName) {
                      <tr>
                        <td class="platform-row-header">{{ platformName }}</td>
                        @for (col of activeColumns(); track col.country) {
                          <td class="data-cell">
                            {{ formatMatrixPercentage(getPlatformReachPercent(col, platformName)) }}
                          </td>
                        }
                      </tr>
                    }

                    <tr class="summary-row-volume">
                      <td class="summary-label">Volumen total</td>
                      @for (col of activeColumns(); track col.country) {
                        <td class="data-cell-volume tabular">
                          {{ formatNumber(col.crossReach ?? 0) }}
                        </td>
                      }
                    </tr>

                    <tr class="summary-row-total">
                      <td class="summary-label">Total %</td>
                      @for (col of activeColumns(); track col.country) {
                        <td class="data-cell-total tabular">
                          {{ formatTotalPercentage(col.crossReachPercentage ?? 0) }}
                        </td>
                      }
                    </tr>
                  </tbody>
                </table>
              }
            }

            <!-- ========================================================
                 VISTA 2: FICHA INDIVIDUAL (FORMATO EXACTO DE LA REFERENCIA)
                 ======================================================== -->
            @if (viewMode() === 'single_card') {
              @let target = selectedTarget();
              @if (target) {
                @let mediaRows = getActiveMediaRowsForTarget(target);
                <div class="single-card-render">
                  <table class="executive-table">
                    <thead>
                      <tr>
                        <th class="th-medio">MEDIO</th>
                        <th class="th-reach">REACH</th>
                        <th class="th-pct">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of mediaRows; track row.name) {
                        <tr class="tr-data">
                          <td class="td-medio">{{ row.name }}</td>
                          <td class="td-reach tabular">{{ formatNumber(row.reach) }}</td>
                          <td class="td-pct tabular">{{ formatPercentage(row.percentage) }}</td>
                        </tr>
                      }

                      <!-- Fila TOTAL en Verde Salvia -->
                      <tr class="tr-total">
                        <td class="td-total-label">TOTAL</td>
                        <td class="td-total-reach tabular">{{ formatNumber(target.crossReach ?? 0) }}</td>
                        <td class="td-total-pct tabular">{{ formatTotalPercentage(target.crossReachPercentage ?? 0) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
            }

            <!-- ========================================================
                 VISTA 3: VER TODAS (CUADRÍCULA CON BOTONES INDIVIDUALES)
                 ======================================================== -->
            @if (viewMode() === 'all_grid') {
              <div class="all-grid-container">
                @for (target of availableTargets(); track target.id) {
                  @let mediaRows = getActiveMediaRowsForTarget(target);
                  <div class="grid-card-item">
                    <!-- Cabecera de Tarjeta con Botones de Acción Compactos -->
                    <div class="grid-card-header">
                      <div class="grid-card-title-group">
                        <span class="grid-code-badge" [class.badge-market]="target.isMarket">
                          {{ getCountryCode(target.country) }}
                        </span>
                        <span class="grid-country-name">{{ target.country }}</span>
                        <span class="grid-universe">Univ: {{ formatNumber(target.universe ?? 0) }}</span>
                      </div>

                      <!-- Botones de Acción Individuales (Icon-only compactos con tooltip) -->
                      <div class="grid-card-actions">
                        <button
                          type="button"
                          class="btn-card-icon copy"
                          (click)="copySingleCardImage(target, cardTable)"
                          title="Copiar imagen de {{ target.country }}"
                          aria-label="Copiar imagen de {{ target.country }}"
                        >
                          <hugeicons-icon [icon]="Camera01Icon" [size]="14" [strokeWidth]="1.8"></hugeicons-icon>
                        </button>
                        <button
                          type="button"
                          class="btn-card-icon download"
                          (click)="downloadSingleCardPng(target, cardTable)"
                          title="Descargar PNG de {{ target.country }}"
                          aria-label="Descargar PNG de {{ target.country }}"
                        >
                          <hugeicons-icon [icon]="Download01Icon" [size]="14" [strokeWidth]="1.8"></hugeicons-icon>
                        </button>
                        <button
                          type="button"
                          class="btn-card-icon excel"
                          (click)="copySingleCardExcel(target)"
                          title="Copiar datos de {{ target.country }} para Excel"
                          aria-label="Copiar datos de {{ target.country }} para Excel"
                        >
                          <hugeicons-icon [icon]="Copy01Icon" [size]="14" [strokeWidth]="1.8"></hugeicons-icon>
                        </button>
                      </div>
                    </div>

                    <!-- Tabla de la Tarjeta -->
                    <div class="card-table-render-box" #cardTable>
                      <table class="executive-table">
                        <thead>
                          <tr>
                            <th class="th-medio">MEDIO</th>
                            <th class="th-reach">REACH</th>
                            <th class="th-pct">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of mediaRows; track row.name) {
                            <tr class="tr-data">
                              <td class="td-medio">{{ row.name }}</td>
                              <td class="td-reach tabular">{{ formatNumber(row.reach) }}</td>
                              <td class="td-pct tabular">{{ formatPercentage(row.percentage) }}</td>
                            </tr>
                          }

                          <!-- Fila TOTAL en Verde Salvia -->
                          <tr class="tr-total">
                            <td class="td-total-label">TOTAL</td>
                            <td class="td-total-reach tabular">{{ formatNumber(target.crossReach ?? 0) }}</td>
                            <td class="td-total-pct tabular">{{ formatTotalPercentage(target.crossReachPercentage ?? 0) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                }
              </div>
            }

          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <span class="footer-note">
            Tipografía Plus Jakarta Sans de alta fidelidad. Capturas retina 2.5x para máxima nitidez en presentaciones ejecutivas.
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
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 100%;
      max-width: 980px;
      height: 90vh;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.97) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Header */
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      gap: 12px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-icon {
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: #eff6ff;
      border-radius: 10px;
      border: 1px solid #dbeafe;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      line-height: 1.2;
    }

    .modal-subtitle {
      font-size: 11.5px;
      color: #64748b;
      margin: 2px 0 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* Selector de 3 Vistas */
    .view-mode-control {
      display: inline-flex;
      align-items: center;
      background: #e2e8f0;
      padding: 3px;
      border-radius: 8px;
      gap: 3px;
    }

    .view-btn {
      background: transparent;
      border: none;
      padding: 5px 10px;
      font-size: 11.5px;
      font-weight: 600;
      color: #475569;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: #0f1f3d;
        color: #ffffff;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      }
    }

    .format-controls-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .segmented-control {
      display: inline-flex;
      align-items: center;
      background: #e2e8f0;
      padding: 3px;
      border-radius: 6px;
      gap: 2px;
    }

    .control-label {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      padding: 0 3px;
      letter-spacing: 0.3px;
    }

    .seg-btn {
      background: transparent;
      border: none;
      padding: 4px 7px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      border-radius: 4px;
      cursor: pointer;

      &.active {
        background: #ffffff;
        color: #0f172a;
        font-weight: 700;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }
    }

    .btn-close {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #475569;
      font-size: 13px;
      font-weight: bold;
      transition: all 0.15s ease;

      &:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
    }

    /* Sub-bar: Selección de Columnas para Matriz */
    .column-selection-panel {
      padding: 8px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .selection-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      gap: 12px;
      flex-wrap: wrap;
    }

    .panel-header-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .selection-icon {
      font-size: 14px;
    }

    .selection-title {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }

    .selection-badge {
      font-size: 11px;
      font-weight: 600;
      color: #4338ca;
      background: #e0e7ff;
      padding: 2px 7px;
      border-radius: 9999px;
    }

    .quick-select-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-quick-select {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;

      &:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
    }

    .chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .country-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
      }

      &.selected {
        background: #eff6ff;
        border-color: #3b82f6;
        color: #1d4ed8;

        .chip-code {
          background: #3b82f6;
          color: #ffffff;
        }
      }

      &.is-market.selected {
        background: #fff7ed;
        border-color: #f97316;
        color: #c2410c;

        .chip-code {
          background: #f97316;
          color: #ffffff;
        }
      }
    }

    .chip-checkbox {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1.5px solid #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;

      &.checked {
        background: #3b82f6;
        border-color: #3b82f6;
      }

      &.market-check.checked {
        background: #f97316;
        border-color: #f97316;
      }
    }

    .chip-check-svg {
      width: 11px;
      height: 11px;
      color: #ffffff;
    }

    .chip-code {
      font-size: 10px;
      font-weight: 800;
      background: #e2e8f0;
      color: #475569;
      padding: 1px 4px;
      border-radius: 3px;
    }

    .chip-name {
      font-size: 11.5px;
    }

    .chip-market-badge {
      font-size: 8.5px;
      font-weight: 800;
      background: #ffedd5;
      color: #c2410c;
      padding: 1px 4px;
      border-radius: 3px;
    }

    /* Sub-bar: Selector de Iniciales para Ficha Individual */
    .initials-selector-bar {
      padding: 10px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 12px;
      overflow-x: auto;
      flex-shrink: 0;
    }

    .initials-hint-label {
      font-size: 11.5px;
      font-weight: 700;
      color: #475569;
      white-space: nowrap;
    }

    .initials-tabs-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .initial-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      white-space: nowrap;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
      }

      &.active {
        background: #0f1f3d;
        border-color: #0f1f3d;
        color: #ffffff;
        box-shadow: 0 2px 4px rgba(15, 31, 61, 0.2);

        .initial-code {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .initial-subname {
          color: rgba(255, 255, 255, 0.85);
        }
      }

      &.is-market {
        border-color: #fdba74;
      }
    }

    .initial-code {
      font-size: 11px;
      font-weight: 900;
      background: #e2e8f0;
      color: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    .initial-subname {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 500;
    }

    .grid-info-bar {
      padding: 8px 20px;
      background: #eff6ff;
      border-bottom: 1px solid #bfdbfe;
      font-size: 11.5px;
      color: #1e40af;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    /* Toolbar de Exportación General */
    .export-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      gap: 10px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .toolbar-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: #64748b;
    }

    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      font-size: 11.5px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-copy {
      background: #4f46e5;
      color: #ffffff;
      border-color: #4338ca;

      &:hover:not(:disabled) {
        background: #4338ca;
        box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
      }
    }

    .btn-download {
      background: #ffffff;
      color: #1e293b;
      border-color: #cbd5e1;

      &:hover:not(:disabled) {
        background: #f1f5f9;
        border-color: #94a3b8;
      }
    }

    .btn-excel {
      background: #ffffff;
      color: #059669;
      border-color: #a7f3d0;

      &:hover:not(:disabled) {
        background: #ecfdf5;
        border-color: #6ee7b7;
      }
    }

    .toast-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      background: #ecfdf5;
      border-bottom: 1px solid #a7f3d0;
      color: #065f46;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    /* ========================================================
       CONTENEDOR DE SCROLL: ALINEACIÓN SUPERIOR (FLEX-START)
       Previene el corte de la primera tabla
       ======================================================== */
    .table-preview-scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: auto;
      padding: 24px;
      background: #f1f5f9;
      display: flex;
      align-items: flex-start; /* CRÍTICO: align-items a flex-start evita el corte superior */
      justify-content: center;
      box-sizing: border-box;
      width: 100%;
    }

    .screenshot-canvas-wrapper {
      background: #ffffff;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }

    /* ========================================================
       TABLA MATRIZ MULTI-PAÍS (FORMATO ORIGINAL CONSOLIDADO)
       ======================================================== */
    .matrix-report-table {
      border-collapse: collapse;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      background: #ffffff;

      th, td {
        border: 1px solid #cbd5e1;
        padding: 8px 14px;
        text-align: center;
      }

      .corner-cell {
        background: #0f1f3d;
        color: #ffffff;
        font-weight: 800;
        font-size: 12.5px;
        letter-spacing: 0.5px;
        text-align: left;
        min-width: 110px;
      }

      .country-header-cell {
        background: #0f1f3d;
        color: #ffffff;
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 0.5px;
        min-width: 65px;

        &.header-market {
          background: #c2410c;
        }
      }

      .platform-row-header {
        font-weight: 700;
        text-align: left;
        color: #0f172a;
        background: #f8fafc;
      }

      .data-cell {
        font-weight: 500;
        color: #0f172a;
      }

      .summary-row-volume {
        background: #f8fafc;

        td {
          border-top: 2px solid #0f1f3d;
          font-weight: 700;
          color: #0f172a;
        }

        .summary-label {
          font-weight: 800;
          text-align: left;
        }
      }

      .summary-row-total {
        background: #c8dfc4;

        td {
          border-top: 1px solid #0f1f3d;
          border-bottom: 2px solid #0f1f3d;
          font-weight: 800;
          color: #000000;
        }

        .summary-label {
          font-weight: 900;
          text-align: left;
          letter-spacing: 0.5px;
        }
      }
    }

    /* ========================================================
       TABLA EJECUTIVA VERTICAL (FORMATO EXACTO DE LA REFERENCIA)
       ======================================================== */
    .single-card-render {
      display: flex;
      justify-content: center;
      width: 100%;
    }

    .executive-table {
      border-collapse: collapse;
      width: 100%;
      min-width: 270px;
      max-width: 360px;
      border: 2px solid #0f1f3d;
      background: #ffffff;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

      th, td {
        border: 1.5px solid #0f1f3d;
      }

      /* Cabecera Azul Marino (#0f1f3d) */
      thead th {
        background: #0f1f3d;
        color: #ffffff;
        font-weight: 800;
        font-size: 13.5px;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        padding: 8px 14px;
        text-align: center;
      }

      .th-medio {
        width: 38%;
      }

      .th-reach {
        width: 38%;
      }

      .th-pct {
        width: 24%;
      }

      /* Filas de datos */
      .tr-data td {
        background: #ffffff;
        padding: 7px 12px;
        font-size: 13.5px;
        color: #000000;
      }

      .td-medio {
        font-weight: 800;
        text-align: center;
        color: #000000;
      }

      .td-reach {
        font-weight: 500;
        text-align: center;
        color: #000000;
      }

      .td-pct {
        font-weight: 500;
        text-align: center;
        color: #000000;
      }

      /* Fila de TOTAL en Verde Salvia (#c8dfc4) */
      .tr-total td {
        background: #c8dfc4;
        padding: 8px 12px;
        font-size: 14.5px;
        color: #000000;
      }

      .td-total-label {
        font-weight: 900;
        text-align: center;
        letter-spacing: 0.6px;
      }

      .td-total-reach {
        font-weight: 800;
        text-align: center;
      }

      .td-total-pct {
        font-weight: 800;
        text-align: center;
      }
    }

    /* ========================================================
       CUADRÍCULA 'VER TODAS' CON BOTONES INDIVIDUALES
       ======================================================== */
    .all-grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 28px;
      align-items: start;
      width: 100%;
      box-sizing: border-box;
    }

    .grid-card-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #ffffff;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
      }
    }

    .grid-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px 6px 4px;
      border-bottom: 1px dashed #e2e8f0;
      gap: 8px;
    }

    .grid-card-title-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .grid-code-badge {
      font-size: 11px;
      font-weight: 900;
      background: #0f1f3d;
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;

      &.badge-market {
        background: #ea580c;
      }
    }

    .grid-country-name {
      font-size: 12.5px;
      font-weight: 800;
      color: #0f172a;
    }

    .grid-universe {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }

    /* Micro-botones individuales por tarjeta (26x26px con tooltip) */
    .grid-card-actions {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn-card-icon {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;

      &.copy {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;

        &:hover {
          background: #dbeafe;
          border-color: #93c5fd;
          transform: translateY(-1px);
        }
      }

      &.download {
        background: #f1f5f9;
        border-color: #cbd5e1;
        color: #334155;

        &:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
          transform: translateY(-1px);
        }
      }

      &.excel {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #047857;

        &:hover {
          background: #d1fae5;
          border-color: #6ee7b7;
          transform: translateY(-1px);
        }
      }
    }

    .card-table-render-box {
      display: flex;
      justify-content: center;
      background: #ffffff;
      padding: 4px;
      border-radius: 6px;
    }

    .empty-state-notice {
      text-align: center;
      padding: 30px;
      color: #64748b;
    }

    .empty-icon {
      font-size: 28px;
    }

    .empty-text {
      font-size: 13px;
      margin-top: 6px;
    }

    /* Footer */
    .modal-footer {
      padding: 10px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .footer-note {
      font-size: 11px;
      color: #64748b;
    }

    .btn-done {
      padding: 6px 18px;
      background: #0f172a;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;

      &:hover {
        background: #1e293b;
      }
    }

    .tabular {
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class ReportTableModalComponent {
  private _rows = signal<CountryRow[]>([]);

  @Input() set rows(val: CountryRow[]) {
    const list = val || [];
    this._rows.set(list);

    // Inicializar columnas activas para la matriz multi-país
    if (!this.initializedSelection && list.length > 0) {
      const allKeys = new Set(list.map(r => this.getColumnKey(r)));
      this.selectedColumnKeys.set(allKeys);
      this.initializedSelection = true;
    }

    // Inicializar objetivo seleccionado para la ficha individual
    if (list.length > 0 && !this.selectedTargetKey()) {
      this.selectedTargetKey.set(this.getTargetKey(list[0]));
    }
  }
  get rows(): CountryRow[] {
    return this._rows();
  }

  @Output() close = new EventEmitter<void>();

  @ViewChild('tableCanvasContainer') tableContainer!: ElementRef<HTMLDivElement>;

  // Iconos de Hugeicons
  readonly Camera01Icon = Camera01Icon;
  readonly Download01Icon = Download01Icon;
  readonly Copy01Icon = Copy01Icon;

  // Tres Vistas Principales: 'multi_matrix' | 'single_card' | 'all_grid'
  viewMode = signal<'multi_matrix' | 'single_card' | 'all_grid'>('multi_matrix');

  // Opciones de formato
  thousandsSeparator = signal<'comma' | 'dot'>('comma');
  percentDecimals = signal<0 | 2>(0); // 0 = enteros (37%), 2 = dos decimales (37.20%)

  // Estado para la Matriz Multi-País
  private initializedSelection = false;
  selectedColumnKeys = signal<Set<string>>(new Set());

  // Estado para la Ficha Individual
  selectedTargetKey = signal<string>('');

  isExporting = signal<boolean>(false);
  copyStatus = signal<string>('📷 Copiar Imagen');
  toastMessage = signal<string | null>(null);

  // Mapeo oficial de códigos de 3 letras / iniciales amigables solicitadas (COL, CHL, PER, CRI, MX)
  private readonly countryCodeMap: { [key: string]: string } = {
    'colombia': 'COL',
    'chile': 'CHL',
    'peru': 'PER',
    'perú': 'PER',
    'costa rica': 'CRI',
    'mexico': 'MX',
    'méxico': 'MX',
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

  // Orden canónico de medios
  private readonly canonicalPlatformsOrder = [
    'Meta',
    'YouTube',
    'TikTok',
    'Netflix',
    'Disney',
    'Display',
    'OOH',
    'DOOH'
  ];

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
        if ((p.reach ?? 0) > 0) set.add(p.platformName);
      });
    });

    const sorted: string[] = [];
    this.canonicalPlatformsOrder.forEach(name => {
      const match = Array.from(set).find(s => s.toLowerCase() === name.toLowerCase());
      if (match && !sorted.includes(match)) {
        sorted.push(match);
        set.delete(match);
      }
    });

    Array.from(set).forEach(p => sorted.push(p));
    return sorted;
  });

  availableTargets = computed(() => {
    return this._rows();
  });

  selectedTarget = computed<CountryRow | null>(() => {
    const key = this.selectedTargetKey();
    if (!key) return this._rows()[0] || null;
    return this._rows().find(r => this.getTargetKey(r) === key) || this._rows()[0] || null;
  });

  getColumnKey(col: CountryRow): string {
    return col.id || col.country.trim().toLowerCase();
  }

  getTargetKey(target: CountryRow): string {
    return target.id || target.country.trim().toLowerCase();
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

  selectTarget(key: string): void {
    this.selectedTargetKey.set(key);
  }

  getCountryCode(country: string): string {
    const norm = (country || '').trim().toLowerCase();
    if (this.countryCodeMap[norm]) {
      return this.countryCodeMap[norm];
    }
    return country.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  }

  getPlatformReachPercent(row: CountryRow, platformName: string): number {
    const p = row.platforms.find(
      item => item.platformName.toLowerCase() === platformName.toLowerCase()
    );
    if (!p || !row.universe || row.universe === 0 || !p.reach) return 0;
    return (p.reach / row.universe) * 100;
  }

  /**
   * Obtiene ÚNICAMENTE los medios que tuvieron inversión activa (> 0) en este país o mercado
   * Ejemplo: Si en Costa Rica no hubo Disney o Display, no los incluye en la tabla.
   */
  getActiveMediaRowsForTarget(target: CountryRow): MediaRowReport[] {
    const universe = target.universe || 0;
    const mediaRows: MediaRowReport[] = [];

    // Filtrar plataformas con alcance estrictamente mayor a 0
    const activePlatforms = target.platforms.filter(p => (p.reach ?? 0) > 0);

    // Ordenar según el orden canónico
    this.canonicalPlatformsOrder.forEach(canonicalName => {
      const match = activePlatforms.find(
        p => p.platformName.toLowerCase().trim() === canonicalName.toLowerCase().trim()
      );
      if (match && match.reach) {
        const pct = universe > 0 ? (match.reach / universe) * 100 : 0;
        mediaRows.push({
          name: canonicalName,
          reach: match.reach,
          percentage: parseFloat(pct.toFixed(2))
        });
      }
    });

    // Agregar cualquier otra plataforma no canónica que esté activa
    activePlatforms.forEach(p => {
      const isAlreadyAdded = mediaRows.some(
        m => m.name.toLowerCase() === p.platformName.toLowerCase()
      );
      if (!isAlreadyAdded && p.reach) {
        const pct = universe > 0 ? (p.reach / universe) * 100 : 0;
        mediaRows.push({
          name: p.platformName,
          reach: p.reach,
          percentage: parseFloat(pct.toFixed(2))
        });
      }
    });

    return mediaRows;
  }

  formatNumber(val: number | null | undefined): string {
    if (val === null || val === undefined || val === 0) return '0';
    const rounded = Math.round(val);
    const sep = this.thousandsSeparator();
    if (sep === 'comma') {
      return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } else {
      return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
  }

  /**
   * Formatea el porcentaje aplicando la preferencia global de decimales (0 o 2)
   */
  formatPercentage(val: number | null | undefined): string {
    if (val === null || val === undefined) return '0%';
    const dec = this.percentDecimals();
    if (dec === 0) {
      return `${Math.round(val)}%`;
    }
    return `${val.toFixed(2)}%`;
  }

  formatMatrixPercentage(val: number | null | undefined): string {
    if (!val || val === 0) return '-';
    const dec = this.percentDecimals();
    if (dec === 0) {
      return `${Math.round(val)}%`;
    }
    return `${val.toFixed(2)}%`;
  }

  formatTotalPercentage(val: number | null | undefined): string {
    if (val === null || val === undefined) return '0%';
    const dec = this.percentDecimals();
    if (dec === 0) {
      return `${Math.round(val)}%`;
    }
    return `${val.toFixed(2)}%`;
  }

  /* ========================================================
     EXPORTADORES GENERALES (MATRIZ O FICHA INDIVIDUAL)
     ======================================================== */
  async copyImageToClipboard(): Promise<void> {
    if (!this.tableContainer?.nativeElement) return;
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
    if (!this.tableContainer?.nativeElement) return;
    this.isExporting.set(true);

    try {
      const node = this.tableContainer.nativeElement;
      const dataUrl = await toPng(node, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff'
      });

      const mode = this.viewMode();
      let filename = `reporte_alcance_${mode}_${new Date().toISOString().split('T')[0]}.png`;
      if (mode === 'single_card') {
        const target = this.selectedTarget();
        const code = target ? this.getCountryCode(target.country) : 'ficha';
        filename = `reporte_alcance_${code}_${new Date().toISOString().split('T')[0]}.png`;
      }

      const link = document.createElement('a');
      link.download = filename;
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
    const mode = this.viewMode();
    let tsvContent = '';

    if (mode === 'multi_matrix') {
      const cols = this.activeColumns();
      if (cols.length === 0) return;
      const platforms = this.activePlatforms();

      const header = ['MEDIO\t' + cols.map(c => this.getCountryCode(c.country)).join('\t')];
      const body = platforms.map(p => {
        const vals = cols.map(c => this.formatMatrixPercentage(this.getPlatformReachPercent(c, p)));
        return [p, ...vals].join('\t');
      });
      const volumeRow = [
        'Volumen total',
        ...cols.map(c => this.formatNumber(c.crossReach ?? 0))
      ].join('\t');
      const totalPercentRow = [
        'Total %',
        ...cols.map(c => this.formatTotalPercentage(c.crossReachPercentage ?? 0))
      ].join('\t');

      tsvContent = [...header, ...body, volumeRow, totalPercentRow].join('\n');

    } else if (mode === 'single_card') {
      const target = this.selectedTarget();
      if (!target) return;
      const rows = this.getActiveMediaRowsForTarget(target);
      const lines: string[] = ['MEDIO\tREACH\t%'];
      rows.forEach(r => {
        lines.push(`${r.name}\t${this.formatNumber(r.reach)}\t${this.formatPercentage(r.percentage)}`);
      });
      lines.push(`TOTAL\t${this.formatNumber(target.crossReach ?? 0)}\t${this.formatTotalPercentage(target.crossReachPercentage ?? 0)}`);
      tsvContent = lines.join('\n');

    } else {
      // all_grid
      const targets = this.availableTargets();
      const blocks: string[] = [];
      targets.forEach(t => {
        const rows = this.getActiveMediaRowsForTarget(t);
        const lines: string[] = [`=== ${t.country} (${this.getCountryCode(t.country)}) ===`, 'MEDIO\tREACH\t%'];
        rows.forEach(r => {
          lines.push(`${r.name}\t${this.formatNumber(r.reach)}\t${this.formatPercentage(r.percentage)}`);
        });
        lines.push(`TOTAL\t${this.formatNumber(t.crossReach ?? 0)}\t${this.formatTotalPercentage(t.crossReachPercentage ?? 0)}`);
        blocks.push(lines.join('\n'));
      });
      tsvContent = blocks.join('\n\n');
    }

    navigator.clipboard.writeText(tsvContent).then(() => {
      this.showToast('¡Datos copiados! Pégalos directamente en Excel o Google Sheets.');
    }).catch(err => {
      console.error('Error al copiar TSV:', err);
      this.showToast('Error al copiar datos en formato Excel.');
    });
  }

  /* ========================================================
     ACCIONES INDIVIDUALES POR TARJETA (EN 'VER TODAS')
     ======================================================== */
  async copySingleCardImage(target: CountryRow, element: HTMLElement): Promise<void> {
    try {
      this.showToast(`Generando imagen de ${target.country}...`);
      const blob = await toBlob(element, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff'
      });
      if (!blob) throw new Error('Blob nulo');

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      this.showToast(`¡Ficha de ${target.country} copiada al portapapeles!`);
    } catch (err) {
      console.error('Error al copiar tarjeta individual:', err);
      this.showToast(`No se pudo copiar automáticamente. Usa descargar.`);
    }
  }

  async downloadSingleCardPng(target: CountryRow, element: HTMLElement): Promise<void> {
    try {
      this.showToast(`Descargando PNG de ${target.country}...`);
      const dataUrl = await toPng(element, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff'
      });
      const code = this.getCountryCode(target.country);
      const link = document.createElement('a');
      link.download = `reporte_${code}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast(`¡Imagen de ${target.country} descargada!`);
    } catch (err) {
      console.error('Error al descargar tarjeta individual:', err);
      this.showToast(`Error al descargar la imagen.`);
    }
  }

  copySingleCardExcel(target: CountryRow): void {
    const rows = this.getActiveMediaRowsForTarget(target);
    const lines: string[] = ['MEDIO\tREACH\t%'];
    rows.forEach(r => {
      lines.push(`${r.name}\t${this.formatNumber(r.reach)}\t${this.formatPercentage(r.percentage)}`);
    });
    lines.push(`TOTAL\t${this.formatNumber(target.crossReach ?? 0)}\t${this.formatTotalPercentage(target.crossReachPercentage ?? 0)}`);
    const tsvContent = lines.join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
      this.showToast(`¡Datos de ${target.country} copiados para Excel!`);
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

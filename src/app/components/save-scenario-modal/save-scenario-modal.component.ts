import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountryRow } from '../../models/platform.models';
import { ScenarioService } from '../../services/scenario.service';
import { SavedScenario } from '../../models/scenario.models';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { FloppyDiskIcon, Cancel01Icon } from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-save-scenario-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, HugeiconsIconComponent],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <div class="header-icon">
              <hugeicons-icon [icon]="FloppyDiskIcon" [size]="20" [strokeWidth]="2" color="#4f46e5"></hugeicons-icon>
            </div>
            <div>
              <h2 class="modal-title">Guardar Escenario</h2>
              <p class="modal-subtitle">Almacena esta matriz de alcance en la nube</p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close.emit()" aria-label="Cerrar">
            <hugeicons-icon [icon]="Cancel01Icon" [size]="16" [strokeWidth]="2"></hugeicons-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Resumen del contenido del escenario -->
          <div class="scenario-preview-card">
            <div class="preview-header">
              <span class="preview-tag">Contenido a Guardar</span>
              <span class="preview-countries-count">{{ validCountries.length }} países</span>
            </div>

            <div class="country-chips-list">
              @for (c of validCountries; track c.id) {
                <span class="country-pill">
                  <span class="pill-dot"></span>
                  <span class="pill-name">{{ c.country }}</span>
                </span>
              }
            </div>

            <div class="preview-metrics-grid">
              <div class="metric-item">
                <span class="metric-label">Alcance Deduplicado Total</span>
                <span class="metric-value text-indigo">{{ formatNumber(totalCrossReach) }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Universo Acumulado</span>
                <span class="metric-value">{{ formatNumber(totalUniverse) }}</span>
              </div>
            </div>
          </div>

          <!-- Input Nombre del Escenario -->
          <div class="form-group">
            <label for="scenarioName" class="form-label">
              Nombre descriptivo del escenario <span class="required">*</span>
            </label>
            <div class="input-wrap">
              <input
                id="scenarioName"
                type="text"
                class="name-input"
                [ngModel]="scenarioName()"
                (ngModelChange)="scenarioName.set($event)"
                placeholder="Ej. Escenario LATAM Q4, Campaña Buen Fin..."
                (keydown.enter)="handleSave()"
                autofocus
              />
            </div>
            <p class="field-hint">
              Asigna un nombre reconocible para identificarlo rápidamente en el panel de escenarios guardados.
            </p>
          </div>

          @if (errorMessage()) {
            <div class="error-banner">
              <span>⚠️</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button type="button" class="btn-cancel" (click)="close.emit()">
            Cancelar
          </button>

          <button
            type="button"
            class="btn-save-confirm"
            (click)="handleSave()"
            [disabled]="scenarioService.isSaving() || !scenarioName().trim()"
          >
            @if (scenarioService.isSaving()) {
              <span class="spinner"></span>
              <span>Guardando en la nube...</span>
            } @else {
              <hugeicons-icon [icon]="FloppyDiskIcon" [size]="16" [strokeWidth]="2"></hugeicons-icon>
              <span>Guardar Escenario</span>
            }
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
      max-width: 520px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.97) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      background: #e0e7ff;
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

    .modal-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .scenario-preview-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .preview-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }

    .preview-countries-count {
      font-size: 12px;
      font-weight: 600;
      color: #4f46e5;
      background: #eef2ff;
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .country-chips-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .country-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }

    .pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4f46e5;
    }

    .preview-metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .metric-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .metric-value {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;

      &.text-indigo {
        color: #4f46e5;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }

    .required {
      color: #ef4444;
    }

    .name-input {
      width: 100%;
      padding: 10px 14px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      color: #0f172a;
      outline: none;
      transition: all 0.15s ease;
      font-family: inherit;

      &:focus {
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
      }
    }

    .field-hint {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }

    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .btn-cancel {
      background: transparent;
      border: 1px solid #cbd5e1;
      color: #475569;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
    }

    .btn-save-confirm {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: #4338ca;
        box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class SaveScenarioModalComponent {
  @Input() rows: CountryRow[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<SavedScenario>();

  scenarioService = inject(ScenarioService);

  readonly FloppyDiskIcon = FloppyDiskIcon;
  readonly Cancel01Icon = Cancel01Icon;

  scenarioName = signal<string>('');
  errorMessage = signal<string | null>(null);

  get validCountries(): CountryRow[] {
    return (this.rows || []).filter(r => !r.isMarket);
  }

  get totalUniverse(): number {
    return this.validCountries.reduce((sum, r) => sum + (r.universe || 0), 0);
  }

  get totalCrossReach(): number {
    return this.validCountries.reduce((sum, r) => sum + (r.crossReach || 0), 0);
  }

  constructor() {
    // Sugerencia inicial de nombre
    const today = new Date();
    const dateFormatted = today.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    this.scenarioName.set(`Escenario Multipaís - ${dateFormatted}`);
  }

  formatNumber(val: number): string {
    if (!val) return '0';
    return Math.round(val).toLocaleString('es-ES');
  }

  async handleSave(): Promise<void> {
    const name = this.scenarioName().trim();
    if (!name) {
      this.errorMessage.set('Por favor ingresa un nombre para el escenario.');
      return;
    }

    if (this.validCountries.length === 0) {
      this.errorMessage.set('No hay países en la tabla para guardar.');
      return;
    }

    this.errorMessage.set(null);

    try {
      const result = await this.scenarioService.saveScenario(name, this.validCountries);
      this.saved.emit(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al guardar';
      this.errorMessage.set(msg);
    }
  }
}

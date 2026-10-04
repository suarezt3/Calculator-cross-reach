import { Component, Input, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScenarioService } from '../../services/scenario.service';
import { SavedScenario } from '../../models/scenario.models';
import { CountryRow } from '../../models/platform.models';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Folder01Icon,
  RefreshIcon,
  Search01Icon,
  Cancel01Icon,
  PlayIcon,
  Delete02Icon,
  FloppyDiskIcon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-scenario-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, HugeiconsIconComponent],
  template: `
    <div class="drawer-backdrop" (click)="close.emit()">
      <div class="drawer-panel" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="drawer-header">
          <div class="header-main">
            <div class="header-icon-wrap">
              <hugeicons-icon [icon]="Folder01Icon" [size]="20" [strokeWidth]="2" color="#4f46e5"></hugeicons-icon>
            </div>
            <div>
              <div class="title-with-badge">
                <h2 class="drawer-title">Escenarios Guardados</h2>
                <span class="count-badge">{{ scenarioService.scenariosCount() }}</span>
              </div>
              <p class="drawer-subtitle">Historial de matrices guardadas en la nube</p>
            </div>
          </div>

          <div class="header-actions">
            <button
              type="button"
              class="btn-icon"
              (click)="refreshScenarios()"
              title="Recargar desde la nube"
              [disabled]="scenarioService.isLoading()"
            >
              <hugeicons-icon [icon]="RefreshIcon" [size]="16" [strokeWidth]="1.8" [class.rotating]="scenarioService.isLoading()"></hugeicons-icon>
            </button>
            <button
              type="button"
              class="btn-icon"
              (click)="close.emit()"
              title="Cerrar panel"
            >
              <hugeicons-icon [icon]="Cancel01Icon" [size]="16" [strokeWidth]="2"></hugeicons-icon>
            </button>
          </div>
        </div>

        <!-- Buscador -->
        <div class="drawer-search">
          <div class="search-box">
            <hugeicons-icon [icon]="Search01Icon" [size]="15" [strokeWidth]="1.8" color="#94a3b8"></hugeicons-icon>
            <input
              type="text"
              class="search-input"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              placeholder="Buscar escenario por nombre o país..."
            />
            @if (searchTerm()) {
              <button type="button" class="btn-clear-search" (click)="searchTerm.set('')" aria-label="Limpiar búsqueda">
                <hugeicons-icon [icon]="Cancel01Icon" [size]="12" [strokeWidth]="2"></hugeicons-icon>
              </button>
            }
          </div>
        </div>

        <!-- Lista de Escenarios -->
        <div class="drawer-body">
          @if (scenarioService.isLoading()) {
            <div class="loading-state">
              <span class="spinner-large"></span>
              <p class="loading-text">Consultando escenarios en la nube...</p>
            </div>
          } @else if (filteredScenarios().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">🗂️</span>
              <h3 class="empty-title">
                {{ searchTerm() ? 'No hay coincidencias' : 'No hay escenarios guardados todavía' }}
              </h3>
              <p class="empty-desc">
                {{ searchTerm() 
                  ? 'Prueba con otro término de búsqueda.'
                  : 'Calcula tu matriz de alcance y haz clic en "Guardar Escenario" para almacenarla en la nube.'
                }}
              </p>

              @if (!searchTerm() && currentRows.length > 0) {
                <button
                  type="button"
                  class="btn-save-current"
                  (click)="requestSaveCurrent.emit()"
                >
                  <hugeicons-icon [icon]="FloppyDiskIcon" [size]="15" [strokeWidth]="2"></hugeicons-icon>
                  <span>Guardar escenario actual</span>
                </button>
              }
            </div>
          } @else {
            <div class="scenarios-list">
              @for (item of filteredScenarios(); track item.id) {
                <div class="scenario-card">
                  <!-- Cabecera de la tarjeta -->
                  <div class="card-top">
                    <div>
                      <h4 class="card-name">{{ item.name }}</h4>
                      <span class="card-date">{{ formatDate(item.createdAt) }}</span>
                    </div>

                    <span class="source-tag" [class.supabase-tag]="item.source === 'cloud' || item.source === 'supabase' || item.source === 'synced'">
                      {{ (item.source === 'cloud' || item.source === 'supabase' || item.source === 'synced') ? '☁️ En la nube' : '💾 Guardado' }}
                    </span>
                  </div>

                  <!-- Chips de países -->
                  <div class="card-countries">
                    @for (country of item.countriesList; track country) {
                      <span class="country-chip">
                        {{ getCountryCode(country) }}
                      </span>
                    }
                  </div>

                  <!-- Métricas clave -->
                  <div class="card-stats">
                    <div class="stat-col">
                      <span class="stat-label">Alcance Total</span>
                      <span class="stat-value text-indigo">{{ formatNumber(item.totalCrossReach) }}</span>
                    </div>
                    <div class="stat-col">
                      <span class="stat-label">Universo</span>
                      <span class="stat-value">{{ formatNumber(item.totalUniverse) }}</span>
                    </div>
                    <div class="stat-col">
                      <span class="stat-label">Eficiencia %</span>
                      <span class="stat-value">{{ item.totalEfficiency }}%</span>
                    </div>
                  </div>

                  <!-- Acciones de la tarjeta -->
                  <div class="card-actions">
                    <button
                      type="button"
                      class="btn-load-scenario"
                      (click)="loadScenario(item)"
                      title="Cargar esta matriz de alcance en la tabla activa"
                    >
                      <hugeicons-icon [icon]="PlayIcon" [size]="15" [strokeWidth]="2"></hugeicons-icon>
                      <span>Cargar Escenario</span>
                    </button>

                    @if (confirmDeleteId() === item.id) {
                      <div class="delete-confirm-box">
                        <span class="delete-warn">¿Borrar?</span>
                        <button
                          type="button"
                          class="btn-confirm-delete"
                          (click)="confirmDelete(item)"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          class="btn-cancel-delete"
                          (click)="confirmDeleteId.set(null)"
                        >
                          No
                        </button>
                      </div>
                    } @else {
                      <button
                        type="button"
                        class="btn-delete"
                        (click)="confirmDeleteId.set(item.id)"
                        title="Eliminar este escenario"
                      >
                        <hugeicons-icon [icon]="Delete02Icon" [size]="15" [strokeWidth]="1.8"></hugeicons-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="drawer-footer">
          <div class="sync-status">
            <span class="status-dot"></span>
            <span class="status-note">Sincronización activa en la nube</span>
          </div>

          <button type="button" class="btn-close-drawer" (click)="close.emit()">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(4px);
      z-index: 9998;
      display: flex;
      justify-content: flex-end;
      animation: backdropIn 0.2s ease-out;
    }

    @keyframes backdropIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .drawer-panel {
      background: #ffffff;
      width: 100%;
      max-width: 460px;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-shadow: -8px 0 24px -4px rgba(0, 0, 0, 0.2);
      animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .header-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-wrap {
      width: 42px;
      height: 42px;
      background: #e0e7ff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }

    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .drawer-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .count-badge {
      background: #4f46e5;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 9999px;
    }

    .drawer-subtitle {
      font-size: 12px;
      color: #64748b;
      margin: 2px 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-icon {
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

      &:hover:not(:disabled) {
        background: #f1f5f9;
        color: #0f172a;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .rotating {
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .drawer-search {
      padding: 14px 24px;
      border-bottom: 1px solid #f1f5f9;
      background: #ffffff;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      gap: 8px;
      transition: all 0.15s ease;

      &:focus-within {
        border-color: #4f46e5;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }
    }

    .search-icon {
      font-size: 14px;
      color: #94a3b8;
    }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      color: #0f172a;
      width: 100%;
      font-family: inherit;
    }

    .btn-clear-search {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 4px;

      &:hover {
        color: #0f172a;
      }
    }

    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      background: #f8fafc;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 16px;
    }

    .spinner-large {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loading-text {
      font-size: 13px;
      color: #64748b;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: #ffffff;
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
    }

    .empty-icon {
      font-size: 40px;
      display: block;
      margin-bottom: 12px;
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

    .btn-save-current {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover {
        background: #4338ca;
      }
    }

    .scenarios-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .scenario-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

      &:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.08);
      }
    }

    .card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }

    .card-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 2px;
    }

    .card-date {
      font-size: 11px;
      color: #64748b;
    }

    .source-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      letter-spacing: 0.03em;
      white-space: nowrap;

      &.supabase-tag {
        background: #eef2ff;
        color: #4338ca;
      }
    }

    .card-countries {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 12px;
    }

    .country-chip {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }

    .card-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 10px 0;
      border-top: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 12px;
    }

    .stat-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-label {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;

      &.text-indigo {
        color: #4f46e5;
      }
    }

    .card-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .btn-load-scenario {
      flex: 1;
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s ease;

      &:hover {
        background: #4338ca;
        box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);
      }
    }

    .btn-delete {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #94a3b8;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;

      &:hover {
        background: #fef2f2;
        border-color: #fca5a5;
        color: #dc2626;
      }
    }

    .delete-confirm-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 2px 6px;
      border-radius: 6px;
    }

    .delete-warn {
      font-size: 11px;
      font-weight: 600;
      color: #991b1b;
    }

    .btn-confirm-delete {
      background: #dc2626;
      color: #ffffff;
      border: none;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;

      &:hover {
        background: #b91c1c;
      }
    }

    .btn-cancel-delete {
      background: transparent;
      border: 1px solid #cbd5e1;
      color: #475569;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
    }

    .drawer-footer {
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .sync-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
    }

    .status-note {
      font-size: 11px;
      color: #64748b;

      code {
        background: #e2e8f0;
        padding: 1px 4px;
        border-radius: 4px;
        font-size: 10px;
      }
    }

    .btn-close-drawer {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: #1e293b;
      }
    }
  `]
})
export class ScenarioDrawerComponent {
  @Input() currentRows: CountryRow[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() load = new EventEmitter<SavedScenario>();
  @Output() requestSaveCurrent = new EventEmitter<void>();

  scenarioService = inject(ScenarioService);

  readonly Folder01Icon = Folder01Icon;
  readonly RefreshIcon = RefreshIcon;
  readonly Search01Icon = Search01Icon;
  readonly Cancel01Icon = Cancel01Icon;
  readonly PlayIcon = PlayIcon;
  readonly Delete02Icon = Delete02Icon;
  readonly FloppyDiskIcon = FloppyDiskIcon;

  searchTerm = signal<string>('');
  confirmDeleteId = signal<string | null>(null);

  filteredScenarios = computed(() => {
    const list = this.scenarioService.scenarios();
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;

    return list.filter(item => {
      const matchName = item.name.toLowerCase().includes(term);
      const matchCountry = item.countriesList.some(c => c.toLowerCase().includes(term));
      return matchName || matchCountry;
    });
  });

  refreshScenarios(): void {
    this.scenarioService.loadScenarios();
  }

  loadScenario(scenario: SavedScenario): void {
    this.load.emit(scenario);
  }

  async confirmDelete(scenario: SavedScenario): Promise<void> {
    await this.scenarioService.deleteScenario(scenario.id, scenario.name);
    this.confirmDeleteId.set(null);
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  formatNumber(val: number): string {
    if (!val) return '0';
    return Math.round(val).toLocaleString('es-ES');
  }

  getCountryCode(name: string): string {
    const map: Record<string, string> = {
      'colombia': 'COL',
      'chile': 'CHL',
      'peru': 'PER',
      'perú': 'PER',
      'costa rica': 'CRI',
      'mexico': 'MEX',
      'méxico': 'MEX',
      'argentina': 'ARG',
      'brasil': 'BRA',
      'ecuador': 'ECU',
      'panama': 'PAN',
      'panamá': 'PAN'
    };
    const norm = (name || '').trim().toLowerCase();
    return map[norm] || name.substring(0, 3).toUpperCase();
  }
}

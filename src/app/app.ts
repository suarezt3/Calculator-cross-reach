import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformFormComponent } from './components/platform-form/platform-form.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { KpiSummaryComponent } from './components/kpi-summary/kpi-summary.component';
import { CrossReachService } from './services/cross-reach.service';
import { CountryRow, PlatformReach, KpiSummary } from './models/platform.models';

import { DocumentationModalComponent } from './components/documentation-modal/documentation-modal.component';
import { ReportTableModalComponent } from './components/report-table-modal/report-table-modal.component';
import { SaveScenarioModalComponent } from './components/save-scenario-modal/save-scenario-modal.component';
import { ScenarioDrawerComponent } from './components/scenario-drawer/scenario-drawer.component';
import { ScenarioService } from './services/scenario.service';
import { SavedScenario } from './models/scenario.models';

import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  FloppyDiskIcon,
  Folder01Icon,
  RefreshIcon,
  Delete02Icon,
  BookOpen01Icon,
  Tick02Icon,
  Cancel01Icon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    PlatformFormComponent,
    ResultsTableComponent,
    KpiSummaryComponent,
    DocumentationModalComponent,
    ReportTableModalComponent,
    SaveScenarioModalComponent,
    ScenarioDrawerComponent,
    HugeiconsIconComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  title = 'Cross Reach Enterprise Studio';
  subtitle = 'Multi-Platform Audience Deduplication & Media Planning Matrix';

  // Iconos de Hugeicons
  readonly FloppyDiskIcon = FloppyDiskIcon;
  readonly Folder01Icon = Folder01Icon;
  readonly RefreshIcon = RefreshIcon;
  readonly Delete02Icon = Delete02Icon;
  readonly BookOpen01Icon = BookOpen01Icon;
  readonly Tick02Icon = Tick02Icon;
  readonly Cancel01Icon = Cancel01Icon;

  // Inicia limpio para pruebas directas del usuario
  tableData = signal<CountryRow[]>([]);

  // Estados de modales y paneles
  showDocModal = signal<boolean>(false);
  showReportModal = signal<boolean>(false);
  showSaveModal = signal<boolean>(false);
  showDrawer = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  constructor(
    public crossReachService: CrossReachService,
    public scenarioService: ScenarioService
  ) {
    // Inicialización limpia
  }

  usedCountries = computed(() => {
    return this.tableData()
      .filter(row => !row.isMarket)
      .map(row => row.country);
  });

  displayData = computed(() => {
    return this.crossReachService.getAllRowsWithMarkets(this.tableData());
  });

  kpiSummary = computed<KpiSummary>(() => {
    return this.crossReachService.calculateKpiSummary(this.tableData());
  });

  /**
   * Carga dataset demo de prueba con Meta, YouTube, TikTok y Display
   */
  loadInitialDemoData(): void {
    const demoCountries: { country: string; universe: number; platforms: PlatformReach[] }[] = [
      {
        country: 'Mexico',
        universe: 53000000,
        platforms: [
          { platformName: 'Meta', reach: 19716710 },
          { platformName: 'YouTube', reach: 15800616 },
          { platformName: 'TikTok', reach: 9308655 },
          { platformName: 'Netflix', reach: 1420927 },
          { platformName: 'Disney', reach: null },
          { platformName: 'Display', reach: 1229150 },
          { platformName: 'OOH', reach: null },
          { platformName: 'DOOH', reach: null }
        ]
      },
      {
        country: 'Colombia',
        universe: 27000000,
        platforms: [
          { platformName: 'Meta', reach: 18500000 },
          { platformName: 'YouTube', reach: 14200000 },
          { platformName: 'TikTok', reach: 8900000 },
          { platformName: 'Netflix', reach: 1850000 },
          { platformName: 'Disney', reach: 1100000 },
          { platformName: 'Display', reach: 2400000 },
          { platformName: 'OOH', reach: 950000 },
          { platformName: 'DOOH', reach: 550000 }
        ]
      },
      {
        country: 'Peru',
        universe: 18500000,
        platforms: [
          { platformName: 'Meta', reach: 15200000 },
          { platformName: 'YouTube', reach: 12800000 },
          { platformName: 'TikTok', reach: 8800000 },
          { platformName: 'Netflix', reach: 1200000 },
          { platformName: 'Display', reach: 1500000 }
        ]
      },
      {
        country: 'Chile',
        universe: 9500000,
        platforms: [
          { platformName: 'Meta', reach: 7800000 },
          { platformName: 'YouTube', reach: 7200000 },
          { platformName: 'TikTok', reach: 4900000 },
          { platformName: 'Netflix', reach: 850000 },
          { platformName: 'Disney', reach: 620000 }
        ]
      },
      {
        country: 'Costa Rica',
        universe: 3500000,
        platforms: [
          { platformName: 'Meta', reach: 2800000 },
          { platformName: 'YouTube', reach: 2400000 },
          { platformName: 'TikTok', reach: 1650000 }
        ]
      }
    ];

    let currentTable: CountryRow[] = [];
    demoCountries.forEach(data => {
      const row: CountryRow = {
        id: crypto.randomUUID(),
        country: data.country,
        universe: data.universe,
        platforms: data.platforms
      };
      currentTable = this.crossReachService.addRowToTable(currentTable, row);
    });

    this.tableData.set(currentTable);
  }

  handleAddToTable(data: {
    country: string;
    universe: number;
    platforms: PlatformReach[];
  }): void {
    const newRow: CountryRow = {
      id: crypto.randomUUID(),
      country: data.country,
      universe: data.universe,
      platforms: data.platforms
    };

    const updated = this.crossReachService.addRowToTable(this.tableData(), newRow);
    this.tableData.set(updated);
  }

  handleEditRow(updatedRow: CountryRow): void {
    if (updatedRow.isMarket) return;
    const updated = this.crossReachService.updateRowInTable(this.tableData(), updatedRow);
    this.tableData.set(updated);
  }

  handleDeleteRow(id: string): void {
    const updated = this.crossReachService.deleteRowFromTable(this.tableData(), id);
    this.tableData.set(updated);
  }

  handleResetTable(): void {
    this.tableData.set([]);
  }

  openDocModal(): void {
    this.showDocModal.set(true);
  }

  closeDocModal(): void {
    this.showDocModal.set(false);
  }

  openReportModal(): void {
    this.showReportModal.set(true);
  }

  closeReportModal(): void {
    this.showReportModal.set(false);
  }

  openSaveModal(): void {
    if (this.tableData().length === 0) {
      this.showToast('Primero agrega o calcula al menos un país antes de guardar el escenario.');
      return;
    }
    this.showSaveModal.set(true);
  }

  closeSaveModal(): void {
    this.showSaveModal.set(false);
  }

  openDrawer(): void {
    this.showDrawer.set(true);
  }

  closeDrawer(): void {
    this.showDrawer.set(false);
  }

  handleScenarioSaved(scenario: SavedScenario): void {
    this.showSaveModal.set(false);
    this.showToast(`¡Escenario "${scenario.name}" guardado exitosamente en la nube!`);
  }

  handleScenarioLoaded(scenario: SavedScenario): void {
    // Reconstruir los países en la matriz analítica usando el motor deduplicador
    let loadedRows: CountryRow[] = [];
    scenario.rows.forEach(r => {
      loadedRows = this.crossReachService.addRowToTable(loadedRows, {
        id: r.id || crypto.randomUUID(),
        country: r.country,
        universe: r.universe,
        platforms: r.platforms
      });
    });

    this.tableData.set(loadedRows);
    this.showDrawer.set(false);
    this.showToast(`¡Escenario "${scenario.name}" cargado en la tabla activa!`);
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4500);
  }
}

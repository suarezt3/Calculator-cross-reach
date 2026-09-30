import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformFormComponent } from './components/platform-form/platform-form.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { KpiSummaryComponent } from './components/kpi-summary/kpi-summary.component';
import { CrossReachService } from './services/cross-reach.service';
import { CountryRow, PlatformReach, KpiSummary } from './models/platform.models';

import { DocumentationModalComponent } from './components/documentation-modal/documentation-modal.component';
import { ReportTableModalComponent } from './components/report-table-modal/report-table-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    PlatformFormComponent,
    ResultsTableComponent,
    KpiSummaryComponent,
    DocumentationModalComponent,
    ReportTableModalComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  title = 'Cross Reach Enterprise Studio';
  subtitle = 'Multi-Platform Audience Deduplication & Media Planning Matrix';

  // Inicia limpio para pruebas directas del usuario
  tableData = signal<CountryRow[]>([]);

  // Estados de modales
  showDocModal = signal<boolean>(false);
  showReportModal = signal<boolean>(false);

  constructor(public crossReachService: CrossReachService) {
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
        universe: 92000000,
        platforms: [
          { platformName: 'Meta', reach: 78000000 },
          { platformName: 'YouTube', reach: 64000000 },
          { platformName: 'TikTok', reach: 38000000 },
          { platformName: 'Display', reach: 25000000 }
        ]
      },
      {
        country: 'Colombia',
        universe: 39500000,
        platforms: [
          { platformName: 'Meta', reach: 33500000 },
          { platformName: 'YouTube', reach: 28000000 },
          { platformName: 'TikTok', reach: 18000000 },
          { platformName: 'Display', reach: 14000000 }
        ]
      },
      {
        country: 'Chile',
        universe: 16800000,
        platforms: [
          { platformName: 'Meta', reach: 14200000 },
          { platformName: 'YouTube', reach: 13500000 },
          { platformName: 'TikTok', reach: 9800000 }
        ]
      },
      {
        country: 'Peru',
        universe: 24500000,
        platforms: [
          { platformName: 'Meta', reach: 21000000 },
          { platformName: 'YouTube', reach: 17500000 },
          { platformName: 'TikTok', reach: 12800000 }
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
}

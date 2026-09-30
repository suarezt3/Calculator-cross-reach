import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountryRow, PlatformReach, PLATFORM_COLORS, PLATFORM_BG_TINTS } from '../../models/platform.models';
import { CrossReachService } from '../../services/cross-reach.service';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';

@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [CommonModule, FormsModule, PlatformIconComponent],
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.scss']
})
export class ResultsTableComponent {
  @Input() set data(rows: CountryRow[]) {
    this.tableData.set(rows);
    this.updateUniquePlatforms();
  }

  @Output() editRow = new EventEmitter<CountryRow>();
  @Output() deleteRow = new EventEmitter<string>();
  @Output() openReportModal = new EventEmitter<void>();

  tableData = signal<CountryRow[]>([]);
  uniquePlatforms = signal<string[]>([]);
  editingId = signal<string | null>(null);
  searchTerm = signal<string>('');

  editData = signal<{
    country: string;
    universe: number;
    platforms: { [key: string]: number };
  } | null>(null);

  platformColors = PLATFORM_COLORS;
  platformBgTints = PLATFORM_BG_TINTS;

  filteredRows = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const rows = this.tableData();
    if (!term) return rows;
    return rows.filter(r => r.country.toLowerCase().includes(term));
  });

  constructor(public crossReachService: CrossReachService) {}

  private updateUniquePlatforms(): void {
    const platforms = this.crossReachService.getAllUniquePlatforms(this.tableData());
    this.uniquePlatforms.set(platforms);
  }

  getPlatformReach(row: CountryRow, platformName: string): number {
    const platform = row.platforms.find(p => p.platformName === platformName);
    return platform?.reach ?? 0;
  }

  calculatePercentage(reach: number, universe: number): number {
    if (!universe || universe === 0) return 0;
    return parseFloat(((reach / universe) * 100).toFixed(2));
  }

  getGrossReachSum(row: CountryRow): number {
    return row.platforms.reduce((sum, p) => sum + (p.reach ?? 0), 0);
  }

  startEdit(row: CountryRow): void {
    if (row.isMarket) return;

    this.editingId.set(row.id);

    const platformsData: { [key: string]: number } = {};
    row.platforms.forEach(p => {
      platformsData[p.platformName] = p.reach ?? 0;
    });

    this.editData.set({
      country: row.country,
      universe: row.universe ?? 0,
      platforms: platformsData
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editData.set(null);
  }

  saveEdit(row: CountryRow): void {
    const editData = this.editData();
    if (!editData) return;

    const updatedPlatforms: PlatformReach[] = [];
    Object.entries(editData.platforms).forEach(([platformName, reach]) => {
      if (reach > 0) {
        updatedPlatforms.push({ platformName, reach });
      }
    });

    const updatedRow: CountryRow = {
      ...row,
      country: editData.country,
      universe: editData.universe,
      platforms: updatedPlatforms
    };

    this.editRow.emit(updatedRow);
    this.cancelEdit();
  }

  /**
   * Elimina directamente la fila seleccionada (sin bloqueos de window.confirm)
   */
  delete(row: CountryRow, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (row.isMarket) return;

    this.deleteRow.emit(row.id);
  }

  formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('es-CO');
  }

  parseNumber(value: string): number {
    if (!value || value.trim() === '') return 0;
    const cleaned = value.replace(/\D/g, '');
    const parsed = Number(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  onEditUniverseInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const numValue = this.parseNumber(input.value);

    if (this.editData()) {
      this.editData()!.universe = numValue;
      this.editData.set({ ...this.editData()! });
    }

    input.value = numValue ? this.formatNumber(numValue) : '';
  }

  onEditReachInput(platformName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const numValue = this.parseNumber(input.value);

    if (this.editData()) {
      this.editData()!.platforms[platformName] = numValue;
      this.editData.set({ ...this.editData()! });
    }

    input.value = numValue ? this.formatNumber(numValue) : '';
  }

  getEditPlatformReach(platformName: string): number {
    return this.editData()?.platforms[platformName] ?? 0;
  }

  isMarket(row: CountryRow): boolean {
    return row.isMarket ?? false;
  }

  exportCsv(): void {
    this.crossReachService.exportTableToCsv(this.tableData());
  }
}

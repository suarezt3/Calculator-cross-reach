import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CountryRow,
  PlatformReach,
  AVAILABLE_PLATFORMS,
  PLATFORM_COLORS,
  PLATFORM_BG_TINTS
} from '../../models/platform.models';
import { CrossReachService } from '../../services/cross-reach.service';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';

import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  FloppyDiskIcon,
  Camera01Icon,
  Download01Icon,
  Search01Icon,
  Cancel01Icon,
  Edit02Icon,
  Delete02Icon,
  Tick02Icon,
  Add01Icon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [CommonModule, FormsModule, PlatformIconComponent, HugeiconsIconComponent],
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
  @Output() openSaveModal = new EventEmitter<void>();

  readonly FloppyDiskIcon = FloppyDiskIcon;
  readonly Camera01Icon = Camera01Icon;
  readonly Download01Icon = Download01Icon;
  readonly Search01Icon = Search01Icon;
  readonly Cancel01Icon = Cancel01Icon;
  readonly Edit02Icon = Edit02Icon;
  readonly Delete02Icon = Delete02Icon;
  readonly Tick02Icon = Tick02Icon;
  readonly Add01Icon = Add01Icon;

  tableData = signal<CountryRow[]>([]);
  uniquePlatforms = signal<string[]>([]);
  editAddedPlatforms = signal<string[]>([]);
  editingId = signal<string | null>(null);
  searchTerm = signal<string>('');

  // Estado del selector rápido de canales en modo edición
  showAddChannelModal = signal<boolean>(false);
  customChannelName = signal<string>('');
  highlightedPlatform = signal<string | null>(null);

  editData = signal<{
    country: string;
    universe: number;
    platforms: { [key: string]: number };
  } | null>(null);

  platformColors = PLATFORM_COLORS;
  platformBgTints = PLATFORM_BG_TINTS;
  allCatalogPlatforms = AVAILABLE_PLATFORMS;

  /**
   * Canales del catálogo y de la tabla para mostrar en el selector rápido de la fila en edición
   */
  channelsForQuickPicker = computed(() => {
    const currentEdit = this.editData();
    const catalog = [...AVAILABLE_PLATFORMS];
    const currentCols = this.uniquePlatforms();

    currentCols.forEach(col => {
      if (!catalog.some(c => c.toLowerCase() === col.toLowerCase())) {
        catalog.push(col);
      }
    });

    return catalog.map(name => {
      const currentReach = currentEdit?.platforms[name] ?? 0;
      return {
        name,
        hasValue: currentReach > 0,
        currentReach
      };
    });
  });

  filteredRows = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const rows = this.tableData();
    if (!term) return rows;
    return rows.filter(r => r.country.toLowerCase().includes(term));
  });

  constructor(public crossReachService: CrossReachService) {}

  private updateUniquePlatforms(): void {
    const basePlatforms = this.crossReachService.getAllUniquePlatforms(this.tableData());
    const extraPlatforms = this.editAddedPlatforms();

    const combined = new Set<string>([...basePlatforms, ...extraPlatforms]);
    const sorted: string[] = [];

    AVAILABLE_PLATFORMS.forEach(canonical => {
      const match = Array.from(combined).find(p => p.toLowerCase() === canonical.toLowerCase());
      if (match && !sorted.includes(match)) {
        sorted.push(match);
        combined.delete(match);
      }
    });

    Array.from(combined).sort().forEach(p => sorted.push(p));
    this.uniquePlatforms.set(sorted);
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
    this.editAddedPlatforms.set([]);
    this.showAddChannelModal.set(false);
    this.customChannelName.set('');
    this.highlightedPlatform.set(null);

    const platformsData: { [key: string]: number } = {};
    row.platforms.forEach(p => {
      platformsData[p.platformName] = p.reach ?? 0;
    });

    this.editData.set({
      country: row.country,
      universe: row.universe ?? 0,
      platforms: platformsData
    });

    this.updateUniquePlatforms();
  }

  openQuickChannelPicker(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.customChannelName.set('');
    this.showAddChannelModal.set(true);
  }

  closeQuickChannelPicker(): void {
    this.showAddChannelModal.set(false);
    this.customChannelName.set('');
  }

  selectChannelForEdit(platformName: string): void {
    const cleanName = platformName.trim();
    if (!cleanName || !this.editData()) return;

    // Si la plataforma aún no es columna en la tabla, la agregamos dinámicamente
    const currentCols = this.uniquePlatforms();
    const existingCol = currentCols.find(c => c.toLowerCase() === cleanName.toLowerCase());
    const targetName = existingCol || cleanName;

    if (!existingCol) {
      this.editAddedPlatforms.update(list => [...list, targetName]);
      this.updateUniquePlatforms();
    }

    // Asegurar que exista la entrada en editData
    const currentData = this.editData()!;
    if (currentData.platforms[targetName] === undefined) {
      currentData.platforms[targetName] = 0;
      this.editData.set({
        ...currentData,
        platforms: { ...currentData.platforms }
      });
    }

    this.showAddChannelModal.set(false);
    this.customChannelName.set('');
    this.highlightedPlatform.set(targetName);

    // Enfocar automáticamente el input de ese canal en la fila editada
    setTimeout(() => {
      const inputEl = document.getElementById(`edit-reach-input-${targetName}`) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        inputEl.focus();
        inputEl.select();
      }
      setTimeout(() => {
        if (this.highlightedPlatform() === targetName) {
          this.highlightedPlatform.set(null);
        }
      }, 2200);
    }, 60);
  }

  addCustomChannelInEdit(): void {
    const custom = this.customChannelName().trim();
    if (!custom) return;
    this.selectChannelForEdit(custom);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editData.set(null);
    this.editAddedPlatforms.set([]);
    this.showAddChannelModal.set(false);
    this.customChannelName.set('');
    this.highlightedPlatform.set(null);
    this.updateUniquePlatforms();
  }

  saveEdit(row: CountryRow): void {
    const editData = this.editData();
    if (!editData) return;

    const rawPlatforms: PlatformReach[] = [];
    Object.entries(editData.platforms).forEach(([platformName, reach]) => {
      if (reach > 0) {
        rawPlatforms.push({ platformName, reach });
      }
    });

    // Ordenar plataformas según el orden canónico
    const updatedPlatforms: PlatformReach[] = [];
    AVAILABLE_PLATFORMS.forEach(canonical => {
      const match = rawPlatforms.find(p => p.platformName.toLowerCase() === canonical.toLowerCase());
      if (match) {
        updatedPlatforms.push(match);
      }
    });
    rawPlatforms.forEach(p => {
      if (!updatedPlatforms.includes(p)) {
        updatedPlatforms.push(p);
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


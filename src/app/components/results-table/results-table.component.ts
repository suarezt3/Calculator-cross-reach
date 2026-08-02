import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountryRow, PlatformReach, PLATFORM_COLORS } from '../../models/platform.models';
import { CrossReachService } from '../../services/cross-reach.service';

@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  tableData = signal<CountryRow[]>([]);
  uniquePlatforms = signal<string[]>([]);
  editingId = signal<string | null>(null);
  editData = signal<{
    country: string;
    universe: number;
    platforms: { [key: string]: number };
  } | null>(null);

  platformColors = PLATFORM_COLORS;

  constructor(private crossReachService: CrossReachService) {}

  /**
   * Actualiza la lista de plataformas únicas
   */
  private updateUniquePlatforms(): void {
    const platforms = this.crossReachService.getAllUniquePlatforms(this.tableData());
    this.uniquePlatforms.set(platforms);
  }

  /**
   * Obtiene el reach de una plataforma para una fila
   */
  getPlatformReach(row: CountryRow, platformName: string): number {
    const platform = row.platforms.find(p => p.platformName === platformName);
    return platform?.reach ?? 0;
  }

  /**
   * Calcula el porcentaje de reach
   */
  calculatePercentage(reach: number, universe: number): number {
    if (universe === 0) return 0;
    return parseFloat(((reach / universe) * 100).toFixed(2));
  }

  /**
   * Inicia la edición de una fila
   */
  startEdit(row: CountryRow): void {
    // No permitir editar mercados
    if (row.isMarket) {
      return;
    }

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

  /**
   * Cancela la edición
   */
  cancelEdit(): void {
    this.editingId.set(null);
    this.editData.set(null);
  }

  /**
   * Guarda los cambios de la fila editada
   */
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
   * Elimina una fila
   */
  delete(row: CountryRow): void {
    // No permitir eliminar mercados
    if (row.isMarket) {
      return;
    }

    if (confirm(`¿Estás seguro de eliminar la fila de ${row.country}?`)) {
      this.deleteRow.emit(row.id);
    }
  }

  /**
   * Actualiza un valor durante la edición
   */
  updateEditValue(field: string, value: string | number, platformName?: string): void {
    const current = this.editData();
    if (!current) return;

    if (platformName) {
      current.platforms[platformName] = Number(value);
    } else {
      if (field === 'country') {
        current.country = String(value);
      } else if (field === 'universe') {
        current.universe = Number(value);
      }
    }

    this.editData.set({ ...current });
  }

  /**
   * Formatea números con puntos de mil
   */
  formatNumber(num: number | null | undefined): string {
    if (!num) return '-';
    return num.toLocaleString('es-CO');
  }

  /**
   * Verifica si una fila es un mercado (solo lectura)
   */
  isMarket(row: CountryRow): boolean {
    return row.isMarket ?? false;
  }
}

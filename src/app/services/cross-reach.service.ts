import { Injectable } from '@angular/core';
import { CountryRow, PlatformReach } from '../models/platform.models';

@Injectable({
  providedIn: 'root'
})
export class CrossReachService {

  constructor() { }

  /**
   * Calcula el Cross Reach usando la fórmula de Sainsbury
   * Fórmula: R1 + R2 - (1.05 * R1 * R2) + R3 - (1.05 * (R1+R2-1.05*R1*R2) * R3) + ...
   */
  calculateCrossReach(platforms: PlatformReach[], universe: number): { crossReach: number; percentage: number } {
    if (platforms.length === 0 || universe === 0) {
      return { crossReach: 0, percentage: 0 };
    }

    // Ordenar platforms por reach de mayor a menor
    const sortedPlatforms = [...platforms]
      .filter(p => p.reach > 0)
      .sort((a, b) => b.reach - a.reach);

    if (sortedPlatforms.length === 0) {
      return { crossReach: 0, percentage: 0 };
    }

    // Convertir reaches a porcentajes (0-1)
    const reaches = sortedPlatforms.map(p => p.reach / universe);

    // Aplicar fórmula de Sainsbury iterativamente
    let cumulativeReach = reaches[0];

    for (let i = 1; i < reaches.length; i++) {
      const intersection = 1.05 * cumulativeReach * reaches[i];
      cumulativeReach = cumulativeReach + reaches[i] - intersection;
    }

    // Asegurar que no exceda 100%
    cumulativeReach = Math.min(cumulativeReach, 1);
    cumulativeReach = Math.max(cumulativeReach, 0);

    const crossReachValue = cumulativeReach * universe;
    const percentage = cumulativeReach * 100;

    return {
      crossReach: Math.round(crossReachValue),
      percentage: parseFloat(percentage.toFixed(2))
    };
  }

  /**
   * Agrega una fila a la tabla calculando el cross reach
   */
  addRowToTable(rows: CountryRow[], newRow: CountryRow): CountryRow[] {
    const calculation = this.calculateCrossReach(newRow.platforms, newRow.universe);

    const rowWithCalculation: CountryRow = {
      ...newRow,
      crossReach: calculation.crossReach,
      crossReachPercentage: calculation.percentage
    };

    return [...rows, rowWithCalculation];
  }

  /**
   * Actualiza una fila existente
   */
  updateRowInTable(rows: CountryRow[], updatedRow: CountryRow): CountryRow[] {
    const calculation = this.calculateCrossReach(updatedRow.platforms, updatedRow.universe);

    const rowWithCalculation: CountryRow = {
      ...updatedRow,
      crossReach: calculation.crossReach,
      crossReachPercentage: calculation.percentage
    };

    return rows.map(row => row.id === updatedRow.id ? rowWithCalculation : row);
  }

  /**
   * Elimina una fila por ID
   */
  deleteRowFromTable(rows: CountryRow[], id: string): CountryRow[] {
    return rows.filter(row => row.id !== id);
  }

  /**
   * Obtiene todas las plataformas únicas de todas las filas
   */
  getAllUniquePlatforms(rows: CountryRow[]): string[] {
    const platforms = new Set<string>();
    rows.forEach(row => {
      row.platforms.forEach(p => platforms.add(p.platformName));
    });
    return Array.from(platforms).sort();
  }
}

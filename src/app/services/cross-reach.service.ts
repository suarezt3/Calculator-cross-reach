import { Injectable } from '@angular/core';
import { CountryRow, PlatformReach } from '../models/platform.models';

@Injectable({
  providedIn: 'root'
})
export class CrossReachService {

  // Países que pueden componer Casaca
  private readonly CASACA_COUNTRIES = ['Colombia', 'Chile', 'Peru', 'Costa Rica'];

  // País requerido para Latam
  private readonly LATAM_REQUIRED_COUNTRY = 'Mexico';

  // Todos los países que pueden componer Latam
  private readonly ALL_LATAM_COUNTRIES = ['Mexico', 'Colombia', 'Chile', 'Peru', 'Costa Rica'];

  constructor() { }

  /**
   * Calcula el Cross Reach usando la fórmula de Sainsbury
   */
  calculateCrossReach(platforms: PlatformReach[], universe: number): { crossReach: number; percentage: number } {
    if (platforms.length === 0 || universe === 0) {
      return { crossReach: 0, percentage: 0 };
    }

    const sortedPlatforms = [...platforms]
      .filter(p => (p.reach ?? 0) > 0)
      .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0));

    if (sortedPlatforms.length === 0) {
      return { crossReach: 0, percentage: 0 };
    }

    const reaches = sortedPlatforms.map(p => (p.reach ?? 0) / universe);

    let cumulativeReach = reaches[0];

    for (let i = 1; i < reaches.length; i++) {
      const intersection = 1.05 * cumulativeReach * reaches[i];
      cumulativeReach = cumulativeReach + reaches[i] - intersection;
    }

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
    const calculation = this.calculateCrossReach(newRow.platforms, newRow.universe ?? 0);

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
    const calculation = this.calculateCrossReach(updatedRow.platforms, updatedRow.universe ?? 0);

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

  /**
   * Calcula el mercado Casaca
   * Regla: Se compone con 2 o más países de [Colombia, Chile, Peru, Costa Rica]
   */
  calculateCasacaMarket(rows: CountryRow[]): CountryRow | null {
    // Filtrar solo países que pertenecen a Casaca
    const casacaRows = rows.filter(
      row => !row.isMarket && this.CASACA_COUNTRIES.includes(row.country)
    );

    // Necesita al menos 2 países para formar Casaca
    if (casacaRows.length < 2) {
      return null;
    }

    return this.buildAggregatedMarket(casacaRows, 'Casaca');
  }

  /**
   * Calcula el mercado Latam
   * Regla: Se compone con Mexico + al menos 1 país más
   */
  calculateLatamMarket(rows: CountryRow[]): CountryRow | null {
    // Filtrar solo países que pertenecen a Latam (excluyendo mercados)
    const latamRows = rows.filter(
      row => !row.isMarket && this.ALL_LATAM_COUNTRIES.includes(row.country)
    );

    // Verificar que exista Mexico
    const hasMexico = latamRows.some(row => row.country === this.LATAM_REQUIRED_COUNTRY);

    // Necesita Mexico + al menos 1 país más (total 2+)
    if (!hasMexico || latamRows.length < 2) {
      return null;
    }

    return this.buildAggregatedMarket(latamRows, 'Latam');
  }

  /**
   * Construye un mercado agregado sumando los reaches de las filas dadas
   */
  private buildAggregatedMarket(rows: CountryRow[], marketName: string): CountryRow {
    // Sumar universos
    const totalUniverse = rows.reduce((sum, row) => sum + (row.universe ?? 0), 0);

    // Obtener todas las plataformas únicas del mercado
    const allPlatforms = new Set<string>();
    rows.forEach(row => {
      row.platforms.forEach(p => allPlatforms.add(p.platformName));
    });

    // Sumar reaches por plataforma
    const aggregatedPlatforms: PlatformReach[] = [];
    allPlatforms.forEach(platformName => {
      const totalReach = rows.reduce((sum, row) => {
        const platform = row.platforms.find(p => p.platformName === platformName);
        return sum + (platform?.reach ?? 0);
      }, 0);

      if (totalReach > 0) {
        aggregatedPlatforms.push({
          platformName,
          reach: totalReach
        });
      }
    });

    // Calcular cross reach
    const calculation = this.calculateCrossReach(aggregatedPlatforms, totalUniverse);

    return {
      id: `market-${marketName.toLowerCase()}`,
      country: marketName,
      universe: totalUniverse,
      platforms: aggregatedPlatforms,
      crossReach: calculation.crossReach,
      crossReachPercentage: calculation.percentage,
      isMarket: true
    };
  }

  /**
   * Obtiene todas las filas incluyendo los mercados calculados
   */
  getAllRowsWithMarkets(rows: CountryRow[]): CountryRow[] {
    // Filtrar filas que no sean mercados
    const countryRows = rows.filter(row => !row.isMarket);

    // Calcular mercados
    const casacaMarket = this.calculateCasacaMarket(countryRows);
    const latamMarket = this.calculateLatamMarket(countryRows);

    // Construir resultado
    const result = [...countryRows];

    if (casacaMarket) {
      result.push(casacaMarket);
    }

    if (latamMarket) {
      result.push(latamMarket);
    }

    return result;
  }
}

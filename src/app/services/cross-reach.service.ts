import { Injectable } from '@angular/core';
import { CountryRow, PlatformReach, KpiSummary } from '../models/platform.models';

@Injectable({
  providedIn: 'root'
})
export class CrossReachService {

  // Países que componen Casaca
  private readonly CASACA_COUNTRIES = ['Colombia', 'Chile', 'Peru', 'Costa Rica'];

  // País requerido para Latam
  private readonly LATAM_REQUIRED_COUNTRY = 'Mexico';

  // Todos los países que pueden componer Latam
  private readonly ALL_LATAM_COUNTRIES = ['Mexico', 'Colombia', 'Chile', 'Peru', 'Costa Rica'];

  constructor() { }

  /**
   * Calcula el Cross Reach usando el modelo de deduplicación probabilística iterativa
   * R_cross = R1 + R2 - (1.05 * R1 * R2) de forma iterativa y ordenada descendente
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
   * Actualiza una fila existente recalculando el cross reach
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
   * Obtiene todas las plataformas únicas de todas las filas registradas
   */
  getAllUniquePlatforms(rows: CountryRow[]): string[] {
    const platforms = new Set<string>();
    rows.forEach(row => {
      row.platforms.forEach(p => {
        if ((p.reach ?? 0) > 0 || row.platforms.length > 0) {
          platforms.add(p.platformName);
        }
      });
    });

    const canonicalOrder = [
      'Meta',
      'YouTube',
      'TikTok',
      'Netflix',
      'Disney',
      'Display',
      'OOH',
      'DOOH'
    ];

    const sorted: string[] = [];
    canonicalOrder.forEach(name => {
      const match = Array.from(platforms).find(p => p.toLowerCase() === name.toLowerCase());
      if (match && !sorted.includes(match)) {
        sorted.push(match);
        platforms.delete(match);
      }
    });

    Array.from(platforms).sort().forEach(p => sorted.push(p));
    return sorted;
  }

  /**
   * Calcula el mercado Casaca
   * Regla: Se compone con 2 o más países de [Colombia, Chile, Peru, Costa Rica]
   */
  calculateCasacaMarket(rows: CountryRow[]): CountryRow | null {
    const casacaRows = rows.filter(
      row => !row.isMarket && this.CASACA_COUNTRIES.includes(row.country)
    );

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
    const latamRows = rows.filter(
      row => !row.isMarket && this.ALL_LATAM_COUNTRIES.includes(row.country)
    );

    const hasMexico = latamRows.some(row => row.country === this.LATAM_REQUIRED_COUNTRY);

    if (!hasMexico || latamRows.length < 2) {
      return null;
    }

    return this.buildAggregatedMarket(latamRows, 'Latam');
  }

  /**
   * Construye un mercado agregado sumando los reaches y universos de las filas dadas
   */
  private buildAggregatedMarket(rows: CountryRow[], marketName: string): CountryRow {
    const totalUniverse = rows.reduce((sum, row) => sum + (row.universe ?? 0), 0);

    const allPlatforms = new Set<string>();
    rows.forEach(row => {
      row.platforms.forEach(p => allPlatforms.add(p.platformName));
    });

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
   * Obtiene todas las filas incluyendo los mercados calculados (Casaca / Latam)
   */
  getAllRowsWithMarkets(rows: CountryRow[]): CountryRow[] {
    const countryRows = rows.filter(row => !row.isMarket);

    const casacaMarket = this.calculateCasacaMarket(countryRows);
    const latamMarket = this.calculateLatamMarket(countryRows);

    const result = [...countryRows];

    if (casacaMarket) {
      result.push(casacaMarket);
    }

    if (latamMarket) {
      result.push(latamMarket);
    }

    return result;
  }

  /**
   * Genera el resumen ejecutivo KPI para visualización estratégica
   */
  calculateKpiSummary(rows: CountryRow[]): KpiSummary {
    const countryRows = rows.filter(row => !row.isMarket);
    const displayedRows = this.getAllRowsWithMarkets(rows);
    const marketRows = displayedRows.filter(r => r.isMarket);

    if (countryRows.length === 0) {
      return {
        totalDeduplicatedReach: 0,
        totalGrossReach: 0,
        overallEfficiencyPercent: 0,
        averageReachPercent: 0,
        topPlatformName: 'N/A',
        topPlatformReach: 0,
        activeCountriesCount: 0,
        activeMarketsCount: 0,
        totalUniverse: 0
      };
    }

    // Universo total sumado de países base
    const totalUniverse = countryRows.reduce((sum, r) => sum + (r.universe ?? 0), 0);

    // Suma de alcances brutos (sin deduplicar)
    let totalGrossReach = 0;
    const platformTotals = new Map<string, number>();

    countryRows.forEach(row => {
      row.platforms.forEach(p => {
        const reach = p.reach ?? 0;
        totalGrossReach += reach;
        platformTotals.set(p.platformName, (platformTotals.get(p.platformName) || 0) + reach);
      });
    });

    // Deduplicación regional sincronizada con la fila Latam
    const latamMarket = displayedRows.find(r => r.country.toLowerCase() === 'latam');
    const casacaMarket = displayedRows.find(r => r.country.toLowerCase() === 'casaca');

    let totalDeduplicatedReach = 0;
    let averageReachPercent = 0;

    if (latamMarket && (latamMarket.crossReach ?? 0) > 0) {
      // Coincidencia exacta con la fila Latam de la tabla
      totalDeduplicatedReach = latamMarket.crossReach ?? 0;
      averageReachPercent = latamMarket.crossReachPercentage ?? 0;
    } else if (casacaMarket && (casacaMarket.crossReach ?? 0) > 0) {
      totalDeduplicatedReach = casacaMarket.crossReach ?? 0;
      averageReachPercent = casacaMarket.crossReachPercentage ?? 0;
    } else if (countryRows.length === 1) {
      totalDeduplicatedReach = countryRows[0].crossReach ?? 0;
      averageReachPercent = countryRows[0].crossReachPercentage ?? 0;
    } else {
      // Cálculo multialcance regional conjunto para los países activos
      const aggregatedPlatforms: PlatformReach[] = [];
      platformTotals.forEach((reach, platformName) => {
        aggregatedPlatforms.push({ platformName, reach });
      });
      const regionalCalc = this.calculateCrossReach(aggregatedPlatforms, totalUniverse);
      totalDeduplicatedReach = regionalCalc.crossReach;
      averageReachPercent = regionalCalc.percentage;
    }

    // Porcentaje de deduplicación / solapamiento optimizado
    const overallEfficiencyPercent = totalGrossReach > 0
      ? Math.round(((totalGrossReach - totalDeduplicatedReach) / totalGrossReach) * 100)
      : 0;

    // Top Platform
    let topPlatformName = 'N/A';
    let topPlatformReach = 0;
    platformTotals.forEach((reach, name) => {
      if (reach > topPlatformReach) {
        topPlatformReach = reach;
        topPlatformName = name;
      }
    });

    return {
      totalDeduplicatedReach,
      totalGrossReach,
      overallEfficiencyPercent,
      averageReachPercent,
      topPlatformName,
      topPlatformReach,
      activeCountriesCount: countryRows.length,
      activeMarketsCount: marketRows.length,
      totalUniverse
    };
  }

  /**
   * Genera y descarga un CSV con los resultados calculados
   */
  exportTableToCsv(rows: CountryRow[]): void {
    if (rows.length === 0) return;

    const uniquePlatforms = this.getAllUniquePlatforms(rows);
    const headers = ['Tipo', 'Pais / Region', 'Universo Total'];

    uniquePlatforms.forEach(p => {
      headers.push(`${p} Reach`, `${p} %`);
    });

    headers.push('% Cross Reach Final', 'Cross Reach Neto Deduplicado');

    const csvRows: string[] = [headers.join(',')];

    rows.forEach(row => {
      const type = row.isMarket ? 'Mercado Agregado' : 'Pais Individual';
      const line: (string | number)[] = [
        `"${type}"`,
        `"${row.country}"`,
        row.universe ?? 0
      ];

      uniquePlatforms.forEach(platformName => {
        const platform = row.platforms.find(p => p.platformName === platformName);
        const reach = platform?.reach ?? 0;
        const pct = (row.universe && row.universe > 0) ? ((reach / row.universe) * 100).toFixed(2) : '0';
        line.push(reach, `${pct}%`);
      });

      line.push(
        `${row.crossReachPercentage ?? 0}%`,
        row.crossReach ?? 0
      );

      csvRows.push(line.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `cross_reach_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

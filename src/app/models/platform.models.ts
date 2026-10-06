export interface PlatformReach {
  platformName: string;
  reach: number | null;
}

export interface CountryRow {
  id: string;
  country: string;
  universe: number | null;
  platforms: PlatformReach[];
  crossReach?: number;
  crossReachPercentage?: number;
  isMarket?: boolean; // Indica si es un mercado calculado (Casaca/Latam)
}

export interface KpiSummary {
  totalDeduplicatedReach: number;
  totalGrossReach: number;
  overallEfficiencyPercent: number;
  averageReachPercent: number;
  topPlatformName: string;
  topPlatformReach: number;
  activeCountriesCount: number;
  activeMarketsCount: number;
  totalUniverse: number;
}

export const AVAILABLE_PLATFORMS = [
  'Meta',
  'YouTube',
  'TikTok',
  'Netflix',
  'Disney',
  'Display',
  'OOH',
  'DOOH'
];

// Universos oficiales confirmados para planificación de medios
export const DEFAULT_COUNTRY_UNIVERSES: Record<string, number> = {
  'Colombia': 27000000,
  'Chile': 9500000,
  'Peru': 18500000,
  'Costa Rica': 3500000,
  'Mexico': 53000000
};

// Colores corporativos y representativos de cada plataforma
export const PLATFORM_COLORS: Record<string, string> = {
  'Meta': '#0064E0',
  'YouTube': '#FF0000',
  'TikTok': '#0F172A',
  'Netflix': '#E50914',
  'Disney': '#0063E5',
  'Display': '#0284C7',
  'OOH': '#D97706',
  'DOOH': '#0D9488'
};

// Badges y estilos de acento
export const PLATFORM_BG_TINTS: Record<string, string> = {
  'Meta': 'rgba(0, 100, 224, 0.08)',
  'YouTube': 'rgba(255, 0, 0, 0.08)',
  'TikTok': 'rgba(15, 23, 42, 0.08)',
  'Netflix': 'rgba(229, 9, 20, 0.08)',
  'Disney': 'rgba(0, 99, 229, 0.08)',
  'Display': 'rgba(2, 132, 199, 0.08)',
  'OOH': 'rgba(217, 119, 6, 0.08)',
  'DOOH': 'rgba(13, 148, 136, 0.08)'
};

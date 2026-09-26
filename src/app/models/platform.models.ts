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
  'Display'
];

// Colores corporativos y representativos de cada plataforma
export const PLATFORM_COLORS: Record<string, string> = {
  'Meta': '#0064E0',
  'YouTube': '#FF0000',
  'TikTok': '#0F172A',
  'Display': '#0284C7'
};

// Badges y estilos de acento
export const PLATFORM_BG_TINTS: Record<string, string> = {
  'Meta': 'rgba(0, 100, 224, 0.08)',
  'YouTube': 'rgba(255, 0, 0, 0.08)',
  'TikTok': 'rgba(15, 23, 42, 0.08)',
  'Display': 'rgba(2, 132, 199, 0.08)'
};

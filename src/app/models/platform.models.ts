export interface PlatformReach {
  platformName: string;
  reach: number;
}

export interface CountryRow {
  id: string;
  country: string;
  universe: number;
  platforms: PlatformReach[];
  crossReach?: number;
  crossReachPercentage?: number;
}

export const AVAILABLE_PLATFORMS = [
  'Meta',
  'Tik Tok',
  'YouTube',
  'DV360',
  'Programmatic',
  'TV',
  'Radio',
  'Display'
];

export const PLATFORM_COLORS: Record<string, string> = {
  'Meta': '#a8c6fa',
  'Tik Tok': '#b0b0b0',
  'YouTube': '#f4aeb0',
  'DV360': '#c1e1c1',
  'Programmatic': '#ffd700',
  'TV': '#dda0dd',
  'Radio': '#98fb98',
  'Display': '#87ceeb'
};

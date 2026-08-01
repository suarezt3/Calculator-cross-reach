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

// SVGs inline de las plataformas (colores originales)
export const PLATFORM_SVGS: Record<string, string> = {
  'Meta': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,

  'Tik Tok': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>`,

  'YouTube': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,

  'DV360': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,

  'Programmatic': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#FFD700" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,

  'TV': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#9C27B0" d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`,

  'Radio': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4CAF50" d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34-.37-.92L3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z"/></svg>`,

  'Display': `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#03A9F4" d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15h14v3H5z"/></svg>`
};

// Colores de fondo para las tarjetas
export const PLATFORM_COLORS: Record<string, string> = {
  'Meta': '#1877F2',
  'Tik Tok': '#000000',
  'YouTube': '#FF0000',
  'DV360': '#4285F4',
  'Programmatic': '#FFD700',
  'TV': '#9C27B0',
  'Radio': '#4CAF50',
  'Display': '#03A9F4'
};

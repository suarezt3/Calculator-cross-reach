import { Component, EventEmitter, Output, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';
import {
  AVAILABLE_PLATFORMS,
  PLATFORM_COLORS,
  PLATFORM_BG_TINTS,
  PlatformReach
} from '../../models/platform.models';

export interface CountryPopulationHint {
  name: string;
  defaultUniverse: number;
}

export const COUNTRY_POPULATION_DATA: CountryPopulationHint[] = [
  { name: 'Colombia', defaultUniverse: 27000000 },
  { name: 'Chile', defaultUniverse: 9500000 },
  { name: 'Peru', defaultUniverse: 18500000 },
  { name: 'Costa Rica', defaultUniverse: 3500000 },
  { name: 'Mexico', defaultUniverse: 53000000 }
];

export const AVAILABLE_COUNTRIES = COUNTRY_POPULATION_DATA.map(c => c.name);

@Component({
  selector: 'app-platform-form',
  standalone: true,
  imports: [CommonModule, FormsModule, PlatformIconComponent],
  templateUrl: './platform-form.component.html',
  styleUrls: ['./platform-form.component.scss']
})
export class PlatformFormComponent {
  @Output() addToTable = new EventEmitter<{
    country: string;
    universe: number;
    platforms: PlatformReach[];
  }>();

  usedCountries = input<string[]>([]);

  country = signal<string>('');
  universe = signal<number | null>(null);
  platforms = signal<PlatformReach[]>([]);
  showPlatformSelector = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  availableCountries = computed(() => {
    const used = this.usedCountries();
    return COUNTRY_POPULATION_DATA.filter(c => !used.includes(c.name));
  });

  availablePlatforms = computed(() => {
    const currentNames = this.platforms().map(p => p.platformName);
    return AVAILABLE_PLATFORMS.filter(p => !currentNames.includes(p));
  });

  platformColors = PLATFORM_COLORS;
  platformBgTints = PLATFORM_BG_TINTS;

  onCountrySelect(countryName: string): void {
    this.country.set(countryName);
    this.errorMessage.set(null);

    // Cargar por defecto el valor de universo oficial confirmado (editable)
    const match = COUNTRY_POPULATION_DATA.find(c => c.name === countryName);
    if (match) {
      this.universe.set(match.defaultUniverse);
    }
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || value === 0) {
      return '';
    }
    return value.toLocaleString('es-CO');
  }

  parseNumber(value: string): number | null {
    if (!value || value.trim() === '') {
      return null;
    }
    const cleaned = value.replace(/\D/g, '');
    const parsed = Number(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  onUniverseInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const numValue = this.parseNumber(input.value);

    this.universe.set(numValue);
    this.errorMessage.set(null);

    if (numValue !== null) {
      input.value = this.formatNumber(numValue);
    } else {
      input.value = '';
    }
  }

  onReachInput(platformName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const numValue = this.parseNumber(input.value);

    this.updatePlatformReach(platformName, numValue);
    this.errorMessage.set(null);

    if (numValue !== null) {
      input.value = this.formatNumber(numValue);
    } else {
      input.value = '';
    }
  }

  openPlatformSelector(): void {
    if (this.availablePlatforms().length === 0) {
      this.errorMessage.set('Ya has agregado todas las plataformas disponibles.');
      return;
    }
    this.errorMessage.set(null);
    this.showPlatformSelector.set(true);
  }

  addPlatform(platformName: string): void {
    const newPlatform: PlatformReach = {
      platformName,
      reach: null
    };
    this.platforms.update(current => [...current, newPlatform]);
    this.showPlatformSelector.set(false);
    this.errorMessage.set(null);
  }

  removePlatform(platformName: string): void {
    this.platforms.update(current =>
      current.filter(p => p.platformName !== platformName)
    );
    this.errorMessage.set(null);
  }

  updatePlatformReach(platformName: string, reach: number | null): void {
    this.platforms.update(current =>
      current.map(p =>
        p.platformName === platformName ? { ...p, reach } : p
      )
    );
  }

  getReachPercentage(reach: number | null | undefined): string {
    const u = this.universe();
    if (!reach || !u || u === 0) return '0.0%';
    const pct = (reach / u) * 100;
    return `${pct.toFixed(1)}%`;
  }

  applyPreset(type: 'social' | 'video' | 'all'): void {
    let presetPlatforms: string[] = [];
    if (type === 'social') {
      presetPlatforms = ['Meta', 'TikTok'];
    } else if (type === 'video') {
      presetPlatforms = ['Meta', 'YouTube', 'TikTok'];
    } else if (type === 'all') {
      presetPlatforms = ['Meta', 'YouTube', 'TikTok', 'Display'];
    }

    const currentReaches = new Map<string, number | null>();
    this.platforms().forEach(p => currentReaches.set(p.platformName, p.reach));

    const updated: PlatformReach[] = presetPlatforms.map(pName => ({
      platformName: pName,
      reach: currentReaches.get(pName) ?? null
    }));

    this.platforms.set(updated);
    this.errorMessage.set(null);
  }

  submitForm(): void {
    if (!this.country() || this.country().trim() === '') {
      this.errorMessage.set('Por favor selecciona un país para el plan de medios.');
      return;
    }

    if (!this.universe() || this.universe()! <= 0) {
      this.errorMessage.set('Por favor ingresa un universo poblacional válido mayor a 0.');
      return;
    }

    if (this.platforms().length === 0) {
      this.errorMessage.set('Por favor añade al menos una plataforma con alcance.');
      return;
    }

    const validPlatforms = this.platforms().filter(p => p.reach !== null && p.reach! > 0);
    if (validPlatforms.length === 0) {
      this.errorMessage.set('Debes registrar el alcance numérico de al menos una plataforma.');
      return;
    }

    this.errorMessage.set(null);

    this.addToTable.emit({
      country: this.country().trim(),
      universe: this.universe()!,
      platforms: this.platforms()
    });

    this.clearForm();
  }

  clearForm(): void {
    this.country.set('');
    this.universe.set(null);
    this.platforms.set([]);
    this.showPlatformSelector.set(false);
    this.errorMessage.set(null);
  }
}

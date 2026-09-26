import { Component, EventEmitter, Output, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';
import { NumberFormatPipe } from '../../pipes/number-format.pipe';
import {
  AVAILABLE_PLATFORMS,
  PLATFORM_COLORS,
  PlatformReach
} from '../../models/platform.models';

// Lista de países disponibles
export const AVAILABLE_COUNTRIES = ['Mexico', 'Colombia', 'Peru', 'Chile', 'Costa Rica'];

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

  // Input signal para recibir los países ya agregados a la tabla
  usedCountries = input<string[]>([]);

  // Signals para el estado del formulario
  country = signal<string>('');
  universe = signal<number | null>(null);
  platforms = signal<PlatformReach[]>([]);
  showPlatformSelector = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Signals para mostrar valores formateados
  universeDisplay = signal<string>('');
  reachDisplays = signal<Map<string, string>>(new Map());

  // Países disponibles (filtrando los que ya están en la tabla)
  availableCountries = computed(() => {
    const used = this.usedCountries();
    return AVAILABLE_COUNTRIES.filter(c => !used.includes(c));
  });

  // Plataformas disponibles (las que no están agregadas)
  availablePlatforms = computed(() => {
    const currentNames = this.platforms().map(p => p.platformName);
    return AVAILABLE_PLATFORMS.filter(p => !currentNames.includes(p));
  });

  // Colores de plataformas
  platformColors = PLATFORM_COLORS;

  /**
   * Formatea un número con separación de miles
   */
  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return value.toLocaleString('es-CO');
  }

  /**
   * Parsea un string formateado a número
   */
  parseNumber(value: string): number | null {
    if (!value || value.trim() === '') {
      return null;
    }
    const cleaned = value.replace(/\./g, '');
    const parsed = Number(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Maneja el input del universo con formato
   */
  onUniverseInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\./g, '');
    const numValue = this.parseNumber(value);

    this.universe.set(numValue);

    if (numValue !== null) {
      input.value = this.formatNumber(numValue);
    } else {
      input.value = '';
    }
  }

  /**
   * Maneja el input del reach con formato
   */
  onReachInput(platformName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\./g, '');
    const numValue = this.parseNumber(value);

    this.updatePlatformReach(platformName, numValue);

    if (numValue !== null) {
      input.value = this.formatNumber(numValue);
    } else {
      input.value = '';
    }
  }

  /**
   * Maneja el cambio de selección de país
   */
  onCountrySelect(value: string): void {
    this.country.set(value);
    this.errorMessage.set(null);
  }

  /**
   * Abre el selector de plataformas
   */
  openPlatformSelector(): void {
    if (this.availablePlatforms().length === 0) {
      this.errorMessage.set('Ya agregaste todas las plataformas disponibles');
      return;
    }
    this.errorMessage.set(null);
    this.showPlatformSelector.set(true);
  }

  /**
   * Agrega una plataforma al formulario
   */
  addPlatform(platformName: string): void {
    const newPlatform: PlatformReach = {
      platformName,
      reach: null
    };
    this.platforms.update(current => [...current, newPlatform]);
    this.showPlatformSelector.set(false);
    this.errorMessage.set(null);
  }

  /**
   * Elimina una plataforma del formulario
   */
  removePlatform(platformName: string): void {
    this.platforms.update(current =>
      current.filter(p => p.platformName !== platformName)
    );
    this.errorMessage.set(null);
  }

  /**
   * Actualiza el reach de una plataforma
   */
  updatePlatformReach(platformName: string, reach: number | null): void {
    this.errorMessage.set(null);
    this.platforms.update(current =>
      current.map(p =>
        p.platformName === platformName ? { ...p, reach } : p
      )
    );
  }

  /**
   * Agrega los datos a la tabla
   */
  submitForm(): void {
    if (!this.country() || this.country().trim() === '') {
      this.errorMessage.set('Por favor selecciona un país');
      return;
    }

    if (!this.universe() || this.universe()! <= 0) {
      this.errorMessage.set('Por favor ingresa un universo válido mayor a 0');
      return;
    }

    if (this.platforms().length === 0) {
      this.errorMessage.set('Por favor agrega al menos una plataforma');
      return;
    }

    const hasValidReach = this.platforms().some(p => p.reach !== null && p.reach! > 0);
    if (!hasValidReach) {
      this.errorMessage.set('Por favor ingresa el reach de al menos una plataforma');
      return;
    }

    this.errorMessage.set(null);

    this.addToTable.emit({
      country: this.country().trim(),
      universe: this.universe()!,
      platforms: this.platforms()
    });

    // Limpiar formulario
    this.clearForm();
  }

  /**
   * Limpia el formulario
   */
  clearForm(): void {
    this.country.set('');
    this.universe.set(null);
    this.platforms.set([]);
    this.showPlatformSelector.set(false);
    this.errorMessage.set(null);
  }

  /**
   * Carga datos en el formulario para edición
   */
  loadDataForEdit(country: string, universe: number, platforms: PlatformReach[]): void {
    this.country.set(country);
    this.universe.set(universe);
    this.platforms.set(platforms.map(p => ({ ...p })));
  }
}

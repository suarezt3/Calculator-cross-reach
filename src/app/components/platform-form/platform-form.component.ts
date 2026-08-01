import { Component, EventEmitter, Output, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AVAILABLE_PLATFORMS, PLATFORM_COLORS, PlatformReach } from '../../models/platform.models';

// Lista de países disponibles
export const AVAILABLE_COUNTRIES = ['Mexico', 'Colombia', 'Peru', 'Chile', 'Costa Rica'];

@Component({
  selector: 'app-platform-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  universe = signal<number>(0);
  platforms = signal<PlatformReach[]>([]);
  showPlatformSelector = signal<boolean>(false);

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
   * Abre el selector de plataformas
   */
  openPlatformSelector(): void {
    if (this.availablePlatforms().length === 0) {
      alert('Ya agregaste todas las plataformas disponibles');
      return;
    }
    this.showPlatformSelector.set(true);
  }

  /**
   * Agrega una plataforma al formulario
   */
  addPlatform(platformName: string): void {
    const newPlatform: PlatformReach = {
      platformName,
      reach: 0
    };
    this.platforms.update(current => [...current, newPlatform]);
    this.showPlatformSelector.set(false);
  }

  /**
   * Elimina una plataforma del formulario
   */
  removePlatform(platformName: string): void {
    this.platforms.update(current =>
      current.filter(p => p.platformName !== platformName)
    );
  }

  /**
   * Actualiza el reach de una plataforma
   */
  updatePlatformReach(platformName: string, reach: number): void {
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
      alert('Por favor selecciona un país');
      return;
    }

    if (this.universe() <= 0) {
      alert('Por favor ingresa un universo válido mayor a 1');
      return;
    }

    if (this.platforms().length === 0) {
      alert('Por favor agrega al menos una plataforma');
      return;
    }

    const hasValidReach = this.platforms().some(p => p.reach > 0);
    if (!hasValidReach) {
      alert('Por favor ingresa el reach de al menos una plataforma');
      return;
    }

    this.addToTable.emit({
      country: this.country().trim(),
      universe: this.universe(),
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
    this.universe.set(0);
    this.platforms.set([]);
    this.showPlatformSelector.set(false);
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

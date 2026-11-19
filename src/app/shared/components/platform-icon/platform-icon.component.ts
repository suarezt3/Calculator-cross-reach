import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Renders the icon or full logo for a media platform with fallback handling.
 */
@Component({
  selector: 'app-platform-icon',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="platform-native-container" [class.is-full]="variant() === 'full'">
      <img
        [src]="logoSrc()"
        [alt]="platformName()"
        class="platform-native-img"
        referrerpolicy="no-referrer"
        loading="eager"
        (error)="handleImageError($event)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .platform-native-container {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;

        &.is-full {
          width: 100%;
          max-width: 140px;
        }
      }

      .platform-native-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        transition: transform 0.15s ease;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.05));
      }
    `,
  ],
})
export class PlatformIconComponent {
  readonly platformName = input<string>('');
  readonly variant = input<'icon' | 'full'>('icon');

  readonly logoSrc = computed<string>(() => {
    const norm = this.normalizePlatformName(this.platformName());

    switch (norm) {
      case 'meta':
        return 'icons/Meta_Logo.png';
      case 'youtube':
        return 'icons/Youtube.png';
      case 'tiktok':
        return 'icons/tiktok.png';
      case 'netflix':
        return 'icons/netflix.svg';
      case 'disney':
        return 'icons/disney.svg';
      case 'display':
        return 'icons/display.png';
      case 'dv360':
        return 'assets/icons/platforms/dv360.svg';
      case 'ooh':
        return 'icons/ooh.svg';
      case 'dooh':
        return 'icons/dooh.svg';
      default:
        return 'icons/display.png';
    }
  });

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }

    const currentSrc = img.src || '';
    const norm = this.normalizePlatformName(this.platformName());

    // DV360 resolves directly to assets/icons/platforms/dv360.svg; guard against
    // re-assigning the same URL or looping once fallen back to display.png.
    if (norm === 'dv360') {
      if (
        !currentSrc.includes('assets/icons/platforms/dv360.svg') &&
        !currentSrc.includes('assets/icons/display.png')
      ) {
        img.src = 'assets/icons/platforms/dv360.svg';
      } else if (!currentSrc.includes('assets/icons/display.png')) {
        img.src = 'assets/icons/display.png';
      }
      return;
    }

    if (!currentSrc.includes('assets/icons/')) {
      switch (norm) {
        case 'meta':
          img.src = 'assets/icons/Meta_Logo.png';
          break;
        case 'youtube':
          img.src = 'assets/icons/Youtube.png';
          break;
        case 'tiktok':
          img.src = 'assets/icons/tiktok.png';
          break;
        case 'netflix':
          img.src = 'assets/icons/netflix.svg';
          break;
        case 'disney':
          img.src = 'assets/icons/disney.svg';
          break;
        case 'ooh':
          img.src = 'assets/icons/ooh.svg';
          break;
        case 'dooh':
          img.src = 'assets/icons/dooh.svg';
          break;
        default:
          img.src = 'assets/icons/display.png';
          break;
      }
    }
  }

  private normalizePlatformName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }
}

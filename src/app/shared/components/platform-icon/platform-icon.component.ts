import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-platform-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="platform-native-container" [class.is-full]="variant === 'full'">
      <img
        [src]="logoSrc()"
        [alt]="platformName"
        class="platform-native-img"
        referrerpolicy="no-referrer"
        loading="eager"
        (error)="handleImageError($event)"
      />
    </div>
  `,
  styles: [`
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
  `]
})
export class PlatformIconComponent {
  @Input() platformName: string = '';
  @Input() variant: 'icon' | 'full' = 'icon';

  logoSrc = computed(() => {
    const norm = (this.platformName || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');

    switch (norm) {
      case 'meta':
        return 'icons/Meta_Logo.png';
      case 'youtube':
        return 'icons/Youtube.png';
      case 'tiktok':
        return 'icons/tiktok.png';
      case 'display':
        return 'icons/display.png';
      default:
        return 'icons/display.png';
    }
  });

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('assets/icons/')) {
      const norm = (this.platformName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm === 'meta') {
        img.src = 'assets/icons/Meta_Logo.png';
      } else if (norm === 'youtube') {
        img.src = 'assets/icons/Youtube.png';
      } else if (norm === 'tiktok') {
        img.src = 'assets/icons/tiktok.png';
      } else {
        img.src = 'assets/icons/display.png';
      }
    }
  }
}

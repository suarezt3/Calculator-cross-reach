import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-platform-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (normalizedName) {
      @case ('meta') {
        <!-- Meta Official Infinity Loop Logo -->
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-svg">
          <path d="M16 10.2c-3.1 0-5.7 2.3-6.9 5.4-1-2.4-3-4.3-5.5-4.3C1.4 11.3 0 12.9 0 16c0 4.3 3.3 8.3 7 8.3 3 0 5.4-2.1 6.6-4.9 1.2 2.8 3.5 4.9 6.6 4.9 3.7 0 7-4 7-8.3 0-3.1-1.4-4.7-3.6-4.7-2.5 0-4.5 1.9-5.5 4.3-1.2-3.1-3.8-5.4-6.9-5.4zm8.1 10.7c-2.2 0-4.4-2.6-5.4-5.3 1-2.6 3-4.8 5.4-4.8 1.3 0 2.1 1 2.1 3 0 2.8-1.7 7.1-2.1 7.1zm-16.2 0c-.4 0-2.1-4.3-2.1-7.1 0-2 .8-3 2.1-3 2.4 0 4.4 2.2 5.4 4.8-1 2.7-3.2 5.3-5.4 5.3z" fill="#0064E0"/>
        </svg>
      }
      @case ('youtube') {
        <!-- YouTube Official Play Logo -->
        <svg viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-svg">
          <path d="M27.438 3.078a3.447 3.447 0 00-2.428-2.438C22.868 0 14 0 14 0S5.132 0 2.99.64A3.447 3.447 0 00.562 3.078C0 5.228 0 9.714 0 9.714s0 4.486.562 6.636a3.447 3.447 0 002.428 2.438C5.132 19.428 14 19.428 14 19.428s8.868 0 11.01-.64a3.447 3.447 0 002.428-2.438C28 14.2 28 9.714 28 9.714s0-4.486-.562-6.636z" fill="#FF0000"/>
          <path d="M11.143 13.857L18.429 9.714 11.143 5.571v8.286z" fill="#FFFFFF"/>
        </svg>
      }
      @case ('tiktok') {
        <!-- TikTok Official Chromatic Aberration Logo -->
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-svg">
          <rect width="24" height="24" rx="5" fill="#000000"/>
          <g transform="translate(3.5, 3)">
            <path d="M12.8 3.8a3.9 3.9 0 01-3.1-3.5V0H6.8v11.5a2.4 2.4 0 01-4.3 1.5 2.4 2.4 0 011.9-3.9c.3 0 .5 0 .7.1V6.3a5.5 5.5 0 00-.7 0A5.3 5.3 0 000 11.6a5.3 5.3 0 009.1 3.7V7.1a6.8 6.8 0 004.1 1.3V5.5a4 4 0 01-.4-1.7z" fill="#25F4EE"/>
            <path d="M13.2 4.2a3.9 3.9 0 01-3.1-3.5V0H7.2v11.5a2.4 2.4 0 01-4.3 1.5 2.4 2.4 0 011.9-3.9c.3 0 .5 0 .7.1V6.7a5.5 5.5 0 00-.7 0A5.3 5.3 0 000 12a5.3 5.3 0 009.1 3.7V7.5a6.8 6.8 0 004.1 1.3V5.9a4 4 0 01-.4-1.7z" fill="#FE2C55" style="mix-blend-mode: screen;"/>
            <path d="M13 4a3.9 3.9 0 01-3.1-3.5V0H7v11.5a2.4 2.4 0 01-4.3 1.5 2.4 2.4 0 011.9-3.9c.3 0 .5 0 .7.1V6.5a5.5 5.5 0 00-.7 0A5.3 5.3 0 000 11.8a5.3 5.3 0 009.1 3.7V7.3a6.8 6.8 0 004.1 1.3V5.7a4 4 0 01-.4-1.7z" fill="#FFFFFF"/>
          </g>
        </svg>
      }
      @case ('display') {
        <!-- Display Network Banner Icon -->
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-svg">
          <rect width="24" height="24" rx="4" fill="#E0F2FE"/>
          <rect x="3" y="4" width="18" height="14" rx="2" stroke="#0284C7" stroke-width="2" fill="none"/>
          <path d="M3 8h18M7 18v3M17 18v3M5 21h14" stroke="#0284C7" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      }
      @default {
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-svg">
          <circle cx="12" cy="12" r="10" stroke="#64748B" stroke-width="2" fill="#F1F5F9"/>
          <text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#475569">
            {{ platformName.slice(0, 2).toUpperCase() }}
          </text>
        </svg>
      }
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    .icon-svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
  `]
})
export class PlatformIconComponent {
  @Input() platformName: string = '';

  get normalizedName(): string {
    return (this.platformName || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }
}

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiSummary, PLATFORM_COLORS } from '../../models/platform.models';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';

@Component({
  selector: 'app-kpi-summary',
  standalone: true,
  imports: [CommonModule, PlatformIconComponent],
  template: `
    <div class="kpi-grid">
      <!-- KPI 1: Alcance Total Deduplicado -->
      <div class="kpi-card highlight-card">
        <div class="kpi-header">
          <span class="kpi-label">Alcance Cross Deduplicado</span>
          <span class="kpi-badge primary-badge">Sainsbury Model</span>
        </div>
        <div class="kpi-value-container">
          <span class="kpi-value tabular">{{ formatNumber(kpi.totalDeduplicatedReach) }}</span>
          <span class="kpi-unit">personas</span>
        </div>
        <div class="kpi-subtext">
          <span class="kpi-subtext-icon">🎯</span>
          <span><strong>{{ kpi.averageReachPercent }}%</strong> del universo total analizado</span>
        </div>
      </div>

      <!-- KPI 2: Eficiencia de Solapamiento -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Eficiencia de Deduplicación</span>
          <span class="kpi-badge success-badge">{{ kpi.overallEfficiencyPercent }}% Solapamiento</span>
        </div>
        <div class="kpi-value-container">
          <span class="kpi-value tabular">{{ formatNumber(kpi.totalGrossReach - kpi.totalDeduplicatedReach) }}</span>
          <span class="kpi-unit">duplicados prevenidos</span>
        </div>
        <div class="kpi-subtext">
          <span class="kpi-subtext-icon">⚡</span>
          <span>Alcance bruto sin deduplicar: <strong>{{ formatNumber(kpi.totalGrossReach) }}</strong></span>
        </div>
      </div>

      <!-- KPI 3: Plataforma Líder -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Canal con Mayor Impacto</span>
          <span class="kpi-badge neutral-badge">Top Volume</span>
        </div>
        <div class="kpi-channel-container">
          @if (kpi.topPlatformName !== 'N/A') {
            <div class="channel-icon-wrap">
              <app-platform-icon [platformName]="kpi.topPlatformName"></app-platform-icon>
            </div>
            <div class="channel-info">
              <span class="channel-name">{{ kpi.topPlatformName }}</span>
              <span class="channel-reach">{{ formatNumber(kpi.topPlatformReach) }} alc. individual</span>
            </div>
          } @else {
            <span class="kpi-empty">Sin datos</span>
          }
        </div>
        <div class="kpi-subtext">
          <span class="kpi-subtext-icon">📊</span>
          <span>Mayor volumen de cobertura independiente</span>
        </div>
      </div>

      <!-- KPI 4: Cobertura Regional -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Despliegue Territorial</span>
          <span class="kpi-badge info-badge">{{ kpi.activeMarketsCount }} Mercados Agregados</span>
        </div>
        <div class="kpi-value-container">
          <span class="kpi-value">{{ kpi.activeCountriesCount }}</span>
          <span class="kpi-unit">países activos</span>
        </div>
        <div class="kpi-subtext">
          <span class="kpi-subtext-icon">🌎</span>
          <span>Universo base: <strong>{{ formatNumber(kpi.totalUniverse) }}</strong> personas</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);

      &:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      }
    }

    .highlight-card {
      border-color: #c7d2fe;
      background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%);
      }
    }

    .kpi-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      gap: 8px;
    }

    .kpi-label {
      font-size: 12.5px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .kpi-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .primary-badge {
      background: #e0e7ff;
      color: #3730a3;
    }

    .success-badge {
      background: #dcfce7;
      color: #166534;
    }

    .info-badge {
      background: #e0f2fe;
      color: #0369a1;
    }

    .neutral-badge {
      background: #f1f5f9;
      color: #475569;
    }

    .kpi-value-container {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 10px;
    }

    .kpi-value {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }

    .kpi-unit {
      font-size: 12.5px;
      color: #64748b;
      font-weight: 500;
    }

    .kpi-channel-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      min-height: 36px;
    }

    .channel-icon-wrap {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      padding: 4px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .channel-info {
      display: flex;
      flex-direction: column;
    }

    .channel-name {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }

    .channel-reach {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .kpi-empty {
      font-size: 18px;
      font-weight: 600;
      color: #94a3b8;
    }

    .kpi-subtext {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #64748b;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
      line-height: 1.4;

      strong {
        color: #1e293b;
        font-weight: 700;
      }
    }

    .kpi-subtext-icon {
      font-size: 12px;
    }
  `]
})
export class KpiSummaryComponent {
  @Input() kpi: KpiSummary = {
    totalDeduplicatedReach: 0,
    totalGrossReach: 0,
    overallEfficiencyPercent: 0,
    averageReachPercent: 0,
    topPlatformName: 'N/A',
    topPlatformReach: 0,
    activeCountriesCount: 0,
    activeMarketsCount: 0,
    totalUniverse: 0
  };

  platformColors = PLATFORM_COLORS;

  formatNumber(value: number | null | undefined): string {
    if (!value) return '0';
    return value.toLocaleString('es-CO');
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppComponent } from './app';
import { DEFAULT_COUNTRY_UNIVERSES } from './models/platform.models';
import { ReachCurveRecord } from './models/reach-curve.models';
import { ReachCurveService } from './services/reach-curve.service';

function makeRecord(overrides: Partial<ReachCurveRecord> = {}): ReachCurveRecord {
  const periodo = overrides.periodo ?? '2026-01';
  const corte = overrides.corte ?? 'W4';
  const plataforma = overrides.plataforma ?? 'Meta';
  const pais = overrides.pais ?? 'Colombia';
  const campanaNombre = overrides.campana_nombre ?? 'AppTest_CO_Meta_01';
  const inversion = overrides.inversion ?? 4_200_000;
  const alcance = overrides.alcance ?? 500_000;
  const impresiones = overrides.impresiones ?? 1_500_000;

  return {
    record_key:
      overrides.record_key ?? `${periodo}|${corte}|${plataforma}|${pais}|${campanaNombre}`,
    periodo,
    corte,
    plataforma,
    pais,
    stage: overrides.stage ?? 'ATT',
    tipo_compra: overrides.tipo_compra ?? 'CPM',
    formato: overrides.formato ?? 'General',
    moneda: overrides.moneda ?? 'COP',
    campana_nombre: campanaNombre,
    inversion,
    alcance,
    impresiones,
    cpma: overrides.cpma ?? (alcance > 0 ? (inversion / alcance) * 1000 : 0),
    cpm_imp: overrides.cpm_imp ?? (impresiones > 0 ? (inversion / impresiones) * 1000 : 0),
    source_file: overrides.source_file ?? 'seed.xlsx',
  };
}

function mockAppFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('reach_curve_settings')) {
        return new Response(JSON.stringify([{ id: 'global', cop_to_usd: 4200, mxn_to_usd: 20 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let reachCurveService: ReachCurveService;

  beforeEach(async () => {
    localStorage.clear();
    mockAppFetch();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    reachCurveService = TestBed.inject(ReachCurveService);
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('adds and merges projected platforms into tableData, recalculates Casaca/Latam markets, switches to calculator, and shows toast', () => {
    component.setActiveView('curves');
    expect(component.activeView()).toBe('curves');

    // 1. Add Colombia projection (rounds fractional reach, sets official universe)
    component.handleProjectionToMatrix({
      country: 'Colombia',
      platforms: [{ platformId: 'Meta', reach: 5_400_000.4 }],
    });

    expect(component.activeView()).toBe('calculator');
    expect(component.toastMessage()).toBe('Proyección de Colombia enviada a la Matriz Cross Reach');
    expect(component.tableData()).toHaveLength(1);
    expect(component.tableData()[0].country).toBe('Colombia');
    expect(component.tableData()[0].universe).toBe(DEFAULT_COUNTRY_UNIVERSES['Colombia']);
    expect(component.tableData()[0].platforms).toEqual([
      { platformName: 'Meta', reach: 5_400_000 },
    ]);

    // 2. Merge YouTube into existing Colombia row (overrides merge toast with projection toast)
    component.setActiveView('curves');
    component.handleProjectionToMatrix({
      country: 'Colombia',
      platforms: [{ platformId: 'YouTube', reach: 3_600_000 }],
    });

    expect(component.activeView()).toBe('calculator');
    expect(component.toastMessage()).toBe('Proyección de Colombia enviada a la Matriz Cross Reach');
    expect(component.tableData()).toHaveLength(1);
    expect(component.tableData()[0].platforms).toEqual([
      { platformName: 'Meta', reach: 5_400_000 },
      { platformName: 'YouTube', reach: 3_600_000 },
    ]);
    const mergedCrossReach = component.tableData()[0].crossReach ?? 0;
    expect(mergedCrossReach).toBeGreaterThan(5_400_000);
    expect(mergedCrossReach).toBeLessThan(9_000_000);

    // 3. Add Chile -> Casaca market activates (Colombia + Chile)
    component.handleProjectionToMatrix({
      country: 'Chile',
      platforms: [
        { platformId: 'Meta', reach: 2_500_000 },
        { platformId: 'TikTok', reach: 1_500_000 },
      ],
    });

    let displayed = component.displayData();
    const casacaRow = displayed.find((r) => r.isMarket && r.country === 'Casaca');
    expect(casacaRow).toBeDefined();
    expect(casacaRow?.universe).toBe(
      DEFAULT_COUNTRY_UNIVERSES['Colombia'] + DEFAULT_COUNTRY_UNIVERSES['Chile'],
    );
    expect(casacaRow?.crossReach ?? 0).toBeGreaterThan(0);
    expect(displayed.find((r) => r.isMarket && r.country === 'Latam')).toBeUndefined();

    // 4. Add Mexico -> Latam market activates alongside Casaca and KPI summary updates
    component.setActiveView('curves');
    component.handleProjectionToMatrix({
      country: 'Mexico',
      platforms: [
        { platformId: 'Meta', reach: 12_000_000 },
        { platformId: 'Display', reach: 4_000_000 },
      ],
    });

    displayed = component.displayData();
    const latamRow = displayed.find((r) => r.isMarket && r.country === 'Latam');
    expect(latamRow).toBeDefined();
    expect(latamRow?.universe).toBe(
      DEFAULT_COUNTRY_UNIVERSES['Colombia'] +
        DEFAULT_COUNTRY_UNIVERSES['Chile'] +
        DEFAULT_COUNTRY_UNIVERSES['Mexico'],
    );
    expect(component.activeView()).toBe('calculator');
    expect(component.toastMessage()).toBe('Proyección de Mexico enviada a la Matriz Cross Reach');

    const kpi = component.kpiSummary();
    expect(kpi.activeCountriesCount).toBe(3);
    expect(kpi.activeMarketsCount).toBe(2);
    expect(kpi.totalDeduplicatedReach).toBe(latamRow?.crossReach);
  });

  it('ignores projection payloads with zero or non-finite reach values', () => {
    component.setActiveView('curves');

    component.handleProjectionToMatrix({
      country: 'Colombia',
      platforms: [
        { platformId: 'Meta', reach: 0 },
        { platformId: 'TikTok', reach: Number.NaN },
      ],
    });

    expect(component.activeView()).toBe('curves');
    expect(component.tableData()).toHaveLength(0);
    expect(component.toastMessage()).toBeNull();
  });

  it('connects sendProjectionToMatrix from ReachCurvesViewComponent in the template', async () => {
    reachCurveService.records.set([
      makeRecord({
        campana_nombre: 'E2E_CO_Meta_1',
        pais: 'Colombia',
        plataforma: 'Meta',
        corte: 'W4',
        inversion: 4_200_000,
        alcance: 500_000,
      }),
      makeRecord({
        campana_nombre: 'E2E_CO_Meta_2',
        pais: 'Colombia',
        plataforma: 'Meta',
        corte: 'W4',
        inversion: 8_400_000,
        alcance: 850_000,
      }),
    ]);

    const el = fixture.nativeElement as HTMLElement;
    const curvesTab = el.querySelector('#tab-curves') as HTMLButtonElement | null;
    expect(curvesTab).not.toBeNull();
    curvesTab?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.activeView()).toBe('curves');
    const sendBtn = el.querySelector(
      'app-reach-curves-view app-reach-curve-simulator .btn-matrix-action',
    ) as HTMLButtonElement | null;
    expect(sendBtn).not.toBeNull();
    sendBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.activeView()).toBe('calculator');
    expect(component.tableData()).toHaveLength(1);
    expect(el.querySelector('.app-toast-banner')?.textContent).toContain(
      'Proyección de Colombia enviada a la Matriz Cross Reach',
    );
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DEFAULT_COUNTRY_UNIVERSES } from '../../models/platform.models';
import { ReachCurveRecord, SendProjectionToMatrixPayload } from '../../models/reach-curve.models';
import { CrossReachService } from '../../services/cross-reach.service';
import { ReachCurveService } from '../../services/reach-curve.service';
import { ReachCurveSimulatorComponent } from './reach-curve-simulator.component';

function makeRecord(overrides: Partial<ReachCurveRecord> = {}): ReachCurveRecord {
  const periodo = overrides.periodo ?? '2026-01';
  const corte = overrides.corte ?? 'W4';
  const plataforma = overrides.plataforma ?? 'Meta';
  const pais = overrides.pais ?? 'Colombia';
  const campanaNombre = overrides.campana_nombre ?? 'Brand_CO_ATT_CPM_01';
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

function mockDefaultFetch(): void {
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

describe('ReachCurveSimulatorComponent', () => {
  let fixture: ComponentFixture<ReachCurveSimulatorComponent>;
  let component: ReachCurveSimulatorComponent;
  let reachCurveService: ReachCurveService;
  let crossReachService: CrossReachService;

  beforeEach(async () => {
    localStorage.clear();
    mockDefaultFetch();

    await TestBed.configureTestingModule({
      imports: [ReachCurveSimulatorComponent],
    }).compileComponents();

    reachCurveService = TestBed.inject(ReachCurveService);
    crossReachService = TestBed.inject(CrossReachService);
    fixture = TestBed.createComponent(ReachCurveSimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('displays official country universe, auto-picks best available cut, and converts budgets across LOCAL and USD', async () => {
    reachCurveService.records.set([
      makeRecord({
        campana_nombre: 'CO_Meta_W2_1',
        pais: 'Colombia',
        corte: 'W2',
        inversion: 4_200_000,
        alcance: 500_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Meta_W2_2',
        pais: 'Colombia',
        corte: 'W2',
        inversion: 8_400_000,
        alcance: 850_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.selectedCut()).toBe('W2');
    expect(component.countryUniverse()).toBe(DEFAULT_COUNTRY_UNIVERSES['Colombia']);
    expect(el.querySelector('.universe-caption')?.textContent).toContain('27.000.000');

    // Edit budget to 8,400,000 COP and toggle to USD (TRM = 4200 => 2000 USD)
    component.onIndividualBudgetChange(8_400_000);
    component.onMixRowBudgetChange('Meta', 4_200_000);
    fixture.detectChanges();

    component.setCurrencyMode('USD');
    fixture.detectChanges();

    expect(component.activeCurrency()).toBe('USD');
    expect(component.individualBudget()).toBe(2000);
    expect(component.mixRows().find((r) => r.platform === 'Meta')?.budget).toBe(1000);

    // Toggle back to LOCAL => converts USD back to COP
    component.setCurrencyMode('LOCAL');
    fixture.detectChanges();
    expect(component.activeCurrency()).toBe('COP');
    expect(component.individualBudget()).toBe(8_400_000);

    // Switch country to Mexico in LOCAL mode => converts COP (4200) -> MXN (20) and updates universe
    component.setCountry('Mexico');
    fixture.detectChanges();
    expect(component.activeCurrency()).toBe('MXN');
    expect(component.countryUniverse()).toBe(DEFAULT_COUNTRY_UNIVERSES['Mexico']);
    expect(component.individualBudget()).toBe(40_000);
    expect(el.querySelector('.universe-caption')?.textContent).toContain('53.000.000');
  });

  it('computes logarithmic vs linear projections, R² traffic light, 5-row sensitivity table, and copies TSV to clipboard', async () => {
    reachCurveService.records.set([
      makeRecord({
        campana_nombre: 'LogFit_1',
        corte: 'W4',
        inversion: 2_000_000,
        alcance: Math.round(300_000 * Math.log(2_000_000) - 3_500_000),
      }),
      makeRecord({
        campana_nombre: 'LogFit_2',
        corte: 'W4',
        inversion: 5_000_000,
        alcance: Math.round(300_000 * Math.log(5_000_000) - 3_500_000),
      }),
      makeRecord({
        campana_nombre: 'LogFit_3',
        corte: 'W4',
        inversion: 12_000_000,
        alcance: Math.round(300_000 * Math.log(12_000_000) - 3_500_000),
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    component.onIndividualBudgetChange(6_000_000);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const logModel = component.individualModel();
    const logReach = component.projectedReach();

    expect(logModel.modelType).toBe('logarithmic');
    expect(logModel.equationText).toContain('ln(X)');
    expect(logModel.rSquared).toBeGreaterThanOrEqual(0.95);
    expect(component.rSquaredLevel()).toBe('high');
    expect(el.querySelector('.r2-badge.is-high')?.textContent).toContain('Alta confiabilidad');

    // Switch to linear regression and verify model & equation update
    component.setModelType('linear');
    fixture.detectChanges();

    const linearModel = component.individualModel();
    const linearReach = component.projectedReach();
    expect(linearModel.modelType).toBe('linear');
    expect(linearModel.equationText).not.toContain('ln(X)');
    expect(linearReach).not.toBe(logReach);

    // Verify 5-row sensitivity table (-50%, -25%, Base 100%, +25%, +50%)
    const rows = component.sensitivityScenarios();
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.multiplier)).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
    expect(rows[0].diffVsBase).toBeLessThan(0);
    expect(rows[2].isBase).toBe(true);
    expect(rows[2].diffVsBase).toBe(0);
    expect(rows[4].diffVsBase).toBeGreaterThan(0);

    const domRows = el.querySelectorAll('.scenarios-table tbody tr.scenario-row');
    expect(domRows).toHaveLength(5);
    expect(el.querySelector('.scenarios-table tbody tr.is-base-row')?.textContent).toContain(
      'Presupuesto Base (100%)',
    );

    // Mock navigator.clipboard.writeText and test TSV copy
    const writeTextMock = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    const copyBtn = Array.from(el.querySelectorAll('.btn-outline-action')).find((btn) =>
      btn.textContent?.includes('Copiar Tabla (Excel)'),
    ) as HTMLButtonElement | undefined;
    expect(copyBtn).toBeDefined();
    copyBtn?.click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedTsv = String((writeTextMock.mock.calls[0] as unknown[] | undefined)?.[0] ?? '');
    const tsvLines = copiedTsv.split('\n');
    expect(tsvLines).toHaveLength(6);
    expect(tsvLines[0]).toContain('Escenario\tInversion (COP)\tAlcance Proyectado');
    expect(tsvLines[3]).toContain('Presupuesto Base (100%)');
    expect(component.tableCopiedFeedback()).toBe(true);

    // PNG download safely no-ops when canvas is absent in jsdom
    expect(() => component.downloadIndividualChartPng()).not.toThrow();

    // UI privacy and typography check
    expect(el.textContent ?? '').not.toMatch(/supabase|postgresql|uuid/i);
    expect(el.querySelector('.font-mono')).toBeNull();
  });

  it('shows smart empty state chips when no data matches current filters and loads combo on click', async () => {
    reachCurveService.records.set([
      makeRecord({
        campana_nombre: 'TikTok_CON_CPV_1',
        pais: 'Colombia',
        plataforma: 'TikTok',
        stage: 'CON',
        tipo_compra: 'CPV',
        corte: 'W3',
        inversion: 3_000_000,
        alcance: 420_000,
      }),
      makeRecord({
        campana_nombre: 'TikTok_CON_CPV_2',
        pais: 'Colombia',
        plataforma: 'TikTok',
        stage: 'CON',
        tipo_compra: 'CPV',
        corte: 'W3',
        inversion: 6_000_000,
        alcance: 720_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    // Default Meta / ATT / CPM has 0 matching records -> smart empty card with chips
    const el = fixture.nativeElement as HTMLElement;
    expect(component.individualModel().sampleSize).toBe(0);
    expect(el.querySelector('.smart-empty-card')).not.toBeNull();
    const chips = el.querySelectorAll('.combo-chip-btn');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('TikTok · CON · CPV · W3');

    // Click chip to jump directly to available combination
    (chips[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedPlatform()).toBe('TikTok');
    expect(component.selectedStage()).toBe('CON');
    expect(component.selectedBuyType()).toBe('CPV');
    expect(component.selectedCut()).toBe('W3');
    expect(component.individualModel().sampleSize).toBe(2);
    expect(el.querySelector('.smart-empty-card')).toBeNull();

    // Country with zero records displays no-country-data notice
    component.setCountry('Costa Rica');
    fixture.detectChanges();
    expect(el.querySelector('.no-country-data-note')?.textContent).toContain('Costa Rica');
  });

  it('shows optional format selector for YouTube, Display, and DV360, filters model, and resolves target platform on emit', async () => {
    reachCurveService.records.set([
      makeRecord({
        campana_nombre: 'YT_Bumper_1',
        plataforma: 'YouTube',
        formato: 'Bumper Ad',
        corte: 'W4',
        inversion: 4_000_000,
        alcance: 350_000,
      }),
      makeRecord({
        campana_nombre: 'YT_Bumper_2',
        plataforma: 'YouTube',
        formato: 'Bumper Ad',
        corte: 'W4',
        inversion: 8_000_000,
        alcance: 600_000,
      }),
      makeRecord({
        campana_nombre: 'Disp_Banner_1',
        plataforma: 'Display',
        formato: 'Programmatic Display',
        corte: 'W4',
        inversion: 5_000_000,
        alcance: 400_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const emitted: SendProjectionToMatrixPayload[] = [];
    component.sendProjectionToMatrix.subscribe((payload) => emitted.push(payload));

    // Meta hides format selector
    expect(component.showFormatSelector()).toBe(false);
    expect(el.querySelector('#sim-format')).toBeNull();

    // DV360 exposes formats from both YouTube and Display
    component.setPlatform('DV360');
    fixture.detectChanges();
    expect(component.showFormatSelector()).toBe(true);
    expect(el.querySelector('#sim-format')).not.toBeNull();
    expect(component.availableFormats()).toEqual(['Bumper Ad', 'Programmatic Display']);
    expect(component.individualModel().sampleSize).toBe(3);

    // Emit with ALL formats => platformId 'DV360'
    component.emitIndividualToMatrix();
    expect(emitted[0].platforms[0].platformId).toBe('DV360');

    // Filter by 'Bumper Ad' => sampleSize narrows to 2 YouTube records and resolves to 'YouTube'
    component.setFormat('Bumper Ad');
    fixture.detectChanges();
    expect(component.individualModel().sampleSize).toBe(2);
    expect(component.resolvedIndividualTargetPlatform()).toBe('YouTube');

    component.emitIndividualToMatrix();
    expect(emitted[1]).toEqual({
      country: 'Colombia',
      platforms: [{ platformId: 'YouTube', reach: component.projectedReach() }],
    });
  });

  it('calculates Mix Cross-Channel deduplicated reach via CrossReachService and emits full mix to matrix', async () => {
    const crossReachSpy = vi.spyOn(crossReachService, 'calculateCrossReach');
    const emitted: SendProjectionToMatrixPayload[] = [];
    component.sendProjectionToMatrix.subscribe((payload) => emitted.push(payload));

    reachCurveService.records.set([
      makeRecord({
        campana_nombre: 'Mix_Meta_1',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 4_000_000,
        alcance: 1_200_000,
      }),
      makeRecord({
        campana_nombre: 'Mix_Meta_2',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 8_000_000,
        alcance: 2_000_000,
      }),
      makeRecord({
        campana_nombre: 'Mix_YT_1',
        plataforma: 'YouTube',
        tipo_compra: 'CPV',
        corte: 'W4',
        inversion: 4_000_000,
        alcance: 900_000,
      }),
      makeRecord({
        campana_nombre: 'Mix_YT_2',
        plataforma: 'YouTube',
        tipo_compra: 'CPV',
        corte: 'W4',
        inversion: 8_000_000,
        alcance: 1_600_000,
      }),
      makeRecord({
        campana_nombre: 'Mix_TikTok_1',
        plataforma: 'TikTok',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 4_000_000,
        alcance: 800_000,
      }),
      makeRecord({
        campana_nombre: 'Mix_TikTok_2',
        plataforma: 'TikTok',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 8_000_000,
        alcance: 1_400_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    component.setSubMode('mix');
    component.setMixRowBuyType('YouTube', 'CPV');
    component.onMixRowBudgetChange('Meta', 6_000_000);
    component.onMixRowBudgetChange('YouTube', 6_000_000);
    component.onMixRowBudgetChange('TikTok', 5_000_000);
    component.toggleMixRowEnabled('Display', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.mix-channel-row')).toHaveLength(4);
    expect(crossReachSpy).toHaveBeenCalled();

    const summary = component.mixSummary();
    expect(summary.activeModeledCount).toBe(3);
    expect(summary.totalInvestment).toBe(17_000_000);
    expect(summary.grossReach).toBeGreaterThan(summary.netCrossReach);
    expect(summary.duplicatesPrevented).toBe(summary.grossReach - summary.netCrossReach);
    expect(summary.netCrossReach).toBeGreaterThan(0);
    expect(summary.netCpma).toBeGreaterThan(0);

    // Click "Enviar Mix Completo a Matriz Cross Reach"
    const sendMixBtn = el.querySelector(
      '.mix-summary-card .btn-matrix-action',
    ) as HTMLButtonElement | null;
    expect(sendMixBtn).not.toBeNull();
    sendMixBtn?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].country).toBe('Colombia');
    expect(emitted[0].platforms.map((p) => p.platformId)).toEqual(['Meta', 'TikTok', 'YouTube']);
    expect(emitted[0].platforms.every((p) => p.reach > 0)).toBe(true);
  });
});

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

    // Cockpit 2x2 mini-KPI cards and full-width bottom sensitivity table exist
    expect(el.querySelector('.cockpit-topbar')).not.toBeNull();
    expect(el.querySelector('.cockpit-main-grid')).not.toBeNull();
    expect(el.querySelectorAll('.mini-kpi-grid .mini-kpi-card')).toHaveLength(4);
    expect(el.querySelector('.penetration-fill')).not.toBeNull();

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
    expect(el.textContent ?? '').not.toMatch(/supabase|postgresql|postgres|uuid/i);
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
    expect(el.querySelectorAll('.mix-strip-kpi')).toHaveLength(4);
    expect(crossReachSpy).toHaveBeenCalled();

    const summary = component.mixSummary();
    expect(summary.activeModeledCount).toBe(3);
    expect(summary.totalInvestment).toBe(17_000_000);
    expect(summary.grossReach).toBeGreaterThan(summary.netCrossReach);
    expect(summary.duplicatesPrevented).toBe(summary.grossReach - summary.netCrossReach);
    expect(summary.netCrossReach).toBeGreaterThan(0);
    expect(summary.netCpma).toBeGreaterThan(0);

    // Click "Enviar Mix a Matriz Cross Reach"
    const sendMixBtn = el.querySelector(
      '.mix-summary-card .btn-matrix-action',
    ) as HTMLButtonElement | null;
    expect(sendMixBtn).not.toBeNull();
    expect(sendMixBtn?.textContent).toContain('Enviar Mix a Matriz Cross Reach');
    sendMixBtn?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].country).toBe('Colombia');
    expect(emitted[0].platforms.map((p) => p.platformId)).toEqual(['Meta', 'TikTok', 'YouTube']);
    expect(emitted[0].platforms.every((p) => p.reach > 0)).toBe(true);
  });

  it('filters Individual model, buyTypeAvailability, availableCombinations, auto-cut, DV360 target platform, and median budget seed by selectedPeriod (ALL, YEAR:YYYY, YYYY-MM)', async () => {
    reachCurveService.records.set([
      makeRecord({
        campana_nombre: 'CO_Meta_2025_1',
        periodo: '2025-11',
        corte: 'W4',
        plataforma: 'Meta',
        stage: 'ATT',
        tipo_compra: 'CPM',
        inversion: 2_000_000,
        alcance: 320_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Meta_2025_2',
        periodo: '2025-11',
        corte: 'W4',
        plataforma: 'Meta',
        stage: 'ATT',
        tipo_compra: 'CPM',
        inversion: 3_000_000,
        alcance: 430_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Meta_CPE_2025',
        periodo: '2025-10',
        corte: 'W2',
        plataforma: 'Meta',
        stage: 'ATT',
        tipo_compra: 'CPE',
        inversion: 1_500_000,
        alcance: 180_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Meta_2026_1',
        periodo: '2026-01',
        corte: 'W4',
        plataforma: 'Meta',
        stage: 'ATT',
        tipo_compra: 'CPM',
        inversion: 8_000_000,
        alcance: 950_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Meta_2026_2',
        periodo: '2026-01',
        corte: 'W4',
        plataforma: 'Meta',
        stage: 'ATT',
        tipo_compra: 'CPM',
        inversion: 12_000_000,
        alcance: 1_300_000,
      }),
      makeRecord({
        campana_nombre: 'CO_TT_2026_1',
        periodo: '2026-02',
        corte: 'W4',
        plataforma: 'TikTok',
        stage: 'CON',
        tipo_compra: 'CPV',
        inversion: 5_000_000,
        alcance: 600_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Disp_OLV_2025',
        periodo: '2025-11',
        corte: 'W4',
        plataforma: 'Display',
        formato: 'Online Video',
        stage: 'ATT',
        tipo_compra: 'CPM',
        inversion: 4_000_000,
        alcance: 420_000,
      }),
      makeRecord({
        campana_nombre: 'CO_YT_OLV_2026',
        periodo: '2026-01',
        corte: 'W4',
        plataforma: 'YouTube',
        formato: 'Online Video',
        stage: 'ATT',
        tipo_compra: 'CPM',
        inversion: 6_000_000,
        alcance: 620_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const periodSelect = el.querySelector('#sim-period') as HTMLSelectElement | null;
    expect(periodSelect).not.toBeNull();
    expect(component.selectedPeriod()).toBe('ALL');

    const options = component.availablePeriodOptions();
    expect(options.map((o) => o.value)).toEqual([
      'ALL',
      'YEAR:2026',
      'YEAR:2025',
      '2026-02',
      '2026-01',
      '2025-11',
      '2025-10',
    ]);
    expect(options[0].label).toBe('Todo el histórico (4 meses)');
    expect(Array.from(periodSelect!.options).map((opt) => opt.textContent?.trim())).toEqual([
      'Todo el histórico (4 meses)',
      'Año 2026',
      'Año 2025',
      'Febrero 2026',
      'Enero 2026',
      'Noviembre 2025',
      'Octubre 2025',
    ]);
    expect(el.querySelector('.chart-title')?.textContent).toContain('Todo el histórico (4 meses)');

    // In ALL, Meta ATT CPM W4 combines 2025-11 (2) + 2026-01 (2) = 4 records
    expect(component.individualModel().sampleSize).toBe(4);
    expect(component.selectedCut()).toBe('W4');
    expect(component.individualBudget()).toBe(8_000_000); // median of [2M, 3M, 8M, 12M] sorted -> index 2 = 8M

    // Filter by YEAR:2026 via #sim-period select -> narrows Meta ATT CPM W4 to 2 records (2026-01) and updates median budget seed
    periodSelect!.value = 'YEAR:2026';
    periodSelect!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedPeriod()).toBe('YEAR:2026');

    expect(component.individualModel().sampleSize).toBe(2);
    expect(component.individualBudget()).toBe(12_000_000); // median of [8M, 12M] -> index 1 = 12M
    expect(component.buyTypeAvailability().find((b) => b.buyType === 'CPM')?.count).toBe(2);
    expect(component.availableCombinations().every((c) => c.plataforma !== 'Display')).toBe(true);

    // Filter by 2025-10 -> only W2 CPE record exists -> auto-cut switches to W2 & CPE availability updates
    component.setPeriod('2025-10');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedCut()).toBe('W2');
    expect(component.buyTypeAvailability().find((b) => b.buyType === 'CPE')?.count).toBe(1);
    expect(component.buyTypeAvailability().find((b) => b.buyType === 'CPM')?.count).toBe(0);

    // Filter by 2026-02 -> auto-cut picks W4, Meta ATT CPM W4 has 0 records, smart empty card only suggests TikTok CON CPV W4
    component.setPeriod('2026-02');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedCut()).toBe('W4');
    expect(component.individualModel().sampleSize).toBe(0);
    const chips = el.querySelectorAll('.combo-chip-btn');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('TikTok · CON · CPV · W4');

    // DV360 with Online Video format resolves to 'DV360' across ALL, but narrows to 'YouTube' in '2026-01'
    component.setPeriod('ALL');
    component.setPlatform('DV360');
    component.setFormat('Online Video');
    fixture.detectChanges();
    expect(component.individualModel().sampleSize).toBe(2);
    expect(component.resolvedIndividualTargetPlatform()).toBe('DV360');

    component.setPeriod('2026-01');
    fixture.detectChanges();
    expect(component.individualModel().sampleSize).toBe(1);
    expect(component.resolvedIndividualTargetPlatform()).toBe('YouTube');
  });

  it('filters Mix Cross-Channel evaluations by selectedPeriod and resets period to ALL on country switch when unavailable', async () => {
    reachCurveService.records.set([
      // Colombia 2025-12: Meta CPM + Display CPM
      makeRecord({
        campana_nombre: 'CO_Mix_Meta_Dec_1',
        pais: 'Colombia',
        periodo: '2025-12',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 3_000_000,
        alcance: 900_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Mix_Meta_Dec_2',
        pais: 'Colombia',
        periodo: '2025-12',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 6_000_000,
        alcance: 1_500_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Mix_Disp_Dec_1',
        pais: 'Colombia',
        periodo: '2025-12',
        plataforma: 'Display',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 3_000_000,
        alcance: 500_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Mix_Disp_Dec_2',
        pais: 'Colombia',
        periodo: '2025-12',
        plataforma: 'Display',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 6_000_000,
        alcance: 850_000,
      }),
      // Colombia 2026-02: Meta CPM + YouTube CPV
      makeRecord({
        campana_nombre: 'CO_Mix_Meta_Feb_1',
        pais: 'Colombia',
        periodo: '2026-02',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 4_000_000,
        alcance: 1_100_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Mix_Meta_Feb_2',
        pais: 'Colombia',
        periodo: '2026-02',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 8_000_000,
        alcance: 1_900_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Mix_YT_Feb_1',
        pais: 'Colombia',
        periodo: '2026-02',
        plataforma: 'YouTube',
        tipo_compra: 'CPV',
        corte: 'W4',
        inversion: 4_000_000,
        alcance: 800_000,
      }),
      makeRecord({
        campana_nombre: 'CO_Mix_YT_Feb_2',
        pais: 'Colombia',
        periodo: '2026-02',
        plataforma: 'YouTube',
        tipo_compra: 'CPV',
        corte: 'W4',
        inversion: 8_000_000,
        alcance: 1_400_000,
      }),
      // Mexico only has 2026-02 (no 2025-12!)
      makeRecord({
        campana_nombre: 'MX_Mix_Meta_Feb_1',
        pais: 'Mexico',
        periodo: '2026-02',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        moneda: 'MXN',
        inversion: 40_000,
        alcance: 1_000_000,
      }),
      makeRecord({
        campana_nombre: 'MX_Mix_Meta_Feb_2',
        pais: 'Mexico',
        periodo: '2026-02',
        plataforma: 'Meta',
        tipo_compra: 'CPM',
        corte: 'W4',
        moneda: 'MXN',
        inversion: 80_000,
        alcance: 1_700_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    component.setSubMode('mix');
    component.setMixRowBuyType('YouTube', 'CPV');
    fixture.detectChanges();

    // ALL => Meta (4), YouTube (2), Display (2) modeled
    let evals = component.mixEvaluations();
    expect(evals.find((e) => e.platform === 'Meta')?.model.sampleSize).toBe(4);
    expect(evals.find((e) => e.platform === 'YouTube')?.availableBuyTypes).toEqual(['CPV']);
    expect(evals.find((e) => e.platform === 'Display')?.availableBuyTypes).toEqual(['CPM']);
    expect(component.mixSummary().activeModeledCount).toBe(3);

    // Filter Mix by YEAR:2026 => Meta (2), YouTube (2), Display has no data
    component.setPeriod('YEAR:2026');
    fixture.detectChanges();
    evals = component.mixEvaluations();
    expect(evals.find((e) => e.platform === 'Meta')?.model.sampleSize).toBe(2);
    expect(evals.find((e) => e.platform === 'YouTube')?.hasData).toBe(true);
    expect(evals.find((e) => e.platform === 'Display')?.hasData).toBe(false);
    expect(evals.find((e) => e.platform === 'Display')?.availableBuyTypes).toEqual([]);
    expect(component.mixSummary().activeModeledCount).toBe(2);

    // Filter Mix by 2026-02, then switch to Mexico (which HAS 2026-02) => period is preserved
    component.setPeriod('2026-02');
    fixture.detectChanges();
    component.setCountry('Mexico');
    fixture.detectChanges();
    expect(component.selectedPeriod()).toBe('2026-02');

    // Switch back to Colombia, pick 2025-12 (Display has data, YouTube does not)
    component.setCountry('Colombia');
    component.setPeriod('2025-12');
    fixture.detectChanges();
    evals = component.mixEvaluations();
    expect(evals.find((e) => e.platform === 'Display')?.hasData).toBe(true);
    expect(evals.find((e) => e.platform === 'YouTube')?.hasData).toBe(false);

    // Switch to Mexico where '2025-12' is missing => selectedPeriod resets to 'ALL'
    component.setCountry('Mexico');
    fixture.detectChanges();
    expect(component.selectedPeriod()).toBe('ALL');
    expect(component.availablePeriodOptions()[0].label).toBe('Todo el histórico (1 mes)');
  });
});

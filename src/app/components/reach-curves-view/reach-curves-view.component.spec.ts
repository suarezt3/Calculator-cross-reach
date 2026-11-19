import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ReachCurveRecord, SendProjectionToMatrixPayload } from '../../models/reach-curve.models';
import { ReachCurveService } from '../../services/reach-curve.service';
import { ReachCurvesViewComponent } from './reach-curves-view.component';

function makeRecord(overrides: Partial<ReachCurveRecord> = {}): ReachCurveRecord {
  const periodo = overrides.periodo ?? '2026-01';
  const corte = overrides.corte ?? 'W1';
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
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        return new Response(null, { status: 201 });
      }
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

describe('ReachCurvesViewComponent', () => {
  let fixture: ComponentFixture<ReachCurvesViewComponent>;
  let component: ReachCurvesViewComponent;
  let service: ReachCurveService;

  beforeEach(async () => {
    localStorage.clear();
    mockDefaultFetch();

    await TestBed.configureTestingModule({
      imports: [ReachCurvesViewComponent],
    }).compileComponents();

    service = TestBed.inject(ReachCurveService);
    fixture = TestBed.createComponent(ReachCurvesViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders empty state initially and opens import modal when clicking Importar Reportes Excel', async () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(service.records()).toHaveLength(0);
    expect(el.querySelector('.empty-title')?.textContent).toContain(
      'No hay campañas históricas cargadas todavía',
    );
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    const importBtns = Array.from(
      el.querySelectorAll('.btn-primary-action'),
    ) as HTMLButtonElement[];
    expect(importBtns.length).toBeGreaterThanOrEqual(1);
    importBtns[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.showImportModal()).toBe(true);
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();

    component.closeImportModal();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders loading skeleton when isLoading is true and records are empty', async () => {
    service.isLoading.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.loading-skeleton')).not.toBeNull();

    service.isLoading.set(false);
    fixture.detectChanges();
  });

  it('validates and updates TRM exchange rates and emits notification', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const notifications: string[] = [];
    component.notify.subscribe((msg) => notifications.push(msg));
    const updateSpy = vi.spyOn(service, 'updateExchangeRates');

    // Invalid rate <= 0 shows error and skips update
    component.onCopRateChange(0);
    await component.saveExchangeRates();
    fixture.detectChanges();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(component.rateError()).toContain('mayores a 0');
    expect(el.querySelector('.trm-feedback.error')).not.toBeNull();

    // Valid rates save and sync
    component.onCopRateChange(4000);
    component.onMxnRateChange(18);
    await component.saveExchangeRates();
    fixture.detectChanges();

    expect(updateSpy).toHaveBeenCalledWith({
      id: 'global',
      cop_to_usd: 4000,
      mxn_to_usd: 18,
    });
    expect(service.exchangeRates().cop_to_usd).toBe(4000);
    expect(service.exchangeRates().mxn_to_usd).toBe(18);
    expect(component.rateSavedBanner()).toBe(true);
    expect(el.querySelector('.trm-feedback.success')).not.toBeNull();
    expect(notifications[0]).toContain('Tasas de cambio guardadas');
  });

  it('computes reactive KPIs, applies multi-filter combinations, and handles filtered-empty state', async () => {
    service.records.set([
      makeRecord({
        campana_nombre: 'C_CO_Meta',
        pais: 'Colombia',
        plataforma: 'Meta',
        periodo: '2026-01',
        corte: 'W1',
        stage: 'ATT',
        tipo_compra: 'CPM',
        moneda: 'COP',
      }),
      makeRecord({
        campana_nombre: 'C_MX_TikTok',
        pais: 'Mexico',
        plataforma: 'TikTok',
        periodo: '2026-02',
        corte: 'W2',
        stage: 'CON',
        tipo_compra: 'CPV',
        moneda: 'MXN',
      }),
      makeRecord({
        campana_nombre: 'C_CL_YT',
        pais: 'Chile',
        plataforma: 'YouTube',
        periodo: '2026-03',
        corte: 'W3',
        stage: 'PUR',
        tipo_compra: 'CPA',
        moneda: 'COP',
      }),
      makeRecord({
        campana_nombre: 'C_PE_Display',
        pais: 'Peru',
        plataforma: 'Display',
        periodo: '2026-03',
        corte: 'W4',
        stage: 'LOY',
        tipo_compra: 'CPC',
        moneda: 'COP',
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.activeTab()).toBe('simulator');
    const auditTabBtn = el.querySelector('#curves-tab-audit') as HTMLButtonElement | null;
    expect(auditTabBtn).not.toBeNull();
    auditTabBtn?.click();
    fixture.detectChanges();
    expect(component.activeTab()).toBe('audit');

    expect(component.totalRecordsCount()).toBe(4);
    expect(component.periodsCount()).toBe(3);
    expect(component.periodRangeLabel()).toBe('2026-01 → 2026-03');
    expect(component.platformBreakdown()).toEqual([
      { platform: 'Meta', count: 1 },
      { platform: 'TikTok', count: 1 },
      { platform: 'YouTube', count: 1 },
      { platform: 'Display', count: 1 },
    ]);
    expect(component.countryBreakdown()).toEqual([
      { country: 'Colombia', count: 1 },
      { country: 'Mexico', count: 1 },
      { country: 'Chile', count: 1 },
      { country: 'Peru', count: 1 },
      { country: 'Costa Rica', count: 0 },
    ]);

    // Multi-filter match
    component.setCountryFilter('Mexico');
    component.setPlatformFilter('TikTok');
    component.setPeriodFilter('2026-02');
    component.setCutFilter('W2');
    component.setStageFilter('CON');
    component.setBuyTypeFilter('CPV');
    fixture.detectChanges();

    expect(component.filteredRecords()).toHaveLength(1);
    expect(component.filteredRecords()[0].campana_nombre).toBe('C_MX_TikTok');

    // Non-matching filter triggers filtered empty state
    component.setStageFilter('PUR');
    fixture.detectChanges();

    expect(component.filteredRecords()).toHaveLength(0);
    expect(el.querySelector('.empty-state-box.is-filtered')).not.toBeNull();

    // Clear filters restores all 4 rows
    component.clearFilters();
    fixture.detectChanges();
    expect(component.filteredRecords()).toHaveLength(4);
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('converts investment across LOCAL, COP, MXN, USD and recalculates CPMa and Frequency live', async () => {
    // 4,200,000 COP with default TRM (cop_to_usd=4200, mxn_to_usd=20) => 1000 USD / 20,000 MXN
    // Reach 500,000, Impressions 1,250,000 => Frequency 2.50, CPMa in USD = (1000 / 500,000)*1000 = 2.00
    service.records.set([
      makeRecord({
        campana_nombre: 'Conv_CO_COP',
        pais: 'Colombia',
        moneda: 'COP',
        inversion: 4_200_000,
        alcance: 500_000,
        impresiones: 1_250_000,
      }),
      makeRecord({
        campana_nombre: 'Conv_MX_MXN',
        pais: 'Mexico',
        moneda: 'MXN',
        inversion: 20_000,
        alcance: 400_000,
        impresiones: 1_000_000,
      }),
    ]);
    fixture.detectChanges();

    // LOCAL mode keeps original currency per row
    let rows = component.paginatedRows();
    expect(rows[0].currencyCode).toBe('COP');
    expect(rows[0].displayInvestment).toBe(4_200_000);
    expect(rows[0].frequency).toBe('2.50');
    expect(rows[0].displayCpma).toBeCloseTo(8400, 4);
    expect(rows[1].currencyCode).toBe('MXN');
    expect(rows[1].displayInvestment).toBe(20_000);

    // USD conversion
    component.setDisplayCurrency('USD');
    fixture.detectChanges();
    rows = component.paginatedRows();
    expect(rows[0].currencyCode).toBe('USD');
    expect(rows[0].displayInvestment).toBeCloseTo(1000, 6);
    expect(rows[0].displayCpma).toBeCloseTo(2, 6);
    expect(rows[1].currencyCode).toBe('USD');
    expect(rows[1].displayInvestment).toBeCloseTo(1000, 6);
    expect(rows[1].displayCpma).toBeCloseTo(2.5, 6);

    // MXN conversion
    component.setDisplayCurrency('MXN');
    fixture.detectChanges();
    rows = component.paginatedRows();
    expect(rows[0].displayInvestment).toBeCloseTo(20_000, 6);
    expect(rows[0].displayCpma).toBeCloseTo(40, 6);

    // COP conversion
    component.setDisplayCurrency('COP');
    fixture.detectChanges();
    rows = component.paginatedRows();
    expect(rows[1].displayInvestment).toBeCloseTo(4_200_000, 6);

    // Live recalculation when TRM updates
    component.setDisplayCurrency('USD');
    component.onCopRateChange(2100);
    component.onMxnRateChange(20);
    await component.saveExchangeRates();
    fixture.detectChanges();

    rows = component.paginatedRows();
    expect(rows[0].displayInvestment).toBeCloseTo(2000, 6);
    expect(rows[0].displayCpma).toBeCloseTo(4, 6);
  });

  it('paginates records in 25-row pages and resets page to 1 when filters change', async () => {
    const records: ReachCurveRecord[] = Array.from({ length: 30 }, (_, index) =>
      makeRecord({
        campana_nombre: `Camp_${String(index + 1).padStart(2, '0')}`,
        pais: index < 28 ? 'Colombia' : 'Mexico',
      }),
    );
    service.records.set(records);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('#curves-tab-audit') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();

    expect(component.totalPages()).toBe(2);
    expect(component.paginatedRows()).toHaveLength(25);
    expect(component.pageStartIndex()).toBe(1);
    expect(component.pageEndIndex()).toBe(25);
    expect(el.querySelectorAll('.audit-row')).toHaveLength(25);
    expect(el.querySelectorAll('.audit-table thead th')).toHaveLength(12);

    // Navigate to page 2
    component.goToNextPage();
    fixture.detectChanges();
    expect(component.safeCurrentPage()).toBe(2);
    expect(component.paginatedRows()).toHaveLength(5);
    expect(component.pageStartIndex()).toBe(26);
    expect(component.pageEndIndex()).toBe(30);
    expect(el.querySelectorAll('.audit-row')).toHaveLength(5);

    // Changing any filter resets currentPage to 1
    component.setCountryFilter('Colombia');
    fixture.detectChanges();
    expect(component.currentPage()).toBe(1);
    expect(component.safeCurrentPage()).toBe(1);

    // Refresh data calls both service loaders and avoids leaking technical provider terms
    const loadRecordsSpy = vi.spyOn(service, 'loadRecords');
    const loadRatesSpy = vi.spyOn(service, 'loadExchangeRates');
    await component.refreshData();
    fixture.detectChanges();

    expect(loadRecordsSpy).toHaveBeenCalledTimes(1);
    expect(loadRatesSpy).toHaveBeenCalledTimes(1);
    expect(el.textContent ?? '').not.toMatch(/supabase|postgresql|uuid/i);
    expect(el.querySelector('.font-mono')).toBeNull();
  });

  it('defaults to Simulador de Curvas when records exist, removes provisional banner, and respects manual tab switching', async () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.phase3-banner')).toBeNull();
    expect(component.activeTab()).toBe('audit');
    expect(el.querySelector('app-reach-curve-simulator')).toBeNull();

    service.records.set([
      makeRecord({
        campana_nombre: 'Sim_Default_01',
        corte: 'W4',
        inversion: 5_000_000,
        alcance: 600_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.activeTab()).toBe('simulator');
    expect(el.querySelector('app-reach-curve-simulator')).not.toBeNull();
    expect(el.querySelector('.audit-card')).toBeNull();

    // Switch manually to audit tab and ensure adding another record does not override manual selection
    (el.querySelector('#curves-tab-audit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.activeTab()).toBe('audit');
    expect(el.querySelector('.audit-card')).not.toBeNull();

    service.records.set([
      ...service.records(),
      makeRecord({
        campana_nombre: 'Sim_Default_02',
        corte: 'W4',
        inversion: 7_000_000,
        alcance: 750_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.activeTab()).toBe('audit');

    // Switch back to simulator tab via UI click
    (el.querySelector('#curves-tab-simulator') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.activeTab()).toBe('simulator');
    expect(el.querySelector('app-reach-curve-simulator')).not.toBeNull();
  });

  it('propagates sendProjectionToMatrix payload emitted by ReachCurveSimulatorComponent', async () => {
    const emitted: SendProjectionToMatrixPayload[] = [];
    component.sendProjectionToMatrix.subscribe((payload) => emitted.push(payload));

    service.records.set([
      makeRecord({
        campana_nombre: 'Prop_CO_01',
        pais: 'Colombia',
        plataforma: 'Meta',
        stage: 'ATT',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 4_200_000,
        alcance: 500_000,
      }),
      makeRecord({
        campana_nombre: 'Prop_CO_02',
        pais: 'Colombia',
        plataforma: 'Meta',
        stage: 'ATT',
        tipo_compra: 'CPM',
        corte: 'W4',
        inversion: 8_400_000,
        alcance: 850_000,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.activeTab()).toBe('simulator');

    const sendBtn = el.querySelector(
      'app-reach-curve-simulator .btn-matrix-action',
    ) as HTMLButtonElement | null;
    expect(sendBtn).not.toBeNull();
    sendBtn?.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].country).toBe('Colombia');
    expect(emitted[0].platforms).toHaveLength(1);
    expect(emitted[0].platforms[0].platformId).toBe('Meta');
    expect(emitted[0].platforms[0].reach).toBeGreaterThan(0);
  });

  it('renders empty data freshness capsule when no historical records exist', async () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(service.records()).toHaveLength(0);
    expect(service.dataFreshness().hasData).toBe(false);

    const emptyCapsule = el.querySelector('.freshness-capsule.is-empty');
    expect(emptyCapsule).not.toBeNull();
    expect(emptyCapsule?.querySelector('.freshness-dot.is-gray')).not.toBeNull();
    expect(emptyCapsule?.textContent).toContain('Sin datos históricos cargados aún');
    expect(el.querySelector('.freshness-capsule.is-interactive')).toBeNull();
    expect(el.querySelector('#curves-freshness-popover')).toBeNull();
  });

  it('renders populated freshness capsule, platform breakdown popover with outdated flag, and closes on toggle/Escape/outside click', async () => {
    const olderTs = '2026-01-10T10:00:00.000Z';
    const latestTs = '2026-03-20T18:45:00.000Z';

    service.records.set([
      makeRecord({
        campana_nombre: 'Fresh_Meta_Mar',
        plataforma: 'Meta',
        periodo: '2026-03',
        updated_at: latestTs,
      }),
      makeRecord({
        campana_nombre: 'Fresh_TT_Jan',
        plataforma: 'TikTok',
        periodo: '2026-01',
        updated_at: olderTs,
      }),
      makeRecord({
        campana_nombre: 'Fresh_YT_Mar',
        plataforma: 'YouTube',
        periodo: '2026-03',
        updated_at: olderTs,
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const freshness = service.dataFreshness();
    expect(freshness.latestPeriodRaw).toBe('2026-03');
    expect(freshness.latestPeriodLabel).toBe('Marzo 2026');

    const capsuleBtn = el.querySelector(
      '.freshness-capsule.is-interactive',
    ) as HTMLButtonElement | null;
    expect(capsuleBtn).not.toBeNull();
    expect(capsuleBtn?.querySelector('.freshness-dot.is-green')).not.toBeNull();
    expect(capsuleBtn?.textContent).toContain('Último mes con data:');
    expect(capsuleBtn?.textContent).toContain('Marzo 2026');
    expect(capsuleBtn?.textContent).toContain('Actualizado:');
    expect(capsuleBtn?.textContent).toContain(freshness.lastUpdatedLabel);
    expect(capsuleBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#curves-freshness-popover')).toBeNull();

    // Open popover by clicking capsule
    capsuleBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.showFreshnessPopover()).toBe(true);
    expect(capsuleBtn?.getAttribute('aria-expanded')).toBe('true');

    const popover = el.querySelector('#curves-freshness-popover');
    expect(popover).not.toBeNull();

    const rows = Array.from(popover!.querySelectorAll('.freshness-platform-row'));
    expect(rows).toHaveLength(4);

    // Meta (up-to-date, Marzo 2026, 1 campaña)
    expect(rows[0].textContent).toContain('Meta');
    expect(rows[0].textContent).toContain('Marzo 2026');
    expect(rows[0].textContent).toContain('1 campaña');
    expect(rows[0].classList.contains('is-outdated')).toBe(false);

    // TikTok (lagging Enero 2026 -> outdated warning)
    expect(rows[1].textContent).toContain('TikTok');
    expect(rows[1].textContent).toContain('Enero 2026');
    expect(rows[1].textContent).toContain('Desactualizada');
    expect(rows[1].classList.contains('is-outdated')).toBe(true);

    // YouTube (up-to-date Marzo 2026)
    expect(rows[2].textContent).toContain('YouTube');
    expect(rows[2].textContent).toContain('Marzo 2026');
    expect(rows[2].classList.contains('is-outdated')).toBe(false);

    // Display (no records -> Sin datos, 0 campañas, missing state)
    expect(rows[3].textContent).toContain('Display');
    expect(rows[3].textContent).toContain('Sin datos');
    expect(rows[3].textContent).toContain('0 campañas');
    expect(rows[3].classList.contains('is-missing')).toBe(true);
    expect(rows[3].classList.contains('is-outdated')).toBe(false);

    expect(popover?.querySelector('.freshness-popover-note')?.textContent).toContain(
      'Plataforma con histórico anterior al mes más reciente.',
    );

    // Second click closes popover
    capsuleBtn!.click();
    fixture.detectChanges();
    expect(component.showFreshnessPopover()).toBe(false);
    expect(el.querySelector('#curves-freshness-popover')).toBeNull();

    // Hover opens popover and Escape closes it
    const wrap = el.querySelector('.freshness-capsule-wrap') as HTMLElement;
    wrap.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(component.showFreshnessPopover()).toBe(true);
    expect(el.querySelector('#curves-freshness-popover')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.showFreshnessPopover()).toBe(false);
    expect(el.querySelector('#curves-freshness-popover')).toBeNull();

    // Outside click closes click-opened popover
    capsuleBtn!.click();
    fixture.detectChanges();
    expect(component.showFreshnessPopover()).toBe(true);

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(component.showFreshnessPopover()).toBe(false);
    expect(el.querySelector('#curves-freshness-popover')).toBeNull();

    // Missing updated_at fallback inside capsule
    service.records.set([
      makeRecord({
        campana_nombre: 'No_Date_Meta',
        plataforma: 'Meta',
        periodo: '2026-01',
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.freshness-capsule.is-interactive')?.textContent).toContain(
      'Enero 2026',
    );
    expect(el.querySelector('.freshness-capsule.is-interactive')?.textContent).toContain(
      'Sin fecha registrada',
    );
  });

  it('opens and closes ReachCurvesDocModalComponent via Guía y Fórmulas button without leaking infrastructure terms', async () => {
    const el = fixture.nativeElement as HTMLElement;

    // Seed record so freshness popover can also be verified to close when opening doc modal
    service.records.set([
      makeRecord({
        campana_nombre: 'Doc_Trigger_01',
        periodo: '2026-02',
        updated_at: '2026-02-15T12:00:00.000Z',
      }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const freshnessBtn = el.querySelector('.freshness-capsule.is-interactive') as HTMLButtonElement;
    freshnessBtn.click();
    fixture.detectChanges();
    expect(component.showFreshnessPopover()).toBe(true);

    const docBtn = el.querySelector('.btn-doc-action') as HTMLButtonElement | null;
    expect(docBtn).not.toBeNull();
    expect(docBtn?.textContent).toContain('Guía y Fórmulas');
    expect(el.querySelector('app-reach-curves-doc-modal [role="dialog"]')).toBeNull();

    // Click "Guía y Fórmulas" -> opens doc modal & closes freshness popover
    docBtn!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCurvesDocOpen()).toBe(true);
    expect(component.showFreshnessPopover()).toBe(false);

    const docDialog = el.querySelector('app-reach-curves-doc-modal [role="dialog"]');
    expect(docDialog).not.toBeNull();
    expect(docDialog?.textContent).toContain('Guía Metodológica y Fórmulas de Curvas de Alcance');

    // Privacy & typography check across view + doc modal
    expect(el.textContent ?? '').not.toMatch(/supabase|postgresql|postgres|uuid/i);
    expect(el.querySelector('.font-mono')).toBeNull();

    // Close via modal button
    const closeBtn = docDialog!.querySelector('.btn-primary-close') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCurvesDocOpen()).toBe(false);
    expect(el.querySelector('app-reach-curves-doc-modal [role="dialog"]')).toBeNull();

    // Reopen and close via Escape
    docBtn!.click();
    fixture.detectChanges();
    expect(component.isCurvesDocOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.isCurvesDocOpen()).toBe(false);
    expect(el.querySelector('app-reach-curves-doc-modal [role="dialog"]')).toBeNull();
  });
});

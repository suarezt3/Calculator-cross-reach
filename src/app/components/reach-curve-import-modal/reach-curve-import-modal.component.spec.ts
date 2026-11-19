import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import * as XLSX from 'xlsx';
import { CurveSyncStatus } from '../../models/reach-curve.models';
import { ReachCurveService } from '../../services/reach-curve.service';
import { ReachCurveImportModalComponent } from './reach-curve-import-modal.component';

function createExcelFile(rows: unknown[][], fileName: string): File {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([data], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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

describe('ReachCurveImportModalComponent', () => {
  let fixture: ComponentFixture<ReachCurveImportModalComponent>;
  let component: ReachCurveImportModalComponent;
  let service: ReachCurveService;

  beforeEach(async () => {
    localStorage.clear();
    mockDefaultFetch();

    await TestBed.configureTestingModule({
      imports: [ReachCurveImportModalComponent],
    }).compileComponents();

    service = TestBed.inject(ReachCurveService);
    fixture = TestBed.createComponent(ReachCurveImportModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('does not render modal dialog when isOpen is false and emits closeModal on close', async () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();

    const closedSpy = vi.fn();
    component.closeModal.subscribe(closedSpy);

    const closeBtn = el.querySelector('.btn-close') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    expect(closedSpy).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('enforces strict platform lock while selectedPlatform is null and blocks file processing', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const parseSpy = vi.spyOn(service, 'parseExcelFiles');

    expect(component.selectedPlatform()).toBeNull();

    const lockNotice = el.querySelector('.lock-notice');
    expect(lockNotice?.textContent).toContain(
      'Selecciona primero la plataforma a la que pertenecen los archivos antes de subirlos',
    );

    const dropzone = el.querySelector('.dropzone') as HTMLElement;
    expect(dropzone.classList.contains('dropzone--locked')).toBe(true);
    expect(dropzone.getAttribute('aria-disabled')).toBe('true');

    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.disabled).toBe(true);

    const selectBtn = el.querySelector('.btn-select-files') as HTMLButtonElement;
    expect(selectBtn.disabled).toBe(true);

    const metaFile = createExcelFile(
      [
        [
          'Nombre de la campaña',
          'Monto gastado (COP)',
          'Alcance',
          'Impresiones',
          'Inicio del informe',
          'Fin del informe',
        ],
        ['Brand_CO_ATT_CPM_01', 1500000, 300000, 900000, '2026-01-01', '2026-01-07'],
      ],
      'meta-locked.xlsx',
    );

    await component.processFiles([metaFile]);
    await component.onDrop({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [metaFile] } as unknown as DataTransfer,
    } as unknown as DragEvent);

    expect(parseSpy).not.toHaveBeenCalled();
    expect(component.queuedFiles()).toHaveLength(0);
  });

  it('unlocks upload on platform selection, parses .xlsx in memory, and clears queue when switching platforms', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const platformCards = Array.from(
      el.querySelectorAll('.platform-option-card'),
    ) as HTMLButtonElement[];
    expect(platformCards).toHaveLength(3);

    // Verify DV360 icon path wiring inside PlatformIconComponent
    const dv360Img = platformCards[2].querySelector('img') as HTMLImageElement;
    expect(dv360Img.getAttribute('src')).toBe('assets/icons/platforms/dv360.svg');

    // Select Meta
    platformCards[0].click();
    fixture.detectChanges();

    expect(component.selectedPlatform()).toBe('Meta');
    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    const selectBtn = el.querySelector('.btn-select-files') as HTMLButtonElement;
    expect(fileInput.disabled).toBe(false);
    expect(selectBtn.disabled).toBe(false);

    const metaFile = createExcelFile(
      [
        [
          'Nombre de la campaña',
          'Monto gastado (COP)',
          'Alcance',
          'Impresiones',
          'Inicio del informe',
          'Fin del informe',
        ],
        ['Brand_CO_ATT_CPM_01', 1500000, 300000, 900000, '2026-01-01', '2026-01-07'],
        ['Brand_MX_Cons_CPV_02', 800000, 200000, 400000, '2026-01-01', '2026-01-07'],
      ],
      'meta-jan.xlsx',
    );

    await component.processFiles([metaFile]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.queuedFiles()).toHaveLength(1);
    expect(component.totalValidRecords()).toBe(2);
    expect(component.countryBreakdown()).toEqual([
      { country: 'Colombia', count: 1 },
      { country: 'Mexico', count: 1 },
    ]);
    expect(component.stageBreakdown()).toEqual([
      { stage: 'ATT', count: 1 },
      { stage: 'CON', count: 1 },
    ]);
    expect(component.canSave()).toBe(true);

    // Switch to TikTok -> queue must clear completely
    platformCards[1].click();
    fixture.detectChanges();

    expect(component.selectedPlatform()).toBe('TikTok');
    expect(component.queuedFiles()).toHaveLength(0);
    expect(component.parsedRecords()).toHaveLength(0);
    expect(component.totalValidRecords()).toBe(0);
    expect(component.canSave()).toBe(false);
  });

  it('requires manual period and cut when undetected and enables save once assigned', async () => {
    const el = fixture.nativeElement as HTMLElement;
    component.selectPlatform('TikTok');
    fixture.detectChanges();

    const undatedTikTok = createExcelFile(
      [
        ['Campaign name', 'Spend', 'Reach', 'Impressions', 'Currency'],
        ['Brand_CO_PUR_CPA_Undated', 950000, 180000, 540000, 'COP'],
      ],
      'tiktok-no-dates.xlsx',
    );

    const assignSpy = vi.spyOn(service, 'assignManualPeriodAndCut');
    await component.processFiles([undatedTikTok]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.totalValidRecords()).toBe(1);
    expect(component.hasPendingManualPeriodOrCut()).toBe(true);
    expect(component.canSave()).toBe(false);

    const saveBtn = el.querySelector('.btn-save-sync') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const monthInput = el.querySelector('.manual-month-input') as HTMLInputElement;
    const cutSelect = el.querySelector('.manual-cut-select') as HTMLSelectElement;
    expect(monthInput).not.toBeNull();
    expect(cutSelect).not.toBeNull();

    // Assign period first -> still pending cut
    component.onManualPeriodChange('tiktok-no-dates.xlsx', '2026-04');
    fixture.detectChanges();
    expect(component.hasPendingManualPeriodOrCut()).toBe(true);
    expect(component.canSave()).toBe(false);
    expect(assignSpy).not.toHaveBeenCalled();

    // Assign cut -> calls assignManualPeriodAndCut, keeps inputs visible, enables save
    component.onManualCutChange('tiktok-no-dates.xlsx', 'W2');
    fixture.detectChanges();

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(component.hasPendingManualPeriodOrCut()).toBe(false);
    expect(component.canSave()).toBe(true);
    expect(saveBtn.disabled).toBe(false);
    expect(el.querySelector('.manual-month-input')).not.toBeNull();
    expect(component.parsedRecords()[0].periodo).toBe('2026-04');
    expect(component.parsedRecords()[0].corte).toBe('W2');
    expect(component.parsedRecords()[0].record_key).toBe(
      '2026-04|W2|TikTok|Colombia|Brand_CO_PUR_CPA_Undated',
    );
  });

  it('highlights structure errors, removes queued files, and upserts valid records on save', async () => {
    const el = fixture.nativeElement as HTMLElement;
    component.selectPlatform('TikTok');
    fixture.detectChanges();

    // Wrong headers for TikTok (Meta structure)
    const badFile = createExcelFile(
      [
        ['Nombre de la campaña', 'Alcance', 'Impresiones', 'Monto gastado (COP)'],
        ['Camp_CO_ATT_CPM', 100000, 300000, 500000],
      ],
      'wrong-platform.xlsx',
    );
    const validTikTok = createExcelFile(
      [
        ['Campaign name', 'Spend', 'Reach', 'Impressions', 'Currency'],
        ['Camp_CO_LOY_CPE', 1200000, 220000, 660000, 'COP'],
      ],
      'TikTok_20260301-20260307.xlsx',
    );

    await component.processFiles([badFile, validTikTok]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelectorAll('.file-row--error')).toHaveLength(1);
    expect(el.querySelector('.file-error-row')?.textContent).toContain(
      'Estructura inválida para TikTok',
    );

    // Remove the invalid file
    const removeButtons = el.querySelectorAll('.btn-remove-file');
    (removeButtons[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.queuedFiles()).toHaveLength(1);
    expect(el.querySelectorAll('.file-row--error')).toHaveLength(0);

    // Check UI privacy / no leaked tech terms
    const renderedText = el.textContent ?? '';
    expect(renderedText).not.toMatch(/supabase|postgresql|uuid/i);
    expect(el.querySelector('.font-mono')).toBeNull();

    const upsertSpy = vi.spyOn(service, 'upsertRecords');
    const completedEvents: Array<{ savedCount: number; syncStatus: CurveSyncStatus }> = [];
    const closedSpy = vi.fn();
    component.importCompleted.subscribe((evt) => completedEvents.push(evt));
    component.closeModal.subscribe(closedSpy);

    const saveBtn = el.querySelector('.btn-save-sync') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    saveBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy.mock.calls[0][0]).toHaveLength(1);
    expect(completedEvents).toEqual([{ savedCount: 1, syncStatus: 'synced' }]);
    expect(closedSpy).toHaveBeenCalledTimes(1);
    expect(component.queuedFiles()).toHaveLength(0);
    expect(component.selectedPlatform()).toBeNull();
  });
});

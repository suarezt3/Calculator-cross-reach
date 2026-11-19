import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import * as XLSX from 'xlsx';
import { DEFAULT_COUNTRY_UNIVERSES } from '../models/platform.models';
import { ReachCurveRecord } from '../models/reach-curve.models';
import { CrossReachService } from './cross-reach.service';
import { ReachCurveService } from './reach-curve.service';

function createExcelFile(rows: unknown[][], fileName: string): File {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([data], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

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
    cpma: overrides.cpma ?? (inversion / alcance) * 1000,
    cpm_imp: overrides.cpm_imp ?? (impresiones > 0 ? (inversion / impresiones) * 1000 : 0),
    source_file: overrides.source_file ?? 'test.xlsx',
    ...(overrides.updated_at !== undefined ? { updated_at: overrides.updated_at } : {}),
  };
}

function mockDefaultFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('ReachCurveService', () => {
  let service: ReachCurveService;

  beforeEach(() => {
    localStorage.clear();
    mockDefaultFetch();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReachCurveService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('Initialization and computed signals', () => {
    it('initializes with default exchange rates and sorted unique availablePeriods', async () => {
      expect(service.exchangeRates().cop_to_usd).toBe(4200);
      expect(service.exchangeRates().mxn_to_usd).toBe(20);

      await service.upsertRecords([
        makeRecord({ campana_nombre: 'C1', periodo: '2026-03' }),
        makeRecord({ campana_nombre: 'C2', periodo: '2026-01' }),
        makeRecord({ campana_nombre: 'C3', periodo: '2026-03' }),
        makeRecord({ campana_nombre: 'C4', periodo: 'PENDING' }),
      ]);

      expect(service.availablePeriods()).toEqual(['2026-01', '2026-03']);
    });
  });

  describe('Header validation and error reporting', () => {
    it('rejects a Meta file uploaded as TikTok and aborts processing', async () => {
      const metaFile = createExcelFile(
        [
          ['Nombre de la campaña', 'Alcance', 'Impresiones', 'Monto gastado (COP)'],
          ['Camp_CO_ATT_CPM', 100000, 300000, 500000],
        ],
        'meta-export.xlsx',
      );

      const result = await service.parseExcelFiles([metaFile], 'TikTok');
      expect(result.records).toHaveLength(0);
      expect(result.summaries).toHaveLength(1);
      expect(result.summaries[0].errors).toHaveLength(1);
      expect(result.summaries[0].errors[0]).toContain('Estructura inválida para TikTok');
    });

    it('rejects a DV360 file missing required columns', async () => {
      const invalidDv360 = createExcelFile(
        [
          ['Campaign', 'Insertion Order', 'Impressions'],
          ['Camp_CO', 'IO_YBA', 1000],
        ],
        'bad-dv360.xlsx',
      );

      const result = await service.parseExcelFiles([invalidDv360], 'DV360');
      expect(result.records).toHaveLength(0);
      expect(result.summaries[0].errors[0]).toContain('Estructura inválida para DV360');
    });

    it('reports an error for an empty workbook sheet', async () => {
      const emptyFile = createExcelFile([], 'empty.xlsx');
      const result = await service.parseExcelFiles([emptyFile], 'Meta');
      expect(result.records).toHaveLength(0);
      expect(result.summaries[0].errors).toHaveLength(1);
    });
  });

  describe('Meta Excel parsing', () => {
    it('parses COP Meta files regardless of column order, ignores totals/zeros, and computes cpma/cpm_imp', async () => {
      const metaFile = createExcelFile(
        [
          [
            'Impresiones',
            'Fin del informe',
            'Monto gastado (COP)',
            'Nombre de la campaña',
            'Alcance',
            'Inicio del informe',
          ],
          [900000, '2026-01-07', 2500000, 'Brand_CO_ATT_CPM_Test1', 400000, '2026-01-01'],
          [0, '2026-01-07', 1000000, 'Brand_MX_Purch_CPA_NoImpr', 200000, '2026-01-01'],
          [500000, '2026-01-07', 0, 'Brand_CO_ATT_CPM_ZeroSpend', 100000, '2026-01-01'],
          [100000, '2026-01-07', 300000, 'Brand_CO_ATT_CPM_ZeroReach', 0, '2026-01-01'],
          [1500000, '2026-01-07', 3800000, 'Resultados totales', 600000, '2026-01-01'],
          ['', '', '', '', '', ''],
        ],
        'meta-reordered.xlsx',
      );

      const result = await service.parseExcelFiles([metaFile], 'Meta');
      expect(result.summaries[0].errors).toEqual([]);
      expect(result.summaries[0].detectedPeriod).toBe('2026-01');
      expect(result.summaries[0].detectedCut).toBe('W1');
      expect(result.summaries[0].needsManualPeriodOrCut).toBe(false);
      expect(result.summaries[0].validRecordsCount).toBe(2);
      expect(result.summaries[0].skippedRows).toBe(3);

      const first = result.records[0];
      expect(first.plataforma).toBe('Meta');
      expect(first.pais).toBe('Colombia');
      expect(first.moneda).toBe('COP');
      expect(first.cpma).toBeCloseTo((2500000 / 400000) * 1000, 6);
      expect(first.cpm_imp).toBeCloseTo((2500000 / 900000) * 1000, 6);
      expect(first.record_key).toBe('2026-01|W1|Meta|Colombia|Brand_CO_ATT_CPM_Test1');

      const second = result.records[1];
      expect(second.pais).toBe('Mexico');
      expect(second.stage).toBe('PUR');
      expect(second.tipo_compra).toBe('CPA');
      expect(second.cpm_imp).toBe(0);
    });

    it('auto-detects MXN currency when Monto gastado (MXN) column is present and handles Excel serial dates', async () => {
      // Excel serial 46032 = 2026-01-10, 46046 = 2026-01-24 (15 inclusive days -> W2)
      const metaMxn = createExcelFile(
        [
          [
            'Nombre de la campaña',
            'Monto gastado (MXN)',
            'Alcance',
            'Impresiones',
            'Inicio del informe',
            'Fin del informe',
          ],
          ['Perf_MEX_Cons_CPV', 85000, 320000, 640000, 46032, 46046],
        ],
        'meta-mxn.xlsx',
      );

      const result = await service.parseExcelFiles([metaMxn], 'Meta');
      expect(result.records).toHaveLength(1);
      expect(result.records[0].moneda).toBe('MXN');
      expect(result.records[0].pais).toBe('Mexico');
      expect(result.records[0].stage).toBe('CON');
      expect(result.records[0].tipo_compra).toBe('CPV');
      expect(result.records[0].periodo).toBe('2026-01');
      expect(result.records[0].corte).toBe('W2');
    });
  });

  describe('TikTok Excel parsing and filename date detection', () => {
    it('ignores Total of rows, parses Currency, and extracts YYYYMMDD-YYYYMMDD from filename', async () => {
      const tiktokFile = createExcelFile(
        [
          ['Campaign name', 'Spend', 'Reach', 'Impressions', 'Currency'],
          ['Camp_CHL_LOY_CPE', 1200000, 250000, 750000, 'COP'],
          ['Camp_CRI_ATT_CPC', 45000, 90000, 180000, 'MXN'],
          ['Total of 2 results', 1245000, 340000, 930000, 'COP'],
          ['Camp_PER_ATT_CPM_Zero', 0, 50000, 100000, 'COP'],
        ],
        'TikTok_20260301-20260320_report.xlsx',
      );

      const result = await service.parseExcelFiles([tiktokFile], 'TikTok');
      expect(result.summaries[0].detectedPeriod).toBe('2026-03');
      expect(result.summaries[0].detectedCut).toBe('W3');
      expect(result.summaries[0].needsManualPeriodOrCut).toBe(false);
      expect(result.records).toHaveLength(2);
      expect(result.records[0].pais).toBe('Chile');
      expect(result.records[0].stage).toBe('LOY');
      expect(result.records[0].tipo_compra).toBe('CPE');
      expect(result.records[1].pais).toBe('Costa Rica');
      expect(result.records[1].moneda).toBe('MXN');
    });

    it('detects [Mes]-[W1..W4]-[Año] in Spanish and English with various separators', async () => {
      const makeTikTok = (name: string) =>
        createExcelFile(
          [
            ['Campaign name', 'Spend', 'Reach', 'Impressions', 'Currency'],
            ['Camp_CO_ATT_CPM', 500000, 100000, 200000, 'COP'],
          ],
          name,
        );

      const r1 = await service.parseExcelFiles([makeTikTok('Enero-W1-2026.xlsx')], 'TikTok');
      expect(r1.summaries[0].detectedPeriod).toBe('2026-01');
      expect(r1.summaries[0].detectedCut).toBe('W1');

      const r2 = await service.parseExcelFiles([makeTikTok('TikTok_Enero-W3 2024.xlsx')], 'TikTok');
      expect(r2.summaries[0].detectedPeriod).toBe('2024-01');
      expect(r2.summaries[0].detectedCut).toBe('W3');

      const r3 = await service.parseExcelFiles([makeTikTok('Septiembre_W2_2025.xlsx')], 'TikTok');
      expect(r3.summaries[0].detectedPeriod).toBe('2025-09');
      expect(r3.summaries[0].detectedCut).toBe('W2');

      const r4 = await service.parseExcelFiles([makeTikTok('August-W4-2025.xlsx')], 'TikTok');
      expect(r4.summaries[0].detectedPeriod).toBe('2025-08');
      expect(r4.summaries[0].detectedCut).toBe('W4');
    });
  });

  describe('DV360 Excel parsing, footer Date Range, stop markers, and format classification', () => {
    it('scans footer Date Range, stops at markers, skips "-" reach, and classifies formats/platforms', async () => {
      const dv360File = createExcelFile(
        [
          [
            'Campaign',
            'Insertion Order',
            'Advertiser Currency',
            'Total Media Cost (Advertiser Currency)',
            'Unique Reach: Total Reach',
            'Impressions',
          ],
          ['Brand_CO_ATT', 'IO_YTNSTV_Reach', 'COP', 3000000, 450000, 1200000],
          ['Brand_PER_Cons', 'IO_YTNS_Views', 'COP', 1500000, 200000, 600000],
          ['Brand_MX_Purch', 'IO_STDB_Conversion', 'MXN', 60000, 180000, 900000],
          ['Brand_CO_ATT', 'IO_YBA_IgnoredDash', 'COP', 500000, '-', 100000],
          ['Brand_CO_ATT', 'IO_DMG_IgnoredZero', 'COP', 500000, '0', 100000],
          ['', '', '', '', '', ''],
          ['Report Time:', '2026/02/28 12:00 UTC', '', '', '', ''],
          ['Date Range:', '2026/02/01 to 2026/02/25', '', '', '', ''],
          ['Camp_CO_ATT_AfterStop', 'IO_YBA_ShouldNotParse', 'COP', 9999999, 999999, 999999],
        ],
        'dv360-report.xlsx',
      );

      const result = await service.parseExcelFiles([dv360File], 'DV360');
      expect(result.summaries[0].detectedPeriod).toBe('2026-02');
      expect(result.summaries[0].detectedCut).toBe('W4');
      expect(result.summaries[0].needsManualPeriodOrCut).toBe(false);
      expect(result.records).toHaveLength(3);

      const ytnstv = result.records[0];
      expect(ytnstv.formato).toBe('Non-Skip Trueview');
      expect(ytnstv.plataforma).toBe('YouTube');
      expect(ytnstv.tipo_compra).toBe('CPM');
      expect(ytnstv.record_key).toBe('2026-02|W4|YouTube|Colombia|Brand_CO_ATT::IO_YTNSTV_Reach');

      const ytns = result.records[1];
      expect(ytns.formato).toBe('Non-Skip');
      expect(ytns.plataforma).toBe('YouTube');
      expect(ytns.pais).toBe('Peru');
      expect(ytns.stage).toBe('CON');
      expect(ytns.tipo_compra).toBe('CPV');

      const stdb = result.records[2];
      expect(stdb.formato).toBe('Standard Banners');
      expect(stdb.plataforma).toBe('Display');
      expect(stdb.moneda).toBe('MXN');
      expect(stdb.tipo_compra).toBe('CPA');
    });

    it('stops immediately when encountering Group By:, MRC Accredited, or Filter by', async () => {
      for (const marker of ['Group By:', 'MRC Accredited', 'Filter by']) {
        const file = createExcelFile(
          [
            [
              'Campaign',
              'Insertion Order',
              'Advertiser Currency',
              'Total Media Cost (Advertiser Currency)',
              'Unique Reach: Total Reach',
              'Impressions',
            ],
            ['Camp_CO_ATT', 'IO_YBA', 'COP', 1000000, 100000, 300000],
            [marker, 'Some value', 'COP', 1000000, 100000, 300000],
            ['Camp_CO_ATT_Late', 'IO_YBA_Late', 'COP', 2000000, 200000, 600000],
            ['Date Range:', '2026/01/01 to 2026/01/07', '', '', '', ''],
          ],
          `dv360-${marker}.xlsx`,
        );

        const result = await service.parseExcelFiles([file], 'DV360');
        expect(result.records).toHaveLength(1);
        expect(result.records[0].formato).toBe('Bumper Ad');
        expect(result.summaries[0].detectedCut).toBe('W1');
      }
    });
  });

  describe('Date cut calculation boundaries (resolvePeriodAndCutFromDates)', () => {
    it('classifies inclusive UTC day ranges at boundaries 9, 10, 17, 18, 24, 25', () => {
      expect(service.resolvePeriodAndCutFromDates('2026-01-01', '2026-01-01')).toEqual({
        periodo: '2026-01',
        corte: 'W1',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-01', '2026-01-09')).toEqual({
        periodo: '2026-01',
        corte: 'W1',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-01', '2026-01-10')).toEqual({
        periodo: '2026-01',
        corte: 'W2',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-01', '2026-01-17')).toEqual({
        periodo: '2026-01',
        corte: 'W2',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-01', '2026-01-18')).toEqual({
        periodo: '2026-01',
        corte: 'W3',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-01', '2026-01-24')).toEqual({
        periodo: '2026-01',
        corte: 'W3',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-01', '2026-01-25')).toEqual({
        periodo: '2026-01',
        corte: 'W4',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-25', '2026-02-02')).toEqual({
        periodo: '2026-01',
        corte: 'W1',
      });
      expect(service.resolvePeriodAndCutFromDates('2026-01-10', '2026-01-01')).toBeNull();
    });
  });

  describe('Manual period and cut fallback', () => {
    it('flags needsManualPeriodOrCut and rebuilds record_key only for the target file', async () => {
      const noDateTikTok = createExcelFile(
        [
          ['Campaign name', 'Spend', 'Reach', 'Impressions', 'Currency'],
          ['Brand_CO_ATT_CPM_A|B', 750000, 120000, 350000, 'COP'],
        ],
        'tiktok-undated.xlsx',
      );
      const datedMeta = createExcelFile(
        [
          [
            'Nombre de la campaña',
            'Monto gastado (COP)',
            'Alcance',
            'Impresiones',
            'Inicio del informe',
            'Fin del informe',
          ],
          ['Brand_CO_ATT_CPM_Keep', 800000, 150000, 400000, '2026-01-01', '2026-01-07'],
        ],
        'meta-dated.xlsx',
      );

      const tiktokRes = await service.parseExcelFiles([noDateTikTok], 'TikTok');
      const metaRes = await service.parseExcelFiles([datedMeta], 'Meta');

      expect(tiktokRes.summaries[0].needsManualPeriodOrCut).toBe(true);
      expect(tiktokRes.summaries[0].detectedPeriod).toBeNull();
      expect(tiktokRes.summaries[0].detectedCut).toBeNull();
      expect(tiktokRes.records[0].periodo).toBe('PENDING');

      const combined = [...tiktokRes.records, ...metaRes.records];
      const updated = service.assignManualPeriodAndCut(
        combined,
        'tiktok-undated.xlsx',
        '2026-05',
        'W3',
      );

      expect(updated[0].periodo).toBe('2026-05');
      expect(updated[0].corte).toBe('W3');
      expect(updated[0].record_key).toBe('2026-05|W3|TikTok|Colombia|Brand_CO_ATT_CPM_A|B');

      expect(updated[1].periodo).toBe('2026-01');
      expect(updated[1].corte).toBe('W1');
      expect(updated[1].record_key).toBe('2026-01|W1|Meta|Colombia|Brand_CO_ATT_CPM_Keep');
    });
  });

  describe('Official Regex Dictionaries', () => {
    it('classifies countries and enforces exclusions before inclusions', () => {
      expect(service.classifyCountry('Camp_CO_PAN_ATT')).toBeNull();
      expect(service.classifyCountry('Camp_PA_ATT')).toBeNull();
      expect(service.classifyCountry('Camp_BOL_ATT')).toBeNull();
      expect(service.classifyCountry('Camp_GTM_ATT')).toBeNull();
      expect(service.classifyCountry('Camp_SLV_ATT')).toBeNull();
      expect(service.classifyCountry('Camp_URY_ATT')).toBeNull();

      expect(service.classifyCountry('Camp_CO_ATT')).toBe('Colombia');
      expect(service.classifyCountry('Camp_COL_ATT')).toBe('Colombia');
      expect(service.classifyCountry('Camp_COL__ATT')).toBe('Colombia');
      expect(service.classifyCountry('Camp_ COL_ATT')).toBe('Colombia');
      expect(service.classifyCountry('Camp_ COL__ATT')).toBe('Colombia');

      expect(service.classifyCountry('Camp_MX_ATT')).toBe('Mexico');
      expect(service.classifyCountry('Camp_MEX_ATT')).toBe('Mexico');
      expect(service.classifyCountry('Camp__MX_ATT')).toBe('Mexico');

      expect(service.classifyCountry('Camp_CHL_ATT')).toBe('Chile');
      expect(service.classifyCountry('Camp_CL_ATT')).toBe('Chile');

      expect(service.classifyCountry('Camp_CRI_ATT')).toBe('Costa Rica');
      expect(service.classifyCountry('Camp_CR_ATT')).toBe('Costa Rica');

      expect(service.classifyCountry('Camp_PER_ATT')).toBe('Peru');
      expect(service.classifyCountry('Camp_PE_ATT')).toBe('Peru');

      expect(service.classifyCountry('Camp_UNKNOWN_ATT')).toBeNull();
    });

    it('classifies stages with case-insensitive rules and ATT default', () => {
      expect(service.classifyStage('camp_attention')).toBe('ATT');
      expect(service.classifyStage('camp_attn')).toBe('ATT');
      expect(service.classifyStage('camp_att')).toBe('ATT');
      expect(service.classifyStage('camp_consideration')).toBe('CON');
      expect(service.classifyStage('camp_cons')).toBe('CON');
      expect(service.classifyStage('camp_loyalty')).toBe('LOY');
      expect(service.classifyStage('camp_loy')).toBe('LOY');
      expect(service.classifyStage('camp_leads')).toBe('LOY');
      expect(service.classifyStage('camp_lead')).toBe('LOY');
      expect(service.classifyStage('camp_purchase')).toBe('PUR');
      expect(service.classifyStage('camp_purch')).toBe('PUR');
      expect(service.classifyStage('camp_generic')).toBe('ATT');
    });

    it('classifies buy types respecting strict priority order', () => {
      expect(service.classifyBuyType('CPC_CPM_CPV')).toBe('CPC');
      expect(service.classifyBuyType('Traffic_Reach')).toBe('CPC');
      expect(service.classifyBuyType('Impresiones_Views')).toBe('CPM');
      expect(service.classifyBuyType('Thruplay_Engagement')).toBe('CPV');
      expect(service.classifyBuyType('Engagement_Leads')).toBe('CPE');
      expect(service.classifyBuyType('PotencialClients_Conversion')).toBe('CPL');
      expect(service.classifyBuyType('Purch_Sales')).toBe('CPA');
      expect(service.classifyBuyType('Unmatched')).toBe('CPM');
    });

    it('classifies DV360 formats and evaluates YTNSTV before YTNS', () => {
      expect(service.classifyDv360Format('YBA_01')).toEqual({
        formato: 'Bumper Ad',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('YTNSTV_01')).toEqual({
        formato: 'Non-Skip Trueview',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('YTNS_01')).toEqual({
        formato: 'Non-Skip',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('YTSTV_01')).toEqual({
        formato: 'Skippable Trueview',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('IO_D_STD_01')).toEqual({
        formato: 'Standard Banners',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_Handraisers')).toEqual({
        formato: 'Handraisers',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_DMG_Test')).toEqual({
        formato: 'Demand Gen',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('IO_INSV_01')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_Other')).toEqual({
        formato: 'General',
        plataforma: 'Display',
      });
    });

    it('enforces all 10 DV360 rules, word-boundary isolation for BUM/OLV, and strict precedence', () => {
      // Rule 1: Bumper Ad (YBA or standalone BUM)
      expect(service.classifyDv360Format('Camp_BUM_Test')).toEqual({
        formato: 'Bumper Ad',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('Camp-BUM-Test')).toEqual({
        formato: 'Bumper Ad',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('Camp BUM Test')).toEqual({
        formato: 'Bumper Ad',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('BUM')).toEqual({
        formato: 'Bumper Ad',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('IO_ALBUM_01')).toEqual({
        formato: 'General',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('_BUM_YTSK_YTNSTV_DISPLAY')).toEqual({
        formato: 'Bumper Ad',
        plataforma: 'YouTube',
      });

      // Rule 2: YouTube Skippable (YTSK) before Rule 3/8
      expect(service.classifyDv360Format('IO_YTSK_01')).toEqual({
        formato: 'YouTube Skippable',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('YTSK_YTNSTV_DISPLAY')).toEqual({
        formato: 'YouTube Skippable',
        plataforma: 'YouTube',
      });

      // Rules 3-6: YTNSTV -> YTNS -> YTSTV -> DMG
      expect(service.classifyDv360Format('YTNSTV_YTNS_YTSTV')).toEqual({
        formato: 'Non-Skip Trueview',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('YTNS_YTSTV')).toEqual({
        formato: 'Non-Skip',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('YTSTV_DMG')).toEqual({
        formato: 'Skippable Trueview',
        plataforma: 'YouTube',
      });
      expect(service.classifyDv360Format('Display_DMG_Test')).toEqual({
        formato: 'Demand Gen',
        plataforma: 'YouTube',
      });

      // Rule 7: Display-OLV / standalone OLV BEFORE Rule 8 (STDB|DISPLAY)
      expect(service.classifyDv360Format('Display-OLV_Campaign')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('Display_OLV_01')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('Display OLV 01')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('DisplayOLV')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_OLV_01')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_VOLVO_01')).toEqual({
        formato: 'General',
        plataforma: 'Display',
      });

      // Rules 8-10: Standard Banners -> Handraisers -> Online Video fallback
      expect(service.classifyDv360Format('IO_DISPLAY_Handraisers_Video')).toEqual({
        formato: 'Standard Banners',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_IBD_01')).toEqual({
        formato: 'Standard Banners',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_STD_01')).toEqual({
        formato: 'Standard Banners',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_Handraisers_Video')).toEqual({
        formato: 'Handraisers',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_Video_01')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
      expect(service.classifyDv360Format('IO_V_01')).toEqual({
        formato: 'Online Video',
        plataforma: 'Display',
      });
    });
  });

  describe('Currency conversion', () => {
    it('converts across COP, MXN, and USD using exchangeRates signal', async () => {
      expect(service.convertInvestment(4200, 'COP', 'USD')).toBeCloseTo(1, 6);
      expect(service.convertInvestment(100, 'USD', 'MXN')).toBeCloseTo(2000, 6);
      expect(service.convertInvestment(42000, 'COP', 'MXN')).toBeCloseTo(200, 6);
      expect(service.convertInvestment(500, 'USD', 'USD')).toBe(500);

      await service.updateExchangeRates({ id: 'global', cop_to_usd: 4000, mxn_to_usd: 18 });
      expect(service.convertInvestment(4000, 'COP', 'USD')).toBeCloseTo(1, 6);
      expect(service.convertInvestment(1, 'USD', 'MXN')).toBeCloseTo(18, 6);
    });
  });

  describe('OLS Linear and Logarithmic Regression Engine', () => {
    it('computes exact OLS linear regression, clamps to [0, universeCap], and samples 50 curvePoints', async () => {
      // In USD with cop_to_usd=4200: x = [1000, 2000, 3000], y = [200_000, 400_000, 600_000]
      await service.upsertRecords([
        makeRecord({ campana_nombre: 'L1', inversion: 4_200_000, alcance: 200_000 }),
        makeRecord({ campana_nombre: 'L2', inversion: 8_400_000, alcance: 400_000 }),
        makeRecord({ campana_nombre: 'L3', inversion: 12_600_000, alcance: 600_000 }),
      ]);

      const model = service.buildRegressionModel({
        pais: 'Colombia',
        plataforma: 'Meta',
        stage: 'ATT',
        tipoCompra: 'CPM',
        corte: 'W1',
        currency: 'USD',
        modelType: 'linear',
      });

      expect(model.sampleSize).toBe(3);
      expect(model.slope).toBeCloseTo(200, 4);
      expect(model.intercept).toBeCloseTo(0, 4);
      expect(model.rSquared).toBeCloseTo(1, 6);
      expect(model.universeCap).toBe(DEFAULT_COUNTRY_UNIVERSES['Colombia']);
      expect(model.curvePoints).toHaveLength(50);
      expect(model.predictReach(0)).toBe(0);
      expect(model.predictReach(1500)).toBeCloseTo(300_000, 2);
      expect(model.predictReach(10_000_000)).toBe(DEFAULT_COUNTRY_UNIVERSES['Colombia']);
    });

    it('computes OLS logarithmic regression and unites YouTube + Display under DV360 filter', async () => {
      const a = 500_000;
      const b = -2_500_000;
      const xVals = [1000, 5000, 20000];

      await service.upsertRecords([
        makeRecord({
          campana_nombre: 'YT1',
          plataforma: 'YouTube',
          moneda: 'COP',
          inversion: xVals[0] * 4200,
          alcance: a * Math.log(xVals[0]) + b,
        }),
        makeRecord({
          campana_nombre: 'DSP1',
          plataforma: 'Display',
          moneda: 'MXN',
          inversion: xVals[1] * 20,
          alcance: a * Math.log(xVals[1]) + b,
        }),
        makeRecord({
          campana_nombre: 'YT2',
          plataforma: 'YouTube',
          moneda: 'COP',
          inversion: xVals[2] * 4200,
          alcance: a * Math.log(xVals[2]) + b,
        }),
      ]);

      const model = service.buildRegressionModel({
        pais: 'Colombia',
        plataforma: 'DV360',
        stage: 'ATT',
        tipoCompra: 'CPM',
        corte: 'W1',
        currency: 'USD',
        modelType: 'logarithmic',
      });

      expect(model.sampleSize).toBe(3);
      expect(model.slope).toBeCloseTo(a, 2);
      expect(model.intercept).toBeCloseTo(b, 2);
      expect(model.rSquared).toBeCloseTo(1, 6);
      expect(model.curvePoints).toHaveLength(50);
      expect(model.predictReach(1)).toBe(0); // negative raw reach clamped to 0
      expect(model.predictReach(10000)).toBeCloseTo(a * Math.log(10000) + b, 1);
    });

    it('handles 0-point and 1-point edge cases cleanly', async () => {
      const emptyModel = service.buildRegressionModel({
        pais: 'Chile',
        plataforma: 'TikTok',
        stage: 'PUR',
        tipoCompra: 'CPA',
        corte: 'W4',
        currency: 'USD',
        modelType: 'logarithmic',
      });
      expect(emptyModel.sampleSize).toBe(0);
      expect(emptyModel.curvePoints).toEqual([]);
      expect(emptyModel.predictReach(5000)).toBe(0);

      await service.upsertRecords([
        makeRecord({
          campana_nombre: 'SinglePoint',
          pais: 'Chile',
          plataforma: 'TikTok',
          stage: 'PUR',
          tipo_compra: 'CPA',
          corte: 'W4',
          inversion: 4200 * 1000,
          alcance: 120_000,
        }),
      ]);

      const singleModel = service.buildRegressionModel({
        pais: 'Chile',
        plataforma: 'TikTok',
        stage: 'PUR',
        tipoCompra: 'CPA',
        corte: 'W4',
        currency: 'USD',
        modelType: 'logarithmic',
      });
      expect(singleModel.sampleSize).toBe(1);
      expect(singleModel.curvePoints).toHaveLength(50);
      expect(singleModel.predictReach(1000)).toBeCloseTo(120_000, 2);
    });
  });

  describe('Hybrid persistence and mocked fetch batching', () => {
    it('deduplicates record_key and upserts in batches of max 200', async () => {
      const fetchCalls: Array<{
        url: string;
        method: string;
        bodyLen: number;
        prefer: string | null;
      }> = [];

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const method = init?.method ?? 'GET';
          if (method === 'POST' && url.includes('reach_curve_records')) {
            const headers = init?.headers as Record<string, string> | undefined;
            const parsedBody = JSON.parse(String(init?.body ?? '[]')) as unknown[];
            fetchCalls.push({
              url,
              method,
              bodyLen: parsedBody.length,
              prefer: headers?.['Prefer'] ?? null,
            });
            return new Response(null, { status: 201 });
          }
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }),
      );

      const batch: ReachCurveRecord[] = [];
      for (let i = 0; i < 450; i++) {
        batch.push(makeRecord({ campana_nombre: `Camp_${i}` }));
      }
      // Duplicate key with updated reach
      batch.push(makeRecord({ campana_nombre: 'Camp_0', alcance: 999_999 }));

      await service.upsertRecords(batch);

      expect(service.records()).toHaveLength(450);
      const updatedFirst = service.records().find((r) => r.campana_nombre === 'Camp_0');
      expect(updatedFirst?.alcance).toBe(999_999);

      expect(fetchCalls).toHaveLength(3);
      expect(fetchCalls.map((c) => c.bodyLen)).toEqual([200, 200, 50]);
      expect(fetchCalls[0].url).toContain('reach_curve_records?on_conflict=record_key');
      expect(fetchCalls[0].prefer).toBe('resolution=merge-duplicates,return=minimal');
      expect(service.lastSyncStatus()).toBe('synced');
    });

    it('paginates loadRecords in 1000-row pages and falls back to localStorage when fetch fails', async () => {
      const page1 = Array.from({ length: 1000 }, (_, i) =>
        makeRecord({ campana_nombre: `P1_${i}` }),
      );
      const page2 = [makeRecord({ campana_nombre: 'P2_0' })];

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('offset=0')) {
            return new Response(JSON.stringify(page1), { status: 200 });
          }
          if (url.includes('offset=1000')) {
            return new Response(JSON.stringify(page2), { status: 200 });
          }
          return new Response(JSON.stringify([]), { status: 200 });
        }),
      );

      const loaded = await service.loadRecords();
      expect(loaded).toHaveLength(1001);
      expect(service.lastSyncStatus()).toBe('synced');

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('Network offline');
        }),
      );

      const fallback = await service.loadRecords();
      expect(fallback).toHaveLength(1001);
      expect(service.lastSyncStatus()).toBe('local_only');
    });
  });

  describe('Simulator helpers, formato filter, and CrossReachService.getCountryUniverse', () => {
    it('ignores "ALL" and filters strictly when a specific formato is supplied to buildRegressionModel', async () => {
      const crossReachService = TestBed.inject(CrossReachService);
      const universeSpy = vi.spyOn(crossReachService, 'getCountryUniverse');

      await service.upsertRecords([
        makeRecord({
          campana_nombre: 'YT_Bumper_1',
          plataforma: 'YouTube',
          formato: 'Bumper Ad',
          inversion: 4_200_000,
          alcance: 200_000,
        }),
        makeRecord({
          campana_nombre: 'YT_Bumper_2',
          plataforma: 'YouTube',
          formato: 'Bumper Ad',
          inversion: 8_400_000,
          alcance: 380_000,
        }),
        makeRecord({
          campana_nombre: 'YT_NonSkip_1',
          plataforma: 'YouTube',
          formato: 'Non-Skip',
          inversion: 12_600_000,
          alcance: 500_000,
        }),
      ]);

      const allFormatsModel = service.buildRegressionModel({
        pais: 'Colombia',
        plataforma: 'YouTube',
        stage: 'ATT',
        tipoCompra: 'CPM',
        corte: 'W1',
        currency: 'USD',
        modelType: 'linear',
        formato: 'ALL',
      });
      expect(allFormatsModel.sampleSize).toBe(3);
      expect(allFormatsModel.universeCap).toBe(DEFAULT_COUNTRY_UNIVERSES['Colombia']);
      expect(universeSpy).toHaveBeenCalledWith('Colombia');

      const bumperModel = service.buildRegressionModel({
        pais: 'Colombia',
        plataforma: 'YouTube',
        stage: 'ATT',
        tipoCompra: 'CPM',
        corte: 'W1',
        currency: 'USD',
        modelType: 'linear',
        formato: 'Bumper Ad',
      });
      expect(bumperModel.sampleSize).toBe(2);
      expect(bumperModel.historicalPoints.map((pt) => pt.label)).toEqual([
        'YT_Bumper_1',
        'YT_Bumper_2',
      ]);
    });

    it('groups and sorts getAvailableCombinations by count desc and tie-breaks by plataforma, stage, corte', async () => {
      await service.upsertRecords([
        makeRecord({
          campana_nombre: 'M_ATT_1',
          pais: 'Colombia',
          plataforma: 'Meta',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W4',
        }),
        makeRecord({
          campana_nombre: 'M_ATT_2',
          pais: 'Colombia',
          plataforma: 'Meta',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W4',
        }),
        makeRecord({
          campana_nombre: 'M_ATT_3',
          pais: 'Colombia',
          plataforma: 'Meta',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W4',
        }),
        makeRecord({
          campana_nombre: 'T_CON_W2',
          pais: 'Colombia',
          plataforma: 'TikTok',
          stage: 'CON',
          tipo_compra: 'CPV',
          corte: 'W2',
        }),
        makeRecord({
          campana_nombre: 'T_CON_W1',
          pais: 'Colombia',
          plataforma: 'TikTok',
          stage: 'CON',
          tipo_compra: 'CPV',
          corte: 'W1',
        }),
        makeRecord({
          campana_nombre: 'D_ATT_W1',
          pais: 'Colombia',
          plataforma: 'Display',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W1',
        }),
        makeRecord({
          campana_nombre: 'M_CON_W1',
          pais: 'Colombia',
          plataforma: 'Meta',
          stage: 'CON',
          tipo_compra: 'CPM',
          corte: 'W1',
        }),
        makeRecord({
          campana_nombre: 'ZeroReachIgnored',
          pais: 'Colombia',
          plataforma: 'YouTube',
          stage: 'PUR',
          tipo_compra: 'CPA',
          corte: 'W3',
          alcance: 0,
        }),
        makeRecord({
          campana_nombre: 'OtherCountry',
          pais: 'Mexico',
          plataforma: 'Meta',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W1',
        }),
      ]);

      expect(service.getAvailableCombinations('Colombia')).toEqual([
        { plataforma: 'Meta', stage: 'ATT', tipoCompra: 'CPM', corte: 'W4', count: 3 },
        { plataforma: 'Display', stage: 'ATT', tipoCompra: 'CPM', corte: 'W1', count: 1 },
        { plataforma: 'Meta', stage: 'CON', tipoCompra: 'CPM', corte: 'W1', count: 1 },
        { plataforma: 'TikTok', stage: 'CON', tipoCompra: 'CPV', corte: 'W1', count: 1 },
        { plataforma: 'TikTok', stage: 'CON', tipoCompra: 'CPV', corte: 'W2', count: 1 },
      ]);
      expect(service.getAvailableCombinations('Peru')).toEqual([]);
    });

    it('returns sorted unique getAvailableFormats excluding General when specific formats exist and unites DV360', async () => {
      await service.upsertRecords([
        makeRecord({
          campana_nombre: 'YT_1',
          pais: 'Colombia',
          plataforma: 'YouTube',
          formato: 'Non-Skip',
        }),
        makeRecord({
          campana_nombre: 'YT_2',
          pais: 'Colombia',
          plataforma: 'YouTube',
          formato: 'Bumper Ad',
        }),
        makeRecord({
          campana_nombre: 'YT_3',
          pais: 'Colombia',
          plataforma: 'YouTube',
          formato: 'General',
        }),
        makeRecord({
          campana_nombre: 'DSP_1',
          pais: 'Colombia',
          plataforma: 'Display',
          formato: 'Standard Banners',
        }),
        makeRecord({
          campana_nombre: 'Meta_1',
          pais: 'Colombia',
          plataforma: 'Meta',
          formato: 'General',
        }),
        makeRecord({
          campana_nombre: 'YT_MX',
          pais: 'Mexico',
          plataforma: 'YouTube',
          formato: 'Demand Gen',
        }),
      ]);

      expect(service.getAvailableFormats('Colombia', 'YouTube')).toEqual(['Bumper Ad', 'Non-Skip']);
      expect(service.getAvailableFormats('Colombia', 'DV360')).toEqual([
        'Bumper Ad',
        'Non-Skip',
        'Standard Banners',
      ]);
      expect(service.getAvailableFormats('Colombia', 'Meta')).toEqual(['General']);
      expect(service.getAvailableFormats('Chile', 'DV360')).toEqual([]);
    });

    it('returns configured country universes via CrossReachService.getCountryUniverse', () => {
      const crossReachService = TestBed.inject(CrossReachService);
      expect(crossReachService.getCountryUniverse('Colombia')).toBe(27_000_000);
      expect(crossReachService.getCountryUniverse('Mexico')).toBe(53_000_000);
      expect(crossReachService.getCountryUniverse('Chile')).toBe(9_500_000);
      expect(crossReachService.getCountryUniverse('Peru')).toBe(18_500_000);
      expect(crossReachService.getCountryUniverse('Costa Rica')).toBe(3_500_000);
      expect(crossReachService.getCountryUniverse('Unknown')).toBe(0);
    });
  });

  describe('Period filtering, regression periodo support, and periodOptions', () => {
    it('evaluates matchesPeriodFilter for ALL, empty, YEAR:YYYY, and YYYY-MM', () => {
      expect(service.matchesPeriodFilter('2026-01')).toBe(true);
      expect(service.matchesPeriodFilter('2026-01', null)).toBe(true);
      expect(service.matchesPeriodFilter('2026-01', undefined)).toBe(true);
      expect(service.matchesPeriodFilter('2026-01', '')).toBe(true);
      expect(service.matchesPeriodFilter('2026-01', '   ')).toBe(true);
      expect(service.matchesPeriodFilter('2026-01', 'ALL')).toBe(true);
      expect(service.matchesPeriodFilter('PENDING', 'ALL')).toBe(true);

      expect(service.matchesPeriodFilter('2025-01', 'YEAR:2025')).toBe(true);
      expect(service.matchesPeriodFilter('2025-12', 'YEAR:2025')).toBe(true);
      expect(service.matchesPeriodFilter('2026-01', 'YEAR:2025')).toBe(false);
      expect(service.matchesPeriodFilter('PENDING', 'YEAR:2025')).toBe(false);
      expect(service.matchesPeriodFilter('2025-01', 'YEAR:')).toBe(false);
      expect(service.matchesPeriodFilter('2025-01', 'YEAR:20')).toBe(false);

      expect(service.matchesPeriodFilter('2026-01', '2026-01')).toBe(true);
      expect(service.matchesPeriodFilter('2026-01', ' 2026-01 ')).toBe(true);
      expect(service.matchesPeriodFilter('2026-02', '2026-01')).toBe(false);
      expect(service.matchesPeriodFilter('PENDING', '2026-01')).toBe(false);
    });

    it('filters buildRegressionModel with ALL, YEAR:YYYY, and exact YYYY-MM periodo', async () => {
      await service.upsertRecords([
        makeRecord({
          campana_nombre: 'C_2025_06',
          periodo: '2025-06',
          inversion: 4_200_000,
          alcance: 100_000,
        }),
        makeRecord({
          campana_nombre: 'C_2025_11',
          periodo: '2025-11',
          inversion: 8_400_000,
          alcance: 200_000,
        }),
        makeRecord({
          campana_nombre: 'C_2026_01',
          periodo: '2026-01',
          inversion: 12_600_000,
          alcance: 300_000,
        }),
        makeRecord({
          campana_nombre: 'C_2026_02',
          periodo: '2026-02',
          inversion: 16_800_000,
          alcance: 400_000,
        }),
      ]);

      const baseQuery = {
        pais: 'Colombia' as const,
        plataforma: 'Meta' as const,
        stage: 'ATT' as const,
        tipoCompra: 'CPM' as const,
        corte: 'W1' as const,
        currency: 'USD' as const,
        modelType: 'linear' as const,
      };

      const allModel = service.buildRegressionModel({ ...baseQuery, periodo: 'ALL' });
      expect(allModel.sampleSize).toBe(4);

      const year2025Model = service.buildRegressionModel({ ...baseQuery, periodo: 'YEAR:2025' });
      expect(year2025Model.sampleSize).toBe(2);
      expect(year2025Model.historicalPoints.map((pt) => pt.periodo)).toEqual([
        '2025-06',
        '2025-11',
      ]);

      const jan2026Model = service.buildRegressionModel({ ...baseQuery, periodo: '2026-01' });
      expect(jan2026Model.sampleSize).toBe(1);
      expect(jan2026Model.historicalPoints[0].label).toBe('C_2026_01');
      expect(jan2026Model.predictReach(3000)).toBeCloseTo(300_000, 2);

      const missingModel = service.buildRegressionModel({ ...baseQuery, periodo: '2024-01' });
      expect(missingModel.sampleSize).toBe(0);
    });

    it('filters getAvailableCombinations by optional periodo parameter', async () => {
      await service.upsertRecords([
        makeRecord({
          campana_nombre: 'CO_2025_M1',
          pais: 'Colombia',
          plataforma: 'Meta',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W1',
          periodo: '2025-11',
        }),
        makeRecord({
          campana_nombre: 'CO_2025_M2',
          pais: 'Colombia',
          plataforma: 'Meta',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W1',
          periodo: '2025-12',
        }),
        makeRecord({
          campana_nombre: 'CO_2026_TT',
          pais: 'Colombia',
          plataforma: 'TikTok',
          stage: 'CON',
          tipo_compra: 'CPV',
          corte: 'W2',
          periodo: '2026-01',
        }),
        makeRecord({
          campana_nombre: 'MX_2026_M',
          pais: 'Mexico',
          plataforma: 'Meta',
          stage: 'ATT',
          tipo_compra: 'CPM',
          corte: 'W1',
          periodo: '2026-01',
        }),
      ]);

      expect(service.getAvailableCombinations('Colombia', 'ALL')).toEqual([
        { plataforma: 'Meta', stage: 'ATT', tipoCompra: 'CPM', corte: 'W1', count: 2 },
        { plataforma: 'TikTok', stage: 'CON', tipoCompra: 'CPV', corte: 'W2', count: 1 },
      ]);
      expect(service.getAvailableCombinations('Colombia', 'YEAR:2025')).toEqual([
        { plataforma: 'Meta', stage: 'ATT', tipoCompra: 'CPM', corte: 'W1', count: 2 },
      ]);
      expect(service.getAvailableCombinations('Colombia', '2026-01')).toEqual([
        { plataforma: 'TikTok', stage: 'CON', tipoCompra: 'CPV', corte: 'W2', count: 1 },
      ]);
      expect(service.getAvailableCombinations('Colombia', '2024-05')).toEqual([]);
    });

    it('builds getAvailablePeriodOptions(pais) and reactive periodOptions sorted descending', async () => {
      expect(service.periodOptions()).toEqual([
        {
          value: 'ALL',
          label: 'Todo el histórico (0 meses)',
          kind: 'all',
          count: 0,
          monthCount: 0,
        },
      ]);

      await service.upsertRecords([
        makeRecord({ campana_nombre: 'CO_2025_11', pais: 'Colombia', periodo: '2025-11' }),
        makeRecord({ campana_nombre: 'CO_2025_12_A', pais: 'Colombia', periodo: '2025-12' }),
        makeRecord({ campana_nombre: 'CO_2025_12_B', pais: 'Colombia', periodo: '2025-12' }),
        makeRecord({ campana_nombre: 'CO_2026_01', pais: 'Colombia', periodo: '2026-01' }),
        makeRecord({ campana_nombre: 'CO_PENDING', pais: 'Colombia', periodo: 'PENDING' }),
        makeRecord({
          campana_nombre: 'CO_ZERO_INV',
          pais: 'Colombia',
          periodo: '2026-02',
          inversion: 0,
        }),
        makeRecord({
          campana_nombre: 'CO_ZERO_REACH',
          pais: 'Colombia',
          periodo: '2026-03',
          alcance: 0,
        }),
        makeRecord({ campana_nombre: 'MX_2026_03', pais: 'Mexico', periodo: '2026-03' }),
      ]);

      expect(service.getAvailablePeriodOptions('Colombia')).toEqual([
        {
          value: 'ALL',
          label: 'Todo el histórico (3 meses)',
          kind: 'all',
          count: 4,
          monthCount: 3,
        },
        {
          value: 'YEAR:2026',
          label: 'Año 2026',
          kind: 'year',
          count: 1,
          monthCount: 1,
        },
        {
          value: 'YEAR:2025',
          label: 'Año 2025',
          kind: 'year',
          count: 3,
          monthCount: 2,
        },
        {
          value: '2026-01',
          label: 'Enero 2026',
          kind: 'month',
          count: 1,
          monthCount: 1,
        },
        {
          value: '2025-12',
          label: 'Diciembre 2025',
          kind: 'month',
          count: 2,
          monthCount: 1,
        },
        {
          value: '2025-11',
          label: 'Noviembre 2025',
          kind: 'month',
          count: 1,
          monthCount: 1,
        },
      ]);

      expect(service.getAvailablePeriodOptions('Mexico')).toEqual([
        {
          value: 'ALL',
          label: 'Todo el histórico (1 mes)',
          kind: 'all',
          count: 1,
          monthCount: 1,
        },
        {
          value: 'YEAR:2026',
          label: 'Año 2026',
          kind: 'year',
          count: 1,
          monthCount: 1,
        },
        {
          value: '2026-03',
          label: 'Marzo 2026',
          kind: 'month',
          count: 1,
          monthCount: 1,
        },
      ]);

      expect(service.getAvailablePeriodOptions('Chile')).toEqual([
        {
          value: 'ALL',
          label: 'Todo el histórico (0 meses)',
          kind: 'all',
          count: 0,
          monthCount: 0,
        },
      ]);

      expect(service.periodOptions()).toEqual(service.getAvailablePeriodOptions('ALL'));
      expect(service.periodOptions()[0]).toEqual({
        value: 'ALL',
        label: 'Todo el histórico (4 meses)',
        kind: 'all',
        count: 5,
        monthCount: 4,
      });
      expect(service.periodOptions().map((opt) => opt.value)).toEqual([
        'ALL',
        'YEAR:2026',
        'YEAR:2025',
        '2026-03',
        '2026-01',
        '2025-12',
        '2025-11',
      ]);
    });
  });

  describe('Data freshness and upsertRecords updated_at stamping', () => {
    it('returns empty dataFreshness state when no records are loaded', () => {
      expect(service.dataFreshness()).toEqual({
        hasData: false,
        latestPeriodRaw: null,
        latestPeriodLabel: 'Sin datos',
        lastUpdatedAt: null,
        lastUpdatedLabel: 'Sin datos',
        byPlatform: [
          {
            platform: 'Meta',
            latestPeriodRaw: null,
            latestPeriodLabel: 'Sin datos',
            recordsCount: 0,
          },
          {
            platform: 'TikTok',
            latestPeriodRaw: null,
            latestPeriodLabel: 'Sin datos',
            recordsCount: 0,
          },
          {
            platform: 'YouTube',
            latestPeriodRaw: null,
            latestPeriodLabel: 'Sin datos',
            recordsCount: 0,
          },
          {
            platform: 'Display',
            latestPeriodRaw: null,
            latestPeriodLabel: 'Sin datos',
            recordsCount: 0,
          },
        ],
      });
    });

    it('stamps updated_at with the same ISO timestamp in memory, localStorage, and POST payload during upsertRecords', async () => {
      vi.useFakeTimers();
      try {
        const fixedDate = new Date('2026-06-15T15:45:30.000Z');
        vi.setSystemTime(fixedDate);

        const postedBodies: ReachCurveRecord[][] = [];
        vi.stubGlobal(
          'fetch',
          vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('reach_curve_records') && init?.method === 'POST') {
              postedBodies.push(JSON.parse(String(init.body)) as ReachCurveRecord[]);
              return new Response(null, { status: 201 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
          }),
        );

        await service.upsertRecords([
          makeRecord({ campana_nombre: 'Stamp_1', periodo: '2026-04', plataforma: 'Meta' }),
          makeRecord({
            campana_nombre: 'Stamp_2',
            periodo: '2026-05',
            plataforma: 'TikTok',
            updated_at: '2024-01-01T00:00:00.000Z',
          }),
        ]);

        const expectedIso = fixedDate.toISOString();
        expect(service.records()).toHaveLength(2);
        expect(service.records().every((r) => r.updated_at === expectedIso)).toBe(true);

        const cachedRaw = localStorage.getItem('cross_reach_curve_records_v1');
        expect(cachedRaw).not.toBeNull();
        const cached = JSON.parse(cachedRaw!) as ReachCurveRecord[];
        expect(cached).toHaveLength(2);
        expect(cached.every((r) => r.updated_at === expectedIso)).toBe(true);

        expect(postedBodies).toHaveLength(1);
        expect(postedBodies[0].every((r) => r.updated_at === expectedIso)).toBe(true);

        expect(service.dataFreshness().lastUpdatedAt).toBe(expectedIso);
      } finally {
        vi.useRealTimers();
      }
    });

    it('computes multi-period and multi-platform dataFreshness without UTC-offset shift', async () => {
      const olderTs = '2026-01-05T10:15:00.000Z';
      const newerTs = '2026-05-18T19:30:00.000Z';

      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('reach_curve_records')) {
            return new Response(
              JSON.stringify([
                makeRecord({
                  campana_nombre: 'Meta_Jan',
                  plataforma: 'Meta',
                  periodo: '2026-01',
                  updated_at: olderTs,
                }),
                makeRecord({
                  campana_nombre: 'Meta_Dec',
                  plataforma: 'Meta',
                  periodo: '2026-12',
                  updated_at: newerTs,
                }),
                makeRecord({
                  campana_nombre: 'TT_Sep',
                  plataforma: 'TikTok',
                  periodo: '2026-09',
                  updated_at: olderTs,
                }),
                makeRecord({
                  campana_nombre: 'YT_Pending',
                  plataforma: 'YouTube',
                  periodo: 'PENDING',
                  updated_at: 'invalid-timestamp',
                }),
              ]),
              { status: 200 },
            );
          }
          return new Response(JSON.stringify([]), { status: 200 });
        }),
      );

      await service.loadRecords();
      const freshness = service.dataFreshness();

      const expectedFormattedDate = new Intl.DateTimeFormat('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(newerTs));

      expect(freshness.hasData).toBe(true);
      expect(freshness.latestPeriodRaw).toBe('2026-12');
      expect(freshness.latestPeriodLabel).toBe('Diciembre 2026');
      expect(freshness.lastUpdatedAt).toBe(newerTs);
      expect(freshness.lastUpdatedLabel).toBe(expectedFormattedDate);
      expect(freshness.byPlatform).toEqual([
        {
          platform: 'Meta',
          latestPeriodRaw: '2026-12',
          latestPeriodLabel: 'Diciembre 2026',
          recordsCount: 2,
        },
        {
          platform: 'TikTok',
          latestPeriodRaw: '2026-09',
          latestPeriodLabel: 'Septiembre 2026',
          recordsCount: 1,
        },
        {
          platform: 'YouTube',
          latestPeriodRaw: null,
          latestPeriodLabel: 'Sin datos',
          recordsCount: 1,
        },
        {
          platform: 'Display',
          latestPeriodRaw: null,
          latestPeriodLabel: 'Sin datos',
          recordsCount: 0,
        },
      ]);
    });

    it('formats January and missing updated_at timestamps accurately in dataFreshness', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('reach_curve_records')) {
            return new Response(
              JSON.stringify([
                makeRecord({
                  campana_nombre: 'Meta_Enero',
                  plataforma: 'Meta',
                  periodo: '2026-01',
                }),
                makeRecord({
                  campana_nombre: 'Display_Feb',
                  plataforma: 'Display',
                  periodo: '2026-02',
                }),
              ]),
              { status: 200 },
            );
          }
          return new Response(JSON.stringify([]), { status: 200 });
        }),
      );

      await service.loadRecords();
      const freshness = service.dataFreshness();

      expect(freshness.hasData).toBe(true);
      expect(freshness.latestPeriodRaw).toBe('2026-02');
      expect(freshness.latestPeriodLabel).toBe('Febrero 2026');
      expect(freshness.lastUpdatedAt).toBeNull();
      expect(freshness.lastUpdatedLabel).toBe('Sin fecha registrada');
      expect(freshness.byPlatform.find((p) => p.platform === 'Meta')?.latestPeriodLabel).toBe(
        'Enero 2026',
      );
      expect(freshness.byPlatform.find((p) => p.platform === 'Display')?.latestPeriodLabel).toBe(
        'Febrero 2026',
      );
    });
  });
});

import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AvailableCombinationItem,
  CurveBuyType,
  CurveCountry,
  CurveCurrency,
  CurveCut,
  CurvePlatformFilter,
  CurvePoint,
  CurveStage,
  CurveSyncStatus,
  ExchangeRateSettings,
  FileParseSummary,
  ParseExcelFilesResult,
  ReachCurvePlatform,
  ReachCurveRecord,
  RecordCurrency,
  RegressionModelResult,
  RegressionPoint,
  RegressionQueryParams,
  UploadPlatformSource,
} from '../models/reach-curve.models';
import { CrossReachService } from './cross-reach.service';

interface Dv360FormatRule {
  readonly pattern: RegExp;
  readonly formato: string;
  readonly plataforma: Extract<ReachCurvePlatform, 'YouTube' | 'Display'>;
}

interface CountryRule {
  readonly pattern: RegExp;
  readonly country: CurveCountry;
}

interface StageRule {
  readonly pattern: RegExp;
  readonly stage: CurveStage;
}

interface BuyTypeRule {
  readonly pattern: RegExp;
  readonly buyType: CurveBuyType;
}

interface PeriodCutResult {
  periodo: string;
  corte: CurveCut;
}

interface RecordBuildInput {
  periodo: string;
  corte: CurveCut;
  plataforma: ReachCurvePlatform;
  formato: string;
  moneda: RecordCurrency;
  campanaNombre: string;
  uniqueIdentifier: string;
  classificationText: string;
  inversion: number;
  alcance: number;
  impresiones: number;
  sourceFile: string;
}

const SUPABASE_URL = 'https://ndtqlmoqinbokpsrflii.supabase.co/rest/v1';
const SUPABASE_KEY = 'sb_publishable_BjiJA0a8TiIhzu4QkKXu1A_rDn7xPxb';
const LOCAL_STORAGE_RECORDS_KEY = 'cross_reach_curve_records_v1';
const LOCAL_STORAGE_RATES_KEY = 'cross_reach_curve_rates_v1';
const DEFAULT_RATES: ExchangeRateSettings = {
  id: 'global',
  cop_to_usd: 4200,
  mxn_to_usd: 20,
};
const UPSERT_BATCH_SIZE = 200;
const FETCH_PAGE_SIZE = 1000;
const CURVE_SAMPLE_COUNT = 50;
const MS_PER_DAY = 86_400_000;
const EXCEL_SERIAL_EPSILON = 0.001;

const COUNTRY_EXCLUSION_REGEX = /_(PAN|PA|BOL|GTM|SLV|URY)_/i;

const COUNTRY_RULES: readonly CountryRule[] = [
  { pattern: /_(?:CO|COL_?| ?COL_?)_/i, country: 'Colombia' },
  { pattern: /_(?:MX|MEX|_MX)_/i, country: 'Mexico' },
  { pattern: /_(?:CHL|CL)_/i, country: 'Chile' },
  { pattern: /_(?:CRI|CR)_/i, country: 'Costa Rica' },
  { pattern: /_(?:PER|PE)_/i, country: 'Peru' },
];

const STAGE_RULES: readonly StageRule[] = [
  { pattern: /Attention|attn|att/i, stage: 'ATT' },
  { pattern: /Consideration|Cons/i, stage: 'CON' },
  { pattern: /Loyalty|LOY|Leads|Lead/i, stage: 'LOY' },
  { pattern: /Purchase|Purch/i, stage: 'PUR' },
];

const BUY_TYPE_RULES: readonly BuyTypeRule[] = [
  { pattern: /CPC|WebVisits|Clicks|Traffic/i, buyType: 'CPC' },
  { pattern: /CPM|Reach|Impresiones/i, buyType: 'CPM' },
  { pattern: /CPV|Thruplay|Views/i, buyType: 'CPV' },
  { pattern: /CPE|Engagement/i, buyType: 'CPE' },
  { pattern: /CPL|Leads|PotencialClients/i, buyType: 'CPL' },
  { pattern: /CPA|Purch|Conversion/i, buyType: 'CPA' },
];

const DV360_FORMAT_RULES: readonly Dv360FormatRule[] = [
  { pattern: /YBA/i, formato: 'Bumper Ad', plataforma: 'YouTube' },
  { pattern: /YTNSTV/i, formato: 'Non-Skip Trueview', plataforma: 'YouTube' },
  { pattern: /YTNS/i, formato: 'Non-Skip', plataforma: 'YouTube' },
  { pattern: /YTSTV/i, formato: 'Skippable Trueview', plataforma: 'YouTube' },
  {
    pattern: /STDB|DISPLAY|IBD|_D_STD_|_STD_/i,
    formato: 'Standard Banners',
    plataforma: 'Display',
  },
  { pattern: /Handraisers/i, formato: 'Handraisers', plataforma: 'Display' },
  { pattern: /DMG/i, formato: 'Demand Gen', plataforma: 'YouTube' },
  { pattern: /Video|INSV|_V_/i, formato: 'Online Video', plataforma: 'Display' },
];

const DV360_STOP_PREFIXES: readonly string[] = [
  'report time:',
  'date range:',
  'group by:',
  'mrc accredited',
  'filter by',
];

const MONTH_NAME_MAP: Readonly<Record<string, string>> = {
  enero: '01',
  ene: '01',
  january: '01',
  jan: '01',
  febrero: '02',
  feb: '02',
  february: '02',
  marzo: '03',
  mar: '03',
  march: '03',
  abril: '04',
  abr: '04',
  april: '04',
  apr: '04',
  mayo: '05',
  may: '05',
  junio: '06',
  jun: '06',
  june: '06',
  julio: '07',
  jul: '07',
  july: '07',
  agosto: '08',
  ago: '08',
  august: '08',
  aug: '08',
  septiembre: '09',
  setiembre: '09',
  sep: '09',
  sept: '09',
  september: '09',
  octubre: '10',
  oct: '10',
  october: '10',
  noviembre: '11',
  nov: '11',
  november: '11',
  diciembre: '12',
  dic: '12',
  december: '12',
  dec: '12',
};

const FILENAME_MONTH_PATTERN = Object.keys(MONTH_NAME_MAP)
  .sort((a, b) => b.length - a.length)
  .join('|');

const FILENAME_MONTH_CUT_REGEX = new RegExp(
  `(?:^|[-_\\s.])(${FILENAME_MONTH_PATTERN})[-_\\s]+(W[1-4])[-_\\s]+((?:19|20)\\d{2})(?=$|[-_\\s.])`,
  'i',
);

@Injectable({
  providedIn: 'root',
})
export class ReachCurveService {
  private readonly crossReachService = inject(CrossReachService);

  readonly records = signal<ReachCurveRecord[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly lastSyncStatus = signal<CurveSyncStatus>('synced');
  readonly exchangeRates = signal<ExchangeRateSettings>({ ...DEFAULT_RATES });

  readonly availablePeriods = computed<string[]>(() => {
    const unique = new Set<string>();
    for (const record of this.records()) {
      const period = record.periodo.trim();
      if (period.length > 0 && period !== 'PENDING') {
        unique.add(period);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  });

  constructor() {
    this.loadRecordsFromLocalStorage();
    this.loadExchangeRatesFromLocalStorage();
    void this.initCloudSync();
  }

  private async initCloudSync(): Promise<void> {
    if (typeof fetch !== 'function') {
      return;
    }
    const recordsBeforeFetch = this.records();
    const ratesBeforeFetch = this.exchangeRates();

    try {
      const cloudRecords = await this.fetchAllRecordsFromCloud();
      if (this.records() === recordsBeforeFetch) {
        this.records.set(cloudRecords);
        this.writeToStorage(LOCAL_STORAGE_RECORDS_KEY, cloudRecords);
      }
      this.lastSyncStatus.set('synced');
    } catch {
      this.lastSyncStatus.set(typeof localStorage !== 'undefined' ? 'local_only' : 'error');
    }

    try {
      const cloudRates = await this.fetchExchangeRatesFromCloud();
      if (cloudRates && this.exchangeRates() === ratesBeforeFetch) {
        this.exchangeRates.set(cloudRates);
        this.writeToStorage(LOCAL_STORAGE_RATES_KEY, cloudRates);
      }
    } catch {
      // Keep local/default exchange rates silently if offline
    }
  }

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  private readFromStorage<T>(key: string): T | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private writeToStorage(key: string, value: unknown): boolean {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  private loadRecordsFromLocalStorage(): ReachCurveRecord[] {
    const cached = this.readFromStorage<ReachCurveRecord[]>(LOCAL_STORAGE_RECORDS_KEY);
    if (Array.isArray(cached)) {
      const normalized = cached.map((item) => this.normalizeRecordFromApi(item));
      this.records.set(normalized);
      return normalized;
    }
    return [];
  }

  private loadExchangeRatesFromLocalStorage(): ExchangeRateSettings {
    const cached = this.readFromStorage<ExchangeRateSettings>(LOCAL_STORAGE_RATES_KEY);
    if (cached && typeof cached === 'object') {
      const normalized: ExchangeRateSettings = {
        id: cached.id ?? 'global',
        cop_to_usd:
          Number(cached.cop_to_usd) > 0 ? Number(cached.cop_to_usd) : DEFAULT_RATES.cop_to_usd,
        mxn_to_usd:
          Number(cached.mxn_to_usd) > 0 ? Number(cached.mxn_to_usd) : DEFAULT_RATES.mxn_to_usd,
        updated_at: cached.updated_at,
      };
      this.exchangeRates.set(normalized);
      return normalized;
    }
    return this.exchangeRates();
  }

  private normalizeRecordFromApi(item: ReachCurveRecord): ReachCurveRecord {
    return {
      ...item,
      formato: item.formato || 'General',
      inversion: Number(item.inversion ?? 0),
      alcance: Number(item.alcance ?? 0),
      impresiones: Number(item.impresiones ?? 0),
      cpma: Number(item.cpma ?? 0),
      cpm_imp: Number(item.cpm_imp ?? 0),
    };
  }

  private async fetchAllRecordsFromCloud(): Promise<ReachCurveRecord[]> {
    const allRecords: ReachCurveRecord[] = [];
    let offset = 0;

    while (true) {
      const url =
        `${SUPABASE_URL}/reach_curve_records?select=*&order=record_key.asc` +
        `&limit=${FETCH_PAGE_SIZE}&offset=${offset}`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      const page = (await res.json()) as ReachCurveRecord[];
      if (!Array.isArray(page)) {
        throw new Error('Formato inesperado al consultar registros de curvas.');
      }
      for (const item of page) {
        allRecords.push(this.normalizeRecordFromApi(item));
      }
      if (page.length < FETCH_PAGE_SIZE) {
        break;
      }
      offset += FETCH_PAGE_SIZE;
    }

    return allRecords;
  }

  private async fetchExchangeRatesFromCloud(): Promise<ExchangeRateSettings | null> {
    const url = `${SUPABASE_URL}/reach_curve_settings?id=eq.global&select=*`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }
    const rows = (await res.json()) as ExchangeRateSettings[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      id: row.id ?? 'global',
      cop_to_usd: Number(row.cop_to_usd) > 0 ? Number(row.cop_to_usd) : DEFAULT_RATES.cop_to_usd,
      mxn_to_usd: Number(row.mxn_to_usd) > 0 ? Number(row.mxn_to_usd) : DEFAULT_RATES.mxn_to_usd,
      updated_at: row.updated_at,
    };
  }

  async loadRecords(): Promise<ReachCurveRecord[]> {
    this.isLoading.set(true);
    try {
      if (typeof fetch !== 'function') {
        throw new Error('Fetch no disponible en este entorno.');
      }
      const cloudRecords = await this.fetchAllRecordsFromCloud();
      this.records.set(cloudRecords);
      this.writeToStorage(LOCAL_STORAGE_RECORDS_KEY, cloudRecords);
      this.lastSyncStatus.set('synced');
      return cloudRecords;
    } catch (err) {
      console.warn('Fallback a caché local al cargar curvas de alcance:', err);
      const cached = this.readFromStorage<ReachCurveRecord[]>(LOCAL_STORAGE_RECORDS_KEY);
      if (Array.isArray(cached)) {
        const normalized = cached.map((item) => this.normalizeRecordFromApi(item));
        this.records.set(normalized);
        this.lastSyncStatus.set('local_only');
        return normalized;
      }
      this.lastSyncStatus.set(typeof localStorage !== 'undefined' ? 'local_only' : 'error');
      return this.records();
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadExchangeRates(): Promise<ExchangeRateSettings> {
    try {
      if (typeof fetch !== 'function') {
        throw new Error('Fetch no disponible en este entorno.');
      }
      const cloudRates = await this.fetchExchangeRatesFromCloud();
      if (cloudRates) {
        this.exchangeRates.set(cloudRates);
        this.writeToStorage(LOCAL_STORAGE_RATES_KEY, cloudRates);
        return cloudRates;
      }
      return this.exchangeRates();
    } catch (err) {
      console.warn('Fallback a caché local al cargar tasas de cambio:', err);
      const fallback = this.loadExchangeRatesFromLocalStorage();
      this.lastSyncStatus.set(typeof localStorage !== 'undefined' ? 'local_only' : 'error');
      return fallback;
    }
  }

  async upsertRecords(newRecords: ReachCurveRecord[]): Promise<ReachCurveRecord[]> {
    const dedupedMap = new Map<string, ReachCurveRecord>();
    for (const record of newRecords) {
      if (!record.record_key) {
        continue;
      }
      dedupedMap.set(record.record_key, record);
    }
    const dedupedBatch = Array.from(dedupedMap.values());
    if (dedupedBatch.length === 0) {
      return this.records();
    }

    this.isSaving.set(true);

    const mergedMap = new Map<string, ReachCurveRecord>();
    for (const existing of this.records()) {
      mergedMap.set(existing.record_key, existing);
    }
    for (const incoming of dedupedBatch) {
      mergedMap.set(incoming.record_key, incoming);
    }
    const mergedRecords = Array.from(mergedMap.values());
    this.records.set(mergedRecords);
    const savedLocally = this.writeToStorage(LOCAL_STORAGE_RECORDS_KEY, mergedRecords);

    try {
      if (typeof fetch !== 'function') {
        throw new Error('Fetch no disponible en este entorno.');
      }

      for (let start = 0; start < dedupedBatch.length; start += UPSERT_BATCH_SIZE) {
        const chunk = dedupedBatch.slice(start, start + UPSERT_BATCH_SIZE);
        const nowIso = new Date().toISOString();
        const payload = chunk.map((rec) => ({
          record_key: rec.record_key,
          periodo: rec.periodo,
          corte: rec.corte,
          plataforma: rec.plataforma,
          pais: rec.pais,
          stage: rec.stage,
          tipo_compra: rec.tipo_compra,
          formato: rec.formato || 'General',
          moneda: rec.moneda,
          campana_nombre: rec.campana_nombre,
          inversion: rec.inversion,
          alcance: rec.alcance,
          impresiones: rec.impresiones,
          cpma: rec.cpma,
          cpm_imp: rec.cpm_imp,
          source_file: rec.source_file ?? null,
          updated_at: nowIso,
        }));

        const res = await fetch(`${SUPABASE_URL}/reach_curve_records?on_conflict=record_key`, {
          method: 'POST',
          headers: this.getHeaders({
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
        }
      }

      this.lastSyncStatus.set('synced');
      return mergedRecords;
    } catch (err) {
      console.warn('Guardado completado en local, fallo al sincronizar en la nube:', err);
      this.lastSyncStatus.set(savedLocally ? 'local_only' : 'error');
      return mergedRecords;
    } finally {
      this.isSaving.set(false);
    }
  }

  async updateExchangeRates(settings: ExchangeRateSettings): Promise<ExchangeRateSettings> {
    const normalized: ExchangeRateSettings = {
      id: settings.id ?? 'global',
      cop_to_usd:
        Number(settings.cop_to_usd) > 0 ? Number(settings.cop_to_usd) : DEFAULT_RATES.cop_to_usd,
      mxn_to_usd:
        Number(settings.mxn_to_usd) > 0 ? Number(settings.mxn_to_usd) : DEFAULT_RATES.mxn_to_usd,
      updated_at: new Date().toISOString(),
    };

    this.isSaving.set(true);
    this.exchangeRates.set(normalized);
    const savedLocally = this.writeToStorage(LOCAL_STORAGE_RATES_KEY, normalized);

    try {
      if (typeof fetch !== 'function') {
        throw new Error('Fetch no disponible en este entorno.');
      }
      const res = await fetch(`${SUPABASE_URL}/reach_curve_settings?on_conflict=id`, {
        method: 'POST',
        headers: this.getHeaders({
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      this.lastSyncStatus.set('synced');
      return normalized;
    } catch (err) {
      console.warn('Tasas actualizadas en local, fallo al sincronizar en la nube:', err);
      this.lastSyncStatus.set(savedLocally ? 'local_only' : 'error');
      return normalized;
    } finally {
      this.isSaving.set(false);
    }
  }

  convertInvestment(
    amount: number,
    fromCurrency: CurveCurrency,
    toCurrency: CurveCurrency,
  ): number {
    if (!Number.isFinite(amount)) {
      return 0;
    }
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rates = this.exchangeRates();
    const copToUsd = rates.cop_to_usd > 0 ? rates.cop_to_usd : DEFAULT_RATES.cop_to_usd;
    const mxnToUsd = rates.mxn_to_usd > 0 ? rates.mxn_to_usd : DEFAULT_RATES.mxn_to_usd;

    let usdAmount: number;
    switch (fromCurrency) {
      case 'USD':
        usdAmount = amount;
        break;
      case 'COP':
        usdAmount = amount / copToUsd;
        break;
      case 'MXN':
        usdAmount = amount / mxnToUsd;
        break;
    }

    switch (toCurrency) {
      case 'USD':
        return usdAmount;
      case 'COP':
        return usdAmount * copToUsd;
      case 'MXN':
        return usdAmount * mxnToUsd;
    }
  }

  async parseExcelFiles(
    files: File[],
    selectedPlatform: UploadPlatformSource,
  ): Promise<ParseExcelFilesResult> {
    const XLSX = await import('xlsx');
    const allRecords: ReachCurveRecord[] = [];
    const summaries: FileParseSummary[] = [];

    for (const file of files) {
      const summary: FileParseSummary = {
        fileName: file.name,
        selectedPlatform,
        detectedPeriod: null,
        detectedCut: null,
        needsManualPeriodOrCut: false,
        totalRows: 0,
        validRecordsCount: 0,
        skippedRows: 0,
        errors: [],
      };

      let sheetRows: unknown[][];
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          summary.errors.push(`El archivo "${file.name}" no contiene hojas.`);
          summaries.push(summary);
          continue;
        }
        const sheet = workbook.Sheets[firstSheetName];
        if (!sheet) {
          summary.errors.push(`No se pudo leer la primera hoja del archivo "${file.name}".`);
          summaries.push(summary);
          continue;
        }
        sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
          raw: true,
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Error desconocido al leer Excel';
        summary.errors.push(`No se pudo procesar el archivo "${file.name}": ${detail}`);
        summaries.push(summary);
        continue;
      }

      const headerRowIndex = this.findHeaderRowIndex(sheetRows);
      if (headerRowIndex === -1) {
        summary.errors.push(`El archivo "${file.name}" está vacío o no tiene encabezados.`);
        summaries.push(summary);
        continue;
      }

      const headerMap = this.buildHeaderMap(sheetRows[headerRowIndex]);
      const validationError = this.validateHeadersForPlatform(
        headerMap,
        selectedPlatform,
        file.name,
      );
      if (validationError) {
        summary.errors.push(validationError);
        summaries.push(summary);
        continue;
      }

      const parsedFile = this.parsePlatformSheet(
        sheetRows,
        headerRowIndex,
        headerMap,
        file.name,
        selectedPlatform,
        summary,
      );

      allRecords.push(...parsedFile);
      summaries.push(summary);
    }

    return { records: allRecords, summaries };
  }

  assignManualPeriodAndCut(
    records: ReachCurveRecord[],
    fileName: string,
    periodo: string,
    corte: CurveCut,
  ): ReachCurveRecord[] {
    const cleanPeriod = periodo.trim();
    return records.map((record) => {
      if (record.source_file !== fileName) {
        return record;
      }
      const keyParts = record.record_key.split('|');
      const suffix =
        keyParts.length >= 3
          ? keyParts.slice(2).join('|')
          : `${record.plataforma}|${record.pais}|${record.campana_nombre.trim()}`;

      return {
        ...record,
        periodo: cleanPeriod,
        corte,
        record_key: `${cleanPeriod}|${corte}|${suffix}`,
      };
    });
  }

  resolvePeriodAndCutFromDates(
    startDate: Date | string | number,
    endDate: Date | string | number,
  ): PeriodCutResult | null {
    const startUtc = this.parseDateToUtcMs(startDate);
    const endUtc = this.parseDateToUtcMs(endDate);
    if (startUtc === null || endUtc === null || endUtc < startUtc) {
      return null;
    }

    const inclusiveDays = Math.floor((endUtc - startUtc) / MS_PER_DAY) + 1;
    let corte: CurveCut;
    if (inclusiveDays <= 9) {
      corte = 'W1';
    } else if (inclusiveDays <= 17) {
      corte = 'W2';
    } else if (inclusiveDays <= 24) {
      corte = 'W3';
    } else {
      corte = 'W4';
    }

    const start = new Date(startUtc);
    const year = start.getUTCFullYear();
    const month = String(start.getUTCMonth() + 1).padStart(2, '0');
    return {
      periodo: `${year}-${month}`,
      corte,
    };
  }

  classifyCountry(text: string): CurveCountry | null {
    if (COUNTRY_EXCLUSION_REGEX.test(text)) {
      return null;
    }
    for (const rule of COUNTRY_RULES) {
      if (rule.pattern.test(text)) {
        return rule.country;
      }
    }
    return null;
  }

  classifyStage(text: string): CurveStage {
    for (const rule of STAGE_RULES) {
      if (rule.pattern.test(text)) {
        return rule.stage;
      }
    }
    return 'ATT';
  }

  classifyBuyType(text: string): CurveBuyType {
    for (const rule of BUY_TYPE_RULES) {
      if (rule.pattern.test(text)) {
        return rule.buyType;
      }
    }
    return 'CPM';
  }

  classifyDv360Format(text: string): {
    formato: string;
    plataforma: Extract<ReachCurvePlatform, 'YouTube' | 'Display'>;
  } {
    for (const rule of DV360_FORMAT_RULES) {
      if (rule.pattern.test(text)) {
        return { formato: rule.formato, plataforma: rule.plataforma };
      }
    }
    return { formato: 'General', plataforma: 'Display' };
  }

  getAvailableCombinations(pais: string): AvailableCombinationItem[] {
    const grouped = new Map<string, AvailableCombinationItem>();

    for (const record of this.records()) {
      if (record.pais !== pais || record.inversion <= 0 || record.alcance <= 0) {
        continue;
      }
      const key = `${record.plataforma}|${record.stage}|${record.tipo_compra}|${record.corte}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, {
          plataforma: record.plataforma,
          stage: record.stage,
          tipoCompra: record.tipo_compra,
          corte: record.corte,
          count: 1,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      const platformCmp = a.plataforma.localeCompare(b.plataforma);
      if (platformCmp !== 0) {
        return platformCmp;
      }
      const stageCmp = a.stage.localeCompare(b.stage);
      if (stageCmp !== 0) {
        return stageCmp;
      }
      const cutCmp = a.corte.localeCompare(b.corte);
      if (cutCmp !== 0) {
        return cutCmp;
      }
      return a.tipoCompra.localeCompare(b.tipoCompra);
    });
  }

  getAvailableFormats(pais: string, plataforma: CurvePlatformFilter): string[] {
    const formats = new Set<string>();

    for (const record of this.records()) {
      if (record.pais !== pais) {
        continue;
      }
      if (plataforma === 'DV360') {
        if (record.plataforma !== 'YouTube' && record.plataforma !== 'Display') {
          continue;
        }
      } else if (record.plataforma !== plataforma) {
        continue;
      }

      const formato = record.formato.trim();
      if (formato.length > 0) {
        formats.add(formato);
      }
    }

    const sorted = Array.from(formats).sort((a, b) => a.localeCompare(b));
    const specific = sorted.filter((fmt) => fmt !== 'General');
    return specific.length > 0 ? specific : sorted;
  }

  buildRegressionModel(params: RegressionQueryParams): RegressionModelResult {
    const universeCap = this.crossReachService.getCountryUniverse(params.pais);

    const filtered = this.records().filter((record) => {
      if (record.pais !== params.pais) {
        return false;
      }
      if (params.plataforma === 'DV360') {
        if (record.plataforma !== 'YouTube' && record.plataforma !== 'Display') {
          return false;
        }
      } else if (record.plataforma !== params.plataforma) {
        return false;
      }
      if (record.stage !== params.stage) {
        return false;
      }
      if (record.tipo_compra !== params.tipoCompra) {
        return false;
      }
      if (record.corte !== params.corte) {
        return false;
      }
      if (params.periodo && params.periodo.trim().length > 0 && record.periodo !== params.periodo) {
        return false;
      }
      const formatoFilter = params.formato?.trim();
      if (formatoFilter && formatoFilter !== 'ALL' && record.formato !== formatoFilter) {
        return false;
      }
      return record.inversion > 0 && record.alcance > 0;
    });

    const historicalPoints: RegressionPoint[] = filtered
      .map((record) => {
        const convertedInvestment = this.convertInvestment(
          record.inversion,
          record.moneda,
          params.currency,
        );
        const convertedCpma =
          record.alcance > 0 ? (convertedInvestment / record.alcance) * 1000 : 0;
        return {
          x: convertedInvestment,
          y: record.alcance,
          label: record.campana_nombre,
          periodo: record.periodo,
          impressions: record.impresiones,
          cpma: convertedCpma,
        };
      })
      .filter((pt) => Number.isFinite(pt.x) && pt.x > 0 && Number.isFinite(pt.y) && pt.y > 0)
      .sort((a, b) => a.x - b.x);

    const clampReach = (raw: number): number => {
      if (!Number.isFinite(raw)) {
        return 0;
      }
      const nonNegative = Math.max(0, raw);
      return universeCap > 0 ? Math.min(universeCap, nonNegative) : nonNegative;
    };

    const sampleSize = historicalPoints.length;

    if (sampleSize === 0) {
      const equationText =
        params.modelType === 'logarithmic' ? 'Y = 0 * ln(X) + 0' : 'Y = 0 * X + 0';
      return {
        modelType: params.modelType,
        slope: 0,
        intercept: 0,
        rSquared: 0,
        sampleSize: 0,
        equationText,
        universeCap,
        historicalPoints: [],
        curvePoints: [],
        predictReach: () => 0,
      };
    }

    let slope = 0;
    let intercept = 0;
    let rSquared = 0;

    if (sampleSize === 1) {
      const point = historicalPoints[0];
      if (params.modelType === 'logarithmic') {
        if (point.x > 1) {
          slope = point.y / Math.log(point.x);
          intercept = 0;
        } else {
          slope = 0;
          intercept = point.y;
        }
      } else {
        slope = point.y / point.x;
        intercept = 0;
      }
      rSquared = 0;
    } else {
      const transformedU = historicalPoints.map((pt) =>
        params.modelType === 'logarithmic' ? Math.log(pt.x) : pt.x,
      );
      const meanU = transformedU.reduce((sum, u) => sum + u, 0) / sampleSize;
      const meanY = historicalPoints.reduce((sum, pt) => sum + pt.y, 0) / sampleSize;

      let sUU = 0;
      let sUY = 0;
      let sYY = 0;

      for (let i = 0; i < sampleSize; i++) {
        const du = transformedU[i] - meanU;
        const dy = historicalPoints[i].y - meanY;
        sUU += du * du;
        sUY += du * dy;
        sYY += dy * dy;
      }

      if (sUU === 0) {
        slope = 0;
        intercept = meanY;
        rSquared = 0;
      } else {
        slope = sUY / sUU;
        intercept = meanY - slope * meanU;

        if (sYY > 0) {
          let ssRes = 0;
          for (let i = 0; i < sampleSize; i++) {
            const yHat = slope * transformedU[i] + intercept;
            const err = historicalPoints[i].y - yHat;
            ssRes += err * err;
          }
          const rawR2 = 1 - ssRes / sYY;
          rSquared = Math.min(1, Math.max(0, Number.isFinite(rawR2) ? rawR2 : 0));
        } else {
          rSquared = 0;
        }
      }
    }

    const predictReach = (investment: number): number => {
      if (!Number.isFinite(investment) || investment <= 0) {
        return 0;
      }
      const raw =
        params.modelType === 'logarithmic'
          ? slope * Math.log(investment) + intercept
          : slope * investment + intercept;
      return clampReach(raw);
    };

    const maxHistoricalX = historicalPoints[sampleSize - 1].x;
    const maxX =
      params.maxInvestment && params.maxInvestment > 0
        ? params.maxInvestment
        : maxHistoricalX * 1.5;

    const curvePoints: CurvePoint[] = [];
    for (let i = 0; i < CURVE_SAMPLE_COUNT; i++) {
      const x = (maxX * i) / (CURVE_SAMPLE_COUNT - 1);
      curvePoints.push({
        x,
        y: predictReach(x),
      });
    }

    const equationText = this.formatEquationText(params.modelType, slope, intercept);

    return {
      modelType: params.modelType,
      slope,
      intercept,
      rSquared,
      sampleSize,
      equationText,
      universeCap,
      historicalPoints,
      curvePoints,
      predictReach,
    };
  }

  private formatEquationText(
    modelType: 'logarithmic' | 'linear',
    slope: number,
    intercept: number,
  ): string {
    const slopeStr = Math.abs(slope) < 1 ? slope.toFixed(4) : slope.toFixed(2);
    const absInterceptStr = Math.abs(intercept).toFixed(2);
    const sign = intercept >= 0 ? '+' : '-';
    const term = modelType === 'logarithmic' ? 'ln(X)' : 'X';
    return `Y = ${slopeStr} * ${term} ${sign} ${absInterceptStr}`;
  }

  private findHeaderRowIndex(rows: unknown[][]): number {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (Array.isArray(row) && row.some((cell) => String(cell ?? '').trim().length > 0)) {
        return i;
      }
    }
    return -1;
  }

  private buildHeaderMap(headerRow: unknown[]): Map<string, number> {
    const map = new Map<string, number>();
    for (let col = 0; col < headerRow.length; col++) {
      const header = String(headerRow[col] ?? '')
        .trim()
        .toLowerCase();
      if (header.length > 0 && !map.has(header)) {
        map.set(header, col);
      }
    }
    return map;
  }

  private getHeaderCol(headerMap: Map<string, number>, name: string): number | undefined {
    return headerMap.get(name.toLowerCase());
  }

  private validateHeadersForPlatform(
    headerMap: Map<string, number>,
    platform: UploadPlatformSource,
    fileName: string,
  ): string | null {
    const missing: string[] = [];

    if (platform === 'Meta') {
      const required = ['Nombre de la campaña', 'Alcance', 'Impresiones'];
      for (const col of required) {
        if (this.getHeaderCol(headerMap, col) === undefined) {
          missing.push(col);
        }
      }
      if (
        this.getHeaderCol(headerMap, 'Monto gastado (COP)') === undefined &&
        this.getHeaderCol(headerMap, 'Monto gastado (MXN)') === undefined
      ) {
        missing.push('Monto gastado (COP) o Monto gastado (MXN)');
      }
    } else if (platform === 'TikTok') {
      const required = ['Campaign name', 'Spend', 'Reach', 'Impressions', 'Currency'];
      for (const col of required) {
        if (this.getHeaderCol(headerMap, col) === undefined) {
          missing.push(col);
        }
      }
    } else {
      const required = [
        'Campaign',
        'Insertion Order',
        'Advertiser Currency',
        'Total Media Cost (Advertiser Currency)',
        'Unique Reach: Total Reach',
        'Impressions',
      ];
      for (const col of required) {
        if (this.getHeaderCol(headerMap, col) === undefined) {
          missing.push(col);
        }
      }
    }

    if (missing.length > 0) {
      return `Estructura inválida para ${platform} en "${fileName}". Faltan columnas: ${missing.join(', ')}.`;
    }
    return null;
  }

  private parsePlatformSheet(
    rows: unknown[][],
    headerRowIndex: number,
    headerMap: Map<string, number>,
    fileName: string,
    platform: UploadPlatformSource,
    summary: FileParseSummary,
  ): ReachCurveRecord[] {
    const internalPeriodCut = this.detectInternalPeriodAndCut(
      rows,
      headerRowIndex,
      headerMap,
      platform,
    );
    const resolvedPeriodCut = internalPeriodCut ?? this.detectPeriodAndCutFromFilename(fileName);

    if (resolvedPeriodCut) {
      summary.detectedPeriod = resolvedPeriodCut.periodo;
      summary.detectedCut = resolvedPeriodCut.corte;
      summary.needsManualPeriodOrCut = false;
    } else {
      summary.detectedPeriod = null;
      summary.detectedCut = null;
      summary.needsManualPeriodOrCut = true;
    }

    const effectivePeriod = resolvedPeriodCut?.periodo ?? 'PENDING';
    const effectiveCut: CurveCut = resolvedPeriodCut?.corte ?? 'W1';

    if (platform === 'Meta') {
      return this.parseMetaRows(
        rows,
        headerRowIndex,
        headerMap,
        fileName,
        effectivePeriod,
        effectiveCut,
        summary,
      );
    }

    if (platform === 'TikTok') {
      return this.parseTikTokRows(
        rows,
        headerRowIndex,
        headerMap,
        fileName,
        effectivePeriod,
        effectiveCut,
        summary,
      );
    }

    return this.parseDv360Rows(
      rows,
      headerRowIndex,
      headerMap,
      fileName,
      effectivePeriod,
      effectiveCut,
      summary,
    );
  }

  private detectInternalPeriodAndCut(
    rows: unknown[][],
    headerRowIndex: number,
    headerMap: Map<string, number>,
    platform: UploadPlatformSource,
  ): PeriodCutResult | null {
    if (platform === 'Meta') {
      const startIdx = this.getHeaderCol(headerMap, 'Inicio del informe');
      const endIdx = this.getHeaderCol(headerMap, 'Fin del informe');
      if (startIdx === undefined || endIdx === undefined) {
        return null;
      }
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) {
          continue;
        }
        const rawStart = row[startIdx];
        const rawEnd = row[endIdx];
        if (this.isEmptyCell(rawStart) || this.isEmptyCell(rawEnd)) {
          continue;
        }
        if (!this.isDateInput(rawStart) || !this.isDateInput(rawEnd)) {
          continue;
        }
        const parsed = this.resolvePeriodAndCutFromDates(rawStart, rawEnd);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    }

    if (platform === 'DV360') {
      const campaignIdx = this.getHeaderCol(headerMap, 'Campaign');
      const ioIdx = this.getHeaderCol(headerMap, 'Insertion Order');
      if (campaignIdx === undefined || ioIdx === undefined) {
        return null;
      }
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) {
          continue;
        }
        const campaignLabel = String(row[campaignIdx] ?? '').trim();
        if (/^Date\s*Range:?$/i.test(campaignLabel)) {
          const ioRangeText = String(row[ioIdx] ?? '').trim();
          const match = ioRangeText.match(
            /(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})(?:\s+(?:to|al|hasta)\s+|\s*-\s*)(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
          );
          if (match) {
            const parsed = this.resolvePeriodAndCutFromDates(match[1], match[2]);
            if (parsed) {
              return parsed;
            }
          }
        }
      }
    }

    return null;
  }

  private detectPeriodAndCutFromFilename(fileName: string): PeriodCutResult | null {
    const dateRangeMatch = fileName.match(/(\d{8})-(\d{8})/);
    if (dateRangeMatch) {
      const parsed = this.resolvePeriodAndCutFromDates(dateRangeMatch[1], dateRangeMatch[2]);
      if (parsed) {
        return parsed;
      }
    }

    const monthCutMatch = fileName.match(FILENAME_MONTH_CUT_REGEX);
    if (monthCutMatch) {
      const monthKey = this.stripAccents(monthCutMatch[1].toLowerCase());
      const monthNumber = MONTH_NAME_MAP[monthKey];
      const cutUpper = monthCutMatch[2].toUpperCase();
      const year = monthCutMatch[3];
      if (monthNumber && this.isCurveCut(cutUpper)) {
        return {
          periodo: `${year}-${monthNumber}`,
          corte: cutUpper,
        };
      }
    }

    return null;
  }

  private buildClassifiedRecord(input: RecordBuildInput): ReachCurveRecord | null {
    const pais = this.classifyCountry(input.classificationText);
    if (!pais) {
      return null;
    }

    const stage = this.classifyStage(input.classificationText);
    const tipoCompra = this.classifyBuyType(input.classificationText);
    const cpma = (input.inversion / input.alcance) * 1000;
    const cpmImp = input.impresiones > 0 ? (input.inversion / input.impresiones) * 1000 : 0;

    return {
      record_key: `${input.periodo}|${input.corte}|${input.plataforma}|${pais}|${input.uniqueIdentifier}`,
      periodo: input.periodo,
      corte: input.corte,
      plataforma: input.plataforma,
      pais,
      stage,
      tipo_compra: tipoCompra,
      formato: input.formato,
      moneda: input.moneda,
      campana_nombre: input.campanaNombre,
      inversion: input.inversion,
      alcance: input.alcance,
      impresiones: input.impresiones,
      cpma,
      cpm_imp: cpmImp,
      source_file: input.sourceFile,
    };
  }

  private parseMetaRows(
    rows: unknown[][],
    headerRowIndex: number,
    headerMap: Map<string, number>,
    fileName: string,
    periodo: string,
    corte: CurveCut,
    summary: FileParseSummary,
  ): ReachCurveRecord[] {
    const campaignIdx = this.getHeaderCol(headerMap, 'Nombre de la campaña')!;
    const reachIdx = this.getHeaderCol(headerMap, 'Alcance')!;
    const impressionsIdx = this.getHeaderCol(headerMap, 'Impresiones')!;
    const copIdx = this.getHeaderCol(headerMap, 'Monto gastado (COP)');
    const mxnIdx = this.getHeaderCol(headerMap, 'Monto gastado (MXN)');

    const records: ReachCurveRecord[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || this.isRowCompletelyBlank(row)) {
        continue;
      }

      summary.totalRows++;

      const campanaNombre = String(row[campaignIdx] ?? '').trim();
      if (campanaNombre.length === 0 || campanaNombre.toLowerCase() === 'resultados totales') {
        summary.skippedRows++;
        continue;
      }

      let inversion = 0;
      let moneda: RecordCurrency = copIdx !== undefined ? 'COP' : 'MXN';

      if (copIdx !== undefined && mxnIdx !== undefined) {
        const copVal = this.parseNumericValue(row[copIdx]);
        const mxnVal = this.parseNumericValue(row[mxnIdx]);
        if (copVal > 0) {
          inversion = copVal;
          moneda = 'COP';
        } else {
          inversion = mxnVal;
          moneda = 'MXN';
        }
      } else if (copIdx !== undefined) {
        inversion = this.parseNumericValue(row[copIdx]);
        moneda = 'COP';
      } else if (mxnIdx !== undefined) {
        inversion = this.parseNumericValue(row[mxnIdx]);
        moneda = 'MXN';
      }

      const alcance = this.parseNumericValue(row[reachIdx]);
      const impresiones = Math.max(0, this.parseNumericValue(row[impressionsIdx]));

      if (inversion <= 0 || alcance <= 0) {
        summary.skippedRows++;
        continue;
      }

      const built = this.buildClassifiedRecord({
        periodo,
        corte,
        plataforma: 'Meta',
        formato: 'General',
        moneda,
        campanaNombre,
        uniqueIdentifier: campanaNombre,
        classificationText: campanaNombre,
        inversion,
        alcance,
        impresiones,
        sourceFile: fileName,
      });

      if (!built) {
        summary.skippedRows++;
        continue;
      }

      records.push(built);
      summary.validRecordsCount++;
    }

    return records;
  }

  private parseTikTokRows(
    rows: unknown[][],
    headerRowIndex: number,
    headerMap: Map<string, number>,
    fileName: string,
    periodo: string,
    corte: CurveCut,
    summary: FileParseSummary,
  ): ReachCurveRecord[] {
    const campaignIdx = this.getHeaderCol(headerMap, 'Campaign name')!;
    const spendIdx = this.getHeaderCol(headerMap, 'Spend')!;
    const reachIdx = this.getHeaderCol(headerMap, 'Reach')!;
    const impressionsIdx = this.getHeaderCol(headerMap, 'Impressions')!;
    const currencyIdx = this.getHeaderCol(headerMap, 'Currency')!;

    const records: ReachCurveRecord[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || this.isRowCompletelyBlank(row)) {
        continue;
      }

      summary.totalRows++;

      const campanaNombre = String(row[campaignIdx] ?? '').trim();
      if (campanaNombre.length === 0 || /^total\s+of\b/i.test(campanaNombre)) {
        summary.skippedRows++;
        continue;
      }

      const inversion = this.parseNumericValue(row[spendIdx]);
      const alcance = this.parseNumericValue(row[reachIdx]);
      const impresiones = Math.max(0, this.parseNumericValue(row[impressionsIdx]));

      if (inversion <= 0 || alcance <= 0) {
        summary.skippedRows++;
        continue;
      }

      const rawCurrency = String(row[currencyIdx] ?? '')
        .trim()
        .toUpperCase();
      if (!this.isRecordCurrency(rawCurrency)) {
        summary.skippedRows++;
        continue;
      }

      const built = this.buildClassifiedRecord({
        periodo,
        corte,
        plataforma: 'TikTok',
        formato: 'General',
        moneda: rawCurrency,
        campanaNombre,
        uniqueIdentifier: campanaNombre,
        classificationText: campanaNombre,
        inversion,
        alcance,
        impresiones,
        sourceFile: fileName,
      });

      if (!built) {
        summary.skippedRows++;
        continue;
      }

      records.push(built);
      summary.validRecordsCount++;
    }

    return records;
  }

  private parseDv360Rows(
    rows: unknown[][],
    headerRowIndex: number,
    headerMap: Map<string, number>,
    fileName: string,
    periodo: string,
    corte: CurveCut,
    summary: FileParseSummary,
  ): ReachCurveRecord[] {
    const campaignIdx = this.getHeaderCol(headerMap, 'Campaign')!;
    const ioIdx = this.getHeaderCol(headerMap, 'Insertion Order')!;
    const currencyIdx = this.getHeaderCol(headerMap, 'Advertiser Currency')!;
    const costIdx = this.getHeaderCol(headerMap, 'Total Media Cost (Advertiser Currency)')!;
    const reachIdx = this.getHeaderCol(headerMap, 'Unique Reach: Total Reach')!;
    const impressionsIdx = this.getHeaderCol(headerMap, 'Impressions')!;

    const records: ReachCurveRecord[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) {
        break;
      }

      const campaign = String(row[campaignIdx] ?? '').trim();
      const campaignLower = campaign.toLowerCase();
      if (
        campaign.length === 0 ||
        DV360_STOP_PREFIXES.some((prefix) => campaignLower.startsWith(prefix))
      ) {
        break;
      }

      summary.totalRows++;

      const insertionOrder = String(row[ioIdx] ?? '').trim();
      const rawReach = String(row[reachIdx] ?? '').trim();
      if (rawReach === '-' || rawReach === '0' || rawReach.length === 0) {
        summary.skippedRows++;
        continue;
      }

      const alcance = this.parseNumericValue(row[reachIdx]);
      const inversion = this.parseNumericValue(row[costIdx]);
      const impresiones = Math.max(0, this.parseNumericValue(row[impressionsIdx]));

      if (alcance <= 0 || inversion <= 0) {
        summary.skippedRows++;
        continue;
      }

      const rawCurrency = String(row[currencyIdx] ?? '')
        .trim()
        .toUpperCase();
      if (!this.isRecordCurrency(rawCurrency)) {
        summary.skippedRows++;
        continue;
      }

      const combinedText = `${campaign} ${insertionOrder}`.trim();
      const { formato, plataforma } = this.classifyDv360Format(combinedText);
      const campanaNombre =
        insertionOrder.length > 0 ? `${campaign} - ${insertionOrder}` : campaign;

      const built = this.buildClassifiedRecord({
        periodo,
        corte,
        plataforma,
        formato,
        moneda: rawCurrency,
        campanaNombre,
        uniqueIdentifier: `${campaign}::${insertionOrder}`,
        classificationText: combinedText,
        inversion,
        alcance,
        impresiones,
        sourceFile: fileName,
      });

      if (!built) {
        summary.skippedRows++;
        continue;
      }

      records.push(built);
      summary.validRecordsCount++;
    }

    return records;
  }

  private parseDateToUtcMs(value: Date | string | number): number | null {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      const adjusted =
        value.getUTCHours() === 23 && value.getUTCMinutes() === 59 && value.getUTCSeconds() >= 59
          ? new Date(value.getTime() + 1000)
          : value;
      return Date.UTC(adjusted.getUTCFullYear(), adjusted.getUTCMonth(), adjusted.getUTCDate());
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 1) {
        return null;
      }
      const serialDays = Math.floor(value + EXCEL_SERIAL_EPSILON);
      return (serialDays - 25569) * MS_PER_DAY;
    }

    const trimmed = String(value).trim();
    if (trimmed.length === 0) {
      return null;
    }

    const yyyymmddMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmddMatch) {
      return this.buildValidatedUtcMs(
        Number(yyyymmddMatch[1]),
        Number(yyyymmddMatch[2]),
        Number(yyyymmddMatch[3]),
      );
    }

    if (/^\d{1,6}(?:\.\d+)?$/.test(trimmed)) {
      const serial = Number(trimmed);
      if (Number.isFinite(serial) && serial >= 1) {
        return (Math.floor(serial + EXCEL_SERIAL_EPSILON) - 25569) * MS_PER_DAY;
      }
    }

    const isoOrSlashYmdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s].*)?$/);
    if (isoOrSlashYmdMatch) {
      return this.buildValidatedUtcMs(
        Number(isoOrSlashYmdMatch[1]),
        Number(isoOrSlashYmdMatch[2]),
        Number(isoOrSlashYmdMatch[3]),
      );
    }

    const dmyOrMdyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyOrMdyMatch) {
      const first = Number(dmyOrMdyMatch[1]);
      const second = Number(dmyOrMdyMatch[2]);
      const year = Number(dmyOrMdyMatch[3]);
      if (second > 12) {
        return this.buildValidatedUtcMs(year, first, second);
      }
      return this.buildValidatedUtcMs(year, second, first);
    }

    const parsedTimestamp = Date.parse(trimmed);
    if (!Number.isNaN(parsedTimestamp)) {
      const dt = new Date(parsedTimestamp);
      return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    }

    return null;
  }

  private buildValidatedUtcMs(year: number, month: number, day: number): number | null {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const utcMs = Date.UTC(year, month - 1, day);
    const check = new Date(utcMs);
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }
    return utcMs;
  }

  private parseNumericValue(raw: unknown): number {
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : 0;
    }
    if (typeof raw !== 'string') {
      return 0;
    }

    let cleaned = raw.trim();
    if (cleaned.length === 0 || cleaned === '-' || cleaned === '--') {
      return 0;
    }

    cleaned = cleaned.replace(/[$€£¥\s]/g, '').replace(/(?:COP|MXN|USD)/gi, '');
    if (cleaned.length === 0) {
      return 0;
    }

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasComma) {
      if (/^-?\d{1,3}(?:,\d{3})+$/.test(cleaned)) {
        cleaned = cleaned.replace(/,/g, '');
      } else if (/^-?\d+,\d{1,2}$/.test(cleaned)) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isRowCompletelyBlank(row: unknown[]): boolean {
    return row.every((cell) => this.isEmptyCell(cell));
  }

  private isEmptyCell(cell: unknown): boolean {
    return cell === null || cell === undefined || String(cell).trim().length === 0;
  }

  private isDateInput(value: unknown): value is Date | string | number {
    return value instanceof Date || typeof value === 'string' || typeof value === 'number';
  }

  private isCurveCut(value: string): value is CurveCut {
    return value === 'W1' || value === 'W2' || value === 'W3' || value === 'W4';
  }

  private isRecordCurrency(value: string): value is RecordCurrency {
    return value === 'COP' || value === 'MXN';
  }

  private stripAccents(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}

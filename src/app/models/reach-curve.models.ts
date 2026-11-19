export type UploadPlatformSource = 'Meta' | 'TikTok' | 'DV360';

export type ReachCurvePlatform = 'Meta' | 'TikTok' | 'YouTube' | 'Display';

export type CurvePlatformFilter = ReachCurvePlatform | 'DV360';

export type CurveCut = 'W1' | 'W2' | 'W3' | 'W4';

export type CurveCountry = 'Colombia' | 'Mexico' | 'Chile' | 'Peru' | 'Costa Rica';

export type CurveStage = 'ATT' | 'CON' | 'LOY' | 'PUR';

export type CurveBuyType = 'CPM' | 'CPV' | 'CPC' | 'CPE' | 'CPL' | 'CPA';

export type CurveCurrency = 'COP' | 'MXN' | 'USD';

export type RecordCurrency = 'COP' | 'MXN';

export type CurveModelType = 'logarithmic' | 'linear';

export type CurveSyncStatus = 'synced' | 'local_only' | 'error';

export interface ReachCurveRecord {
  id?: string;
  record_key: string;
  periodo: string;
  corte: CurveCut;
  plataforma: ReachCurvePlatform;
  pais: CurveCountry;
  stage: CurveStage;
  tipo_compra: CurveBuyType;
  formato: string;
  moneda: RecordCurrency;
  campana_nombre: string;
  inversion: number;
  alcance: number;
  impresiones: number;
  cpma: number;
  cpm_imp: number;
  source_file?: string | null;
  updated_at?: string;
}

export interface ExchangeRateSettings {
  id?: string;
  cop_to_usd: number;
  mxn_to_usd: number;
  updated_at?: string;
}

export interface FileParseSummary {
  fileName: string;
  selectedPlatform: UploadPlatformSource;
  detectedPeriod: string | null;
  detectedCut: CurveCut | null;
  needsManualPeriodOrCut: boolean;
  totalRows: number;
  validRecordsCount: number;
  skippedRows: number;
  errors: string[];
}

export interface ParseExcelFilesResult {
  records: ReachCurveRecord[];
  summaries: FileParseSummary[];
}

export interface RegressionPoint {
  x: number;
  y: number;
  label: string;
  periodo: string;
  impressions: number;
  cpma: number;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface RegressionModelResult {
  modelType: CurveModelType;
  slope: number;
  intercept: number;
  rSquared: number;
  sampleSize: number;
  equationText: string;
  universeCap: number;
  historicalPoints: RegressionPoint[];
  curvePoints: CurvePoint[];
  predictReach: (investment: number) => number;
}

export interface RegressionQueryParams {
  pais: CurveCountry;
  plataforma: CurvePlatformFilter;
  stage: CurveStage;
  tipoCompra: CurveBuyType;
  corte: CurveCut;
  currency: CurveCurrency;
  modelType: CurveModelType;
  periodo?: string | null;
  formato?: string | null;
  maxInvestment?: number;
}

export interface AvailableCombinationItem {
  plataforma: ReachCurvePlatform;
  stage: CurveStage;
  tipoCompra: CurveBuyType;
  corte: CurveCut;
  count: number;
}

export interface MatrixProjectionPlatform {
  platformId: string;
  reach: number;
}

export interface SendProjectionToMatrixPayload {
  country: CurveCountry;
  platforms: MatrixProjectionPlatform[];
}

export interface PlatformFreshnessItem {
  readonly platform: ReachCurvePlatform;
  readonly latestPeriodRaw: string | null;
  readonly latestPeriodLabel: string;
  readonly recordsCount: number;
}

export interface ReachCurveFreshness {
  readonly hasData: boolean;
  readonly latestPeriodRaw: string | null;
  readonly latestPeriodLabel: string;
  readonly lastUpdatedAt: string | null;
  readonly lastUpdatedLabel: string;
  readonly byPlatform: readonly PlatformFreshnessItem[];
}

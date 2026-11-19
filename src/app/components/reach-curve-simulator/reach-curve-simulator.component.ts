import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Alert02Icon,
  Analytics02Icon,
  ArrowUpRight01Icon,
  Calendar01Icon,
  ChartBarLineIcon,
  ChartLineData02Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Download01Icon,
  Exchange01Icon,
  Globe02Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import * as echarts from 'echarts/core';
import {
  BarChart,
  type BarSeriesOption,
  LineChart,
  type LineSeriesOption,
  ScatterChart,
  type ScatterSeriesOption,
} from 'echarts/charts';
import {
  GridComponent,
  type GridComponentOption,
  LegendComponent,
  type LegendComponentOption,
  MarkLineComponent,
  type MarkLineComponentOption,
  MarkPointComponent,
  type MarkPointComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { PLATFORM_COLORS } from '../../models/platform.models';
import {
  AvailableCombinationItem,
  CurveBuyType,
  CurveCountry,
  CurveCurrency,
  CurveCut,
  CurveModelType,
  CurvePlatformFilter,
  CurveStage,
  MatrixProjectionPlatform,
  PeriodOptionItem,
  ReachCurvePlatform,
  RecordCurrency,
  RegressionModelResult,
  SendProjectionToMatrixPayload,
} from '../../models/reach-curve.models';
import { CrossReachService } from '../../services/cross-reach.service';
import { ReachCurveService } from '../../services/reach-curve.service';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';

echarts.use([
  LineChart,
  ScatterChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
]);

type SimulatorChartOption = echarts.ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | MarkPointComponentOption
>;

export type SimulatorSubMode = 'individual' | 'mix';
export type SimulationCurrencyMode = 'LOCAL' | 'USD';
export type MixBuyType = 'CPM' | 'CPV' | 'CPC';
export type R2ReliabilityLevel = 'high' | 'medium' | 'low';

export interface CutOptionItem {
  readonly value: CurveCut;
  readonly label: string;
  readonly detail: string;
}

export interface StageOptionItem {
  readonly value: CurveStage;
  readonly label: string;
}

export interface BuyTypeOptionStatus {
  readonly buyType: CurveBuyType;
  readonly count: number;
  readonly hasData: boolean;
}

export interface SensitivityScenarioRow {
  readonly id: string;
  readonly label: string;
  readonly multiplier: number;
  readonly isBase: boolean;
  readonly investment: number;
  readonly projectedReach: number;
  readonly universePct: number;
  readonly projectedCpma: number;
  readonly diffVsBase: number;
}

export interface MixChannelConfig {
  readonly platform: ReachCurvePlatform;
  readonly enabled: boolean;
  readonly buyType: MixBuyType;
  readonly budget: number;
}

export interface MixChannelEvaluation {
  readonly platform: ReachCurvePlatform;
  readonly enabled: boolean;
  readonly buyType: MixBuyType;
  readonly budget: number;
  readonly model: RegressionModelResult;
  readonly hasData: boolean;
  readonly projectedReach: number;
  readonly cpma: number;
  readonly rSquaredPercent: number;
  readonly reliabilityLevel: R2ReliabilityLevel;
  readonly availableBuyTypes: readonly MixBuyType[];
}

export interface MixSummaryMetrics {
  readonly totalInvestment: number;
  readonly grossReach: number;
  readonly netCrossReach: number;
  readonly netPenetrationPct: number;
  readonly duplicatesPrevented: number;
  readonly deduplicationEfficiencyPct: number;
  readonly netCpma: number;
  readonly activeModeledCount: number;
}

const SIMULATOR_COUNTRIES: readonly CurveCountry[] = [
  'Colombia',
  'Mexico',
  'Chile',
  'Peru',
  'Costa Rica',
];

const SIMULATOR_STAGES: readonly StageOptionItem[] = [
  { value: 'ATT', label: 'ATT · Awareness' },
  { value: 'CON', label: 'CON · Consideration' },
  { value: 'PUR', label: 'PUR · Purchase' },
  { value: 'LOY', label: 'LOY · Loyalty' },
];

const SIMULATOR_CUTS: readonly CutOptionItem[] = [
  { value: 'W1', label: 'W1', detail: '7d' },
  { value: 'W2', label: 'W2', detail: '14d' },
  { value: 'W3', label: 'W3', detail: '21d' },
  { value: 'W4', label: 'W4', detail: 'Mes cerrado' },
];

const CUT_AUTO_PRIORITY: readonly CurveCut[] = ['W4', 'W3', 'W2', 'W1'];

const INDIVIDUAL_PLATFORMS: readonly CurvePlatformFilter[] = [
  'Meta',
  'TikTok',
  'YouTube',
  'Display',
  'DV360',
];

const INDIVIDUAL_BUY_TYPES: readonly CurveBuyType[] = ['CPM', 'CPV', 'CPC', 'CPE', 'CPL', 'CPA'];

const MIX_PLATFORMS: readonly ReachCurvePlatform[] = ['Meta', 'TikTok', 'YouTube', 'Display'];

const MIX_BUY_TYPES: readonly MixBuyType[] = ['CPM', 'CPV', 'CPC'];

const CHART_FONT_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

const SCENARIO_FACTORS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly multiplier: number;
  readonly isBase: boolean;
}> = [
  { id: 'minus-50', label: '-50%', multiplier: 0.5, isBase: false },
  { id: 'minus-25', label: '-25%', multiplier: 0.75, isBase: false },
  { id: 'base', label: 'Presupuesto Base (100%)', multiplier: 1, isBase: true },
  { id: 'plus-25', label: '+25%', multiplier: 1.25, isBase: false },
  { id: 'plus-50', label: '+50%', multiplier: 1.5, isBase: false },
];

/**
 * Interactive reach curve simulator supporting individual regression curves
 * with sensitivity analysis and multi-platform cross-channel mix deduplication.
 */
@Component({
  selector: 'app-reach-curve-simulator',
  standalone: true,
  imports: [FormsModule, HugeiconsIconComponent, PlatformIconComponent],
  templateUrl: './reach-curve-simulator.component.html',
  styleUrl: './reach-curve-simulator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReachCurveSimulatorComponent {
  readonly reachCurveService = inject(ReachCurveService);
  readonly crossReachService = inject(CrossReachService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sendProjectionToMatrix = output<SendProjectionToMatrixPayload>();

  // Hugeicons references
  readonly ChartLineData02Icon = ChartLineData02Icon;
  readonly ChartBarLineIcon = ChartBarLineIcon;
  readonly Analytics02Icon = Analytics02Icon;
  readonly SlidersHorizontalIcon = SlidersHorizontalIcon;
  readonly Globe02Icon = Globe02Icon;
  readonly Calendar01Icon = Calendar01Icon;
  readonly Exchange01Icon = Exchange01Icon;
  readonly Download01Icon = Download01Icon;
  readonly Copy01Icon = Copy01Icon;
  readonly ArrowUpRight01Icon = ArrowUpRight01Icon;
  readonly Alert02Icon = Alert02Icon;
  readonly CheckmarkCircle02Icon = CheckmarkCircle02Icon;
  readonly SparklesIcon = SparklesIcon;
  readonly Tick02Icon = Tick02Icon;

  // Option catalogs
  readonly countries = SIMULATOR_COUNTRIES;
  readonly stages = SIMULATOR_STAGES;
  readonly cuts = SIMULATOR_CUTS;
  readonly individualPlatforms = INDIVIDUAL_PLATFORMS;
  readonly individualBuyTypes = INDIVIDUAL_BUY_TYPES;
  readonly mixBuyTypes = MIX_BUY_TYPES;

  // Chart container references
  private readonly individualChartContainer =
    viewChild<ElementRef<HTMLDivElement>>('individualChart');
  private readonly mixChartContainer = viewChild<ElementRef<HTMLDivElement>>('mixChart');

  // Top sub-mode state
  readonly activeSubMode = signal<SimulatorSubMode>('individual');

  // Global configuration bar state
  readonly selectedCountry = signal<CurveCountry>('Colombia');
  readonly selectedPeriod = signal<string>('ALL');
  readonly selectedStage = signal<CurveStage>('ATT');
  readonly selectedCut = signal<CurveCut>('W4');
  readonly modelType = signal<CurveModelType>('logarithmic');
  readonly currencyMode = signal<SimulationCurrencyMode>('LOCAL');

  // Individual mode state
  readonly selectedPlatform = signal<CurvePlatformFilter>('Meta');
  readonly selectedBuyType = signal<CurveBuyType>('CPM');
  readonly selectedFormat = signal<string>('ALL');
  readonly individualBudget = signal<number>(5_000_000);
  readonly tableCopiedFeedback = signal<boolean>(false);

  // Mix Cross-Channel mode state
  readonly mixRows = signal<readonly MixChannelConfig[]>(
    MIX_PLATFORMS.map((platform) => ({
      platform,
      enabled: true,
      buyType: 'CPM',
      budget: 5_000_000,
    })),
  );

  private userSelectedCut = false;
  private userEditedBudget = false;
  private lastSeededComboKey: string | null = null;
  private copiedFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  private individualChartInstance: echarts.ECharts | null = null;
  private individualResizeObserver: ResizeObserver | null = null;
  private individualResizeFrame: number | null = null;
  private mixChartInstance: echarts.ECharts | null = null;
  private mixResizeObserver: ResizeObserver | null = null;
  private mixResizeFrame: number | null = null;

  readonly localCurrencyCode = computed<RecordCurrency>(() =>
    this.selectedCountry() === 'Mexico' ? 'MXN' : 'COP',
  );

  readonly activeCurrency = computed<CurveCurrency>(() =>
    this.currencyMode() === 'USD' ? 'USD' : this.localCurrencyCode(),
  );

  readonly countryUniverse = computed<number>(() =>
    this.crossReachService.getCountryUniverse(this.selectedCountry()),
  );

  readonly availablePeriodOptions = computed<readonly PeriodOptionItem[]>(() =>
    this.reachCurveService.getAvailablePeriodOptions(this.selectedCountry()),
  );

  readonly activePeriodDisplayLabel = computed<string>(() => {
    const period = this.selectedPeriod();
    const matched = this.availablePeriodOptions().find((opt) => opt.value === period);
    if (matched) {
      return matched.label;
    }
    if (period.startsWith('YEAR:')) {
      return `Año ${period.slice(5).trim()}`;
    }
    return period === 'ALL' ? 'Todo el histórico (0 meses)' : period;
  });

  readonly hasAnyCountryRecords = computed<boolean>(() => {
    const country = this.selectedCountry();
    return this.reachCurveService
      .records()
      .some((record) => record.pais === country && record.inversion > 0 && record.alcance > 0);
  });

  readonly showFormatSelector = computed<boolean>(() => {
    const platform = this.selectedPlatform();
    return platform === 'YouTube' || platform === 'Display' || platform === 'DV360';
  });

  readonly availableFormats = computed<string[]>(() => {
    if (!this.showFormatSelector()) {
      return [];
    }
    return this.reachCurveService.getAvailableFormats(
      this.selectedCountry(),
      this.selectedPlatform(),
    );
  });

  readonly effectiveFormatFilter = computed<string | null>(() => {
    if (!this.showFormatSelector()) {
      return null;
    }
    const format = this.selectedFormat();
    return format === 'ALL' ? null : format;
  });

  readonly buyTypeAvailability = computed<readonly BuyTypeOptionStatus[]>(() => {
    const country = this.selectedCountry();
    const period = this.selectedPeriod();
    const platform = this.selectedPlatform();
    const stage = this.selectedStage();
    const cut = this.selectedCut();

    const counts = new Map<CurveBuyType, number>();
    for (const buyType of INDIVIDUAL_BUY_TYPES) {
      counts.set(buyType, 0);
    }

    for (const record of this.reachCurveService.records()) {
      if (record.pais !== country || record.stage !== stage || record.corte !== cut) {
        continue;
      }
      if (!this.reachCurveService.matchesPeriodFilter(record.periodo, period)) {
        continue;
      }
      if (!this.matchesPlatformFilter(record.plataforma, platform)) {
        continue;
      }
      if (record.inversion <= 0 || record.alcance <= 0) {
        continue;
      }
      counts.set(record.tipo_compra, (counts.get(record.tipo_compra) ?? 0) + 1);
    }

    return INDIVIDUAL_BUY_TYPES.map((buyType) => {
      const count = counts.get(buyType) ?? 0;
      return {
        buyType,
        count,
        hasData: count > 0,
      };
    });
  });

  readonly individualHistoricalStats = computed<{ count: number; maxX: number; medianX: number }>(
    () => {
      const country = this.selectedCountry();
      const period = this.selectedPeriod();
      const platform = this.selectedPlatform();
      const stage = this.selectedStage();
      const buyType = this.selectedBuyType();
      const cut = this.selectedCut();
      const format = this.effectiveFormatFilter();
      const currency = this.activeCurrency();

      const investments: number[] = [];

      for (const record of this.reachCurveService.records()) {
        if (
          record.pais !== country ||
          record.stage !== stage ||
          record.tipo_compra !== buyType ||
          record.corte !== cut
        ) {
          continue;
        }
        if (!this.reachCurveService.matchesPeriodFilter(record.periodo, period)) {
          continue;
        }
        if (!this.matchesPlatformFilter(record.plataforma, platform)) {
          continue;
        }
        if (format && record.formato !== format) {
          continue;
        }
        if (record.inversion <= 0 || record.alcance <= 0) {
          continue;
        }
        const converted = this.reachCurveService.convertInvestment(
          record.inversion,
          record.moneda,
          currency,
        );
        if (Number.isFinite(converted) && converted > 0) {
          investments.push(converted);
        }
      }

      if (investments.length === 0) {
        return { count: 0, maxX: 0, medianX: 0 };
      }

      investments.sort((a, b) => a - b);
      const maxX = investments[investments.length - 1];
      const medianX = investments[Math.floor(investments.length / 2)];
      return { count: investments.length, maxX, medianX };
    },
  );

  readonly sliderMax = computed<number>(() => {
    const histMax = this.individualHistoricalStats().maxX;
    const budget = this.individualBudget();
    const fallbackFloor = this.getDefaultBudgetFloor(this.activeCurrency());
    const baseMax = histMax > 0 ? histMax * 2.5 : fallbackFloor * 2.5;
    return Math.max(1, Math.ceil(Math.max(baseMax, budget * 1.25)));
  });

  readonly sliderStep = computed<number>(() => {
    const max = this.sliderMax();
    const currency = this.activeCurrency();
    if (currency === 'USD') {
      return Math.max(1, Math.round(max / 200));
    }
    return Math.max(100, Math.round(max / 200));
  });

  readonly individualModel = computed<RegressionModelResult>(() => {
    const histMax = this.individualHistoricalStats().maxX;
    const budget = this.individualBudget();
    const fallbackFloor = this.getDefaultBudgetFloor(this.activeCurrency());
    const chartMaxX = Math.max(histMax * 1.5, budget * 1.15, fallbackFloor);

    return this.reachCurveService.buildRegressionModel({
      pais: this.selectedCountry(),
      plataforma: this.selectedPlatform(),
      stage: this.selectedStage(),
      tipoCompra: this.selectedBuyType(),
      corte: this.selectedCut(),
      currency: this.activeCurrency(),
      modelType: this.modelType(),
      periodo: this.selectedPeriod(),
      formato: this.effectiveFormatFilter(),
      maxInvestment: chartMaxX,
    });
  });

  readonly projectedReach = computed<number>(() => {
    const model = this.individualModel();
    if (model.sampleSize === 0) {
      return 0;
    }
    return Math.round(model.predictReach(this.individualBudget()));
  });

  readonly projectedPenetrationPct = computed<number>(() => {
    const universe = this.countryUniverse();
    if (universe <= 0) {
      return 0;
    }
    return Math.min(100, (this.projectedReach() / universe) * 100);
  });

  readonly projectedCpma = computed<number>(() => {
    const reach = this.projectedReach();
    const budget = this.individualBudget();
    return reach > 0 && budget > 0 ? (budget / reach) * 1000 : 0;
  });

  readonly rSquaredPercent = computed<number>(
    () => Math.round(this.individualModel().rSquared * 1000) / 10,
  );

  readonly rSquaredLevel = computed<R2ReliabilityLevel>(() =>
    this.resolveReliabilityLevel(this.individualModel().rSquared),
  );

  readonly rSquaredStatusLabel = computed<string>(() => {
    const model = this.individualModel();
    if (model.sampleSize <= 1) {
      return 'Muestra insuficiente (n = 1)';
    }
    switch (this.rSquaredLevel()) {
      case 'high':
        return 'Alta confiabilidad';
      case 'medium':
        return 'Confiabilidad moderada';
      case 'low':
        return 'Baja confiabilidad';
    }
  });

  readonly sensitivityScenarios = computed<readonly SensitivityScenarioRow[]>(() => {
    const baseBudget = this.individualBudget();
    const model = this.individualModel();
    const universe = this.countryUniverse();
    const baseReach = model.sampleSize > 0 ? Math.round(model.predictReach(baseBudget)) : 0;

    return SCENARIO_FACTORS.map((factor) => {
      const investment = this.roundBudgetForCurrency(
        baseBudget * factor.multiplier,
        this.activeCurrency(),
      );
      const reach = model.sampleSize > 0 ? Math.round(model.predictReach(investment)) : 0;
      const universePct = universe > 0 ? Math.min(100, (reach / universe) * 100) : 0;
      const cpma = reach > 0 && investment > 0 ? (investment / reach) * 1000 : 0;
      return {
        id: factor.id,
        label: factor.label,
        multiplier: factor.multiplier,
        isBase: factor.isBase,
        investment,
        projectedReach: reach,
        universePct,
        projectedCpma: cpma,
        diffVsBase: reach - baseReach,
      };
    });
  });

  readonly availableCombinations = computed<readonly AvailableCombinationItem[]>(() =>
    this.reachCurveService.getAvailableCombinations(this.selectedCountry(), this.selectedPeriod()),
  );

  readonly resolvedIndividualTargetPlatform = computed<string>(() => {
    const platform = this.selectedPlatform();
    if (platform !== 'DV360') {
      return platform;
    }

    const format = this.effectiveFormatFilter();
    if (!format) {
      return 'DV360';
    }

    const country = this.selectedCountry();
    const period = this.selectedPeriod();
    const stage = this.selectedStage();
    const buyType = this.selectedBuyType();
    const cut = this.selectedCut();

    const subPlatforms = new Set<ReachCurvePlatform>();
    for (const record of this.reachCurveService.records()) {
      if (
        record.pais === country &&
        (record.plataforma === 'YouTube' || record.plataforma === 'Display') &&
        record.stage === stage &&
        record.tipo_compra === buyType &&
        record.corte === cut &&
        record.formato === format &&
        record.inversion > 0 &&
        record.alcance > 0 &&
        this.reachCurveService.matchesPeriodFilter(record.periodo, period)
      ) {
        subPlatforms.add(record.plataforma);
      }
    }

    if (subPlatforms.size === 1) {
      return Array.from(subPlatforms)[0];
    }
    return 'DV360';
  });

  // Mix Cross-Channel computed evaluations
  readonly mixEvaluations = computed<readonly MixChannelEvaluation[]>(() => {
    const country = this.selectedCountry();
    const period = this.selectedPeriod();
    const stage = this.selectedStage();
    const cut = this.selectedCut();
    const currency = this.activeCurrency();
    const modelType = this.modelType();
    const records = this.reachCurveService.records();

    return this.mixRows().map((row) => {
      const model = this.reachCurveService.buildRegressionModel({
        pais: country,
        plataforma: row.platform,
        stage,
        tipoCompra: row.buyType,
        corte: cut,
        currency,
        modelType,
        periodo: period,
      });

      const availableBuyTypes = MIX_BUY_TYPES.filter((buyType) =>
        records.some(
          (rec) =>
            rec.pais === country &&
            rec.plataforma === row.platform &&
            rec.stage === stage &&
            rec.corte === cut &&
            rec.tipo_compra === buyType &&
            rec.inversion > 0 &&
            rec.alcance > 0 &&
            this.reachCurveService.matchesPeriodFilter(rec.periodo, period),
        ),
      );

      const hasData = model.sampleSize > 0;
      const projectedReach =
        row.enabled && row.budget > 0 && hasData ? Math.round(model.predictReach(row.budget)) : 0;
      const cpma = projectedReach > 0 ? (row.budget / projectedReach) * 1000 : 0;

      return {
        platform: row.platform,
        enabled: row.enabled,
        buyType: row.buyType,
        budget: row.budget,
        model,
        hasData,
        projectedReach,
        cpma,
        rSquaredPercent: Math.round(model.rSquared * 1000) / 10,
        reliabilityLevel: this.resolveReliabilityLevel(model.rSquared),
        availableBuyTypes,
      };
    });
  });

  readonly activeModeledMixRows = computed<readonly MixChannelEvaluation[]>(() =>
    this.mixEvaluations().filter((row) => row.enabled && row.projectedReach > 0),
  );

  readonly mixSummary = computed<MixSummaryMetrics>(() => {
    const activeRows = this.activeModeledMixRows();
    const universe = this.countryUniverse();

    if (activeRows.length === 0 || universe <= 0) {
      return {
        totalInvestment: 0,
        grossReach: 0,
        netCrossReach: 0,
        netPenetrationPct: 0,
        duplicatesPrevented: 0,
        deduplicationEfficiencyPct: 0,
        netCpma: 0,
        activeModeledCount: 0,
      };
    }

    const totalInvestment = activeRows.reduce((sum, item) => sum + item.budget, 0);
    const grossReach = activeRows.reduce((sum, item) => sum + item.projectedReach, 0);
    const crossResult = this.crossReachService.calculateCrossReach(
      activeRows.map((item) => ({
        platformName: item.platform,
        reach: item.projectedReach,
      })),
      universe,
    );

    const duplicatesPrevented = Math.max(0, grossReach - crossResult.crossReach);
    const deduplicationEfficiencyPct =
      grossReach > 0 ? Math.round((duplicatesPrevented / grossReach) * 1000) / 10 : 0;
    const netCpma =
      crossResult.crossReach > 0 ? (totalInvestment / crossResult.crossReach) * 1000 : 0;

    return {
      totalInvestment,
      grossReach,
      netCrossReach: crossResult.crossReach,
      netPenetrationPct: crossResult.percentage,
      duplicatesPrevented,
      deduplicationEfficiencyPct,
      netCpma,
      activeModeledCount: activeRows.length,
    };
  });

  constructor() {
    // Auto-pick best available cut among ['W4','W3','W2','W1'] until user selects manually
    effect(() => {
      const records = this.reachCurveService.records();
      const country = this.selectedCountry();
      const period = this.selectedPeriod();
      if (this.userSelectedCut || records.length === 0) {
        return;
      }

      const preferredCut = CUT_AUTO_PRIORITY.find((cut) =>
        records.some(
          (rec) =>
            rec.pais === country &&
            rec.corte === cut &&
            rec.inversion > 0 &&
            rec.alcance > 0 &&
            this.reachCurveService.matchesPeriodFilter(rec.periodo, period),
        ),
      );
      if (preferredCut && preferredCut !== this.selectedCut()) {
        this.selectedCut.set(preferredCut);
      }
    });

    // Seed individual budget to the median historical spend for the active combo until user edits
    effect(() => {
      const stats = this.individualHistoricalStats();
      const currency = this.activeCurrency();
      const comboKey = [
        this.selectedCountry(),
        this.selectedPeriod(),
        this.selectedPlatform(),
        this.selectedStage(),
        this.selectedBuyType(),
        this.selectedCut(),
        this.effectiveFormatFilter() ?? 'ALL',
      ].join('|');

      if (!this.userEditedBudget && stats.count > 0 && this.lastSeededComboKey !== comboKey) {
        this.lastSeededComboKey = comboKey;
        this.individualBudget.set(this.roundBudgetForCurrency(stats.medianX, currency));
      }
    });

    // Render and reactively update Individual ECharts canvas
    effect(() => {
      const subMode = this.activeSubMode();
      const containerRef = this.individualChartContainer();
      const model = this.individualModel();
      const budget = this.individualBudget();
      const reach = this.projectedReach();
      const currency = this.activeCurrency();
      const platform = this.selectedPlatform();

      if (subMode !== 'individual' || !containerRef || model.sampleSize === 0) {
        this.disposeChart('individual');
        return;
      }

      const el = containerRef.nativeElement;
      if (this.individualChartInstance && this.individualChartInstance.getDom() !== el) {
        this.disposeChart('individual');
      }

      if (!this.individualChartInstance) {
        this.individualChartInstance = this.initChartSafely(el);
        if (this.individualChartInstance && typeof ResizeObserver !== 'undefined') {
          this.individualResizeObserver = new ResizeObserver(() => {
            this.resizeChartSafely(this.individualChartInstance, el);
          });
          this.individualResizeObserver.observe(el);
        }
      }

      if (this.individualChartInstance) {
        this.individualChartInstance.setOption(
          this.buildIndividualChartOption(model, budget, reach, currency, platform),
          { notMerge: true },
        );
        this.scheduleFrameResize('individual', el);
      }
    });

    // Render and reactively update Mix Cross-Channel ECharts canvas
    effect(() => {
      const subMode = this.activeSubMode();
      const containerRef = this.mixChartContainer();
      const activeRows = this.activeModeledMixRows();
      const summary = this.mixSummary();
      const universe = this.countryUniverse();

      if (subMode !== 'mix' || !containerRef || activeRows.length === 0) {
        this.disposeChart('mix');
        return;
      }

      const el = containerRef.nativeElement;
      if (this.mixChartInstance && this.mixChartInstance.getDom() !== el) {
        this.disposeChart('mix');
      }

      if (!this.mixChartInstance) {
        this.mixChartInstance = this.initChartSafely(el);
        if (this.mixChartInstance && typeof ResizeObserver !== 'undefined') {
          this.mixResizeObserver = new ResizeObserver(() => {
            this.resizeChartSafely(this.mixChartInstance, el);
          });
          this.mixResizeObserver.observe(el);
        }
      }

      if (this.mixChartInstance) {
        this.mixChartInstance.setOption(
          this.buildMixChartOption(activeRows, summary.netCrossReach, universe),
          { notMerge: true },
        );
        this.scheduleFrameResize('mix', el);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.disposeChart('individual');
      this.disposeChart('mix');
      if (this.copiedFeedbackTimer !== null) {
        clearTimeout(this.copiedFeedbackTimer);
        this.copiedFeedbackTimer = null;
      }
    });
  }

  setSubMode(mode: SimulatorSubMode): void {
    this.activeSubMode.set(mode);
  }

  setCountry(country: CurveCountry): void {
    const prevCurrency = this.activeCurrency();
    this.selectedCountry.set(country);
    const nextCurrency = this.activeCurrency();

    if (prevCurrency !== nextCurrency) {
      this.convertAllBudgets(prevCurrency, nextCurrency);
    }

    const currentPeriod = this.selectedPeriod();
    if (
      currentPeriod !== 'ALL' &&
      !this.availablePeriodOptions().some((opt) => opt.value === currentPeriod)
    ) {
      this.selectedPeriod.set('ALL');
    }

    const currentFormat = this.selectedFormat();
    if (currentFormat !== 'ALL' && !this.availableFormats().includes(currentFormat)) {
      this.selectedFormat.set('ALL');
    }
  }

  setPeriod(period: string): void {
    const normalized = typeof period === 'string' ? period.trim() : '';
    this.selectedPeriod.set(normalized.length > 0 ? normalized : 'ALL');
  }

  setStage(stage: CurveStage): void {
    this.selectedStage.set(stage);
  }

  setCut(cut: CurveCut): void {
    this.userSelectedCut = true;
    this.selectedCut.set(cut);
  }

  setModelType(type: CurveModelType): void {
    this.modelType.set(type);
  }

  setCurrencyMode(mode: SimulationCurrencyMode): void {
    const prevCurrency = this.activeCurrency();
    this.currencyMode.set(mode);
    const nextCurrency = this.activeCurrency();

    if (prevCurrency !== nextCurrency) {
      this.convertAllBudgets(prevCurrency, nextCurrency);
    }
  }

  setPlatform(platform: CurvePlatformFilter): void {
    this.selectedPlatform.set(platform);
    this.selectedFormat.set('ALL');
  }

  setBuyType(buyType: CurveBuyType): void {
    this.selectedBuyType.set(buyType);
  }

  setFormat(format: string): void {
    this.selectedFormat.set(format || 'ALL');
  }

  onIndividualBudgetChange(rawValue: number | string | null): void {
    this.userEditedBudget = true;
    this.individualBudget.set(this.sanitizeNonNegativeNumber(rawValue));
  }

  onIndividualSliderChange(rawValue: number | string | null): void {
    this.userEditedBudget = true;
    this.individualBudget.set(this.sanitizeNonNegativeNumber(rawValue));
  }

  applyAvailableCombination(combo: AvailableCombinationItem): void {
    this.userSelectedCut = true;
    this.userEditedBudget = false;
    this.lastSeededComboKey = null;
    this.selectedPlatform.set(combo.plataforma);
    this.selectedStage.set(combo.stage);
    this.selectedBuyType.set(combo.tipoCompra);
    this.selectedCut.set(combo.corte);
    this.selectedFormat.set('ALL');
  }

  toggleMixRowEnabled(platform: ReachCurvePlatform, enabled: boolean): void {
    this.mixRows.update((rows) =>
      rows.map((row) => (row.platform === platform ? { ...row, enabled } : row)),
    );
  }

  setMixRowBuyType(platform: ReachCurvePlatform, buyType: MixBuyType): void {
    this.mixRows.update((rows) =>
      rows.map((row) => (row.platform === platform ? { ...row, buyType } : row)),
    );
  }

  onMixRowBudgetChange(platform: ReachCurvePlatform, rawValue: number | string | null): void {
    const budget = this.sanitizeNonNegativeNumber(rawValue);
    this.mixRows.update((rows) =>
      rows.map((row) => (row.platform === platform ? { ...row, budget } : row)),
    );
  }

  downloadIndividualChartPng(): void {
    if (!this.individualChartInstance) {
      return;
    }
    const dataUrl = this.individualChartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    const countrySlug = this.selectedCountry().toLowerCase().replace(/\s+/g, '_');
    const periodSlug = this.selectedPeriod()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    link.download = `curva_${countrySlug}_${this.selectedPlatform().toLowerCase()}_${this.selectedCut()}_${periodSlug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async copySensitivityTable(): Promise<void> {
    const currency = this.activeCurrency();
    const header = [
      'Escenario',
      `Inversion (${currency})`,
      'Alcance Proyectado',
      '% Universo',
      `CPMa Proyectado (${currency})`,
      'Diferencia vs Base',
    ].join('\t');

    const lines = this.sensitivityScenarios().map((row) =>
      [
        row.label,
        this.formatInteger(row.investment),
        this.formatInteger(row.projectedReach),
        `${row.universePct.toFixed(2)}%`,
        this.formatCurrency(row.projectedCpma, currency, true),
        row.isBase ? 'Base' : this.formatReachDiff(row.diffVsBase),
      ].join('\t'),
    );

    const tsv = [header, ...lines].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tsv);
      } else {
        this.copyWithFallbackTextarea(tsv);
      }
      this.showCopiedFeedback();
    } catch {
      this.copyWithFallbackTextarea(tsv);
      this.showCopiedFeedback();
    }
  }

  emitIndividualToMatrix(): void {
    const reach = Math.round(this.projectedReach());
    if (reach <= 0) {
      return;
    }
    const platformId = this.resolvedIndividualTargetPlatform();
    this.sendProjectionToMatrix.emit({
      country: this.selectedCountry(),
      platforms: [{ platformId, reach }],
    });
  }

  emitMixToMatrix(): void {
    const platforms: MatrixProjectionPlatform[] = this.activeModeledMixRows().map((row) => ({
      platformId: row.platform,
      reach: row.projectedReach,
    }));

    if (platforms.length === 0) {
      return;
    }

    this.sendProjectionToMatrix.emit({
      country: this.selectedCountry(),
      platforms,
    });
  }

  formatInteger(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '0';
    }
    return Math.round(value).toLocaleString('es-CO');
  }

  formatCurrency(value: number, currency: CurveCurrency, isCpma = false): string {
    if (!Number.isFinite(value)) {
      return `$0 ${currency}`;
    }
    const minDigits = isCpma || currency === 'USD' ? 2 : 0;
    const formatted = value.toLocaleString('es-CO', {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: 2,
    });
    return `$${formatted} ${currency}`;
  }

  formatCompactCurrency(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '$0';
    }
    if (value >= 1_000_000_000) {
      return `$${this.trimDecimals(value / 1_000_000_000)}B`;
    }
    if (value >= 1_000_000) {
      return `$${this.trimDecimals(value / 1_000_000)}M`;
    }
    if (value >= 1_000) {
      return `$${this.trimDecimals(value / 1_000)}k`;
    }
    return `$${Math.round(value)}`;
  }

  formatCompactNumber(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0';
    }
    if (value >= 1_000_000_000) {
      return `${this.trimDecimals(value / 1_000_000_000)}B`;
    }
    if (value >= 1_000_000) {
      return `${this.trimDecimals(value / 1_000_000)}M`;
    }
    if (value >= 1_000) {
      return `${this.trimDecimals(value / 1_000)}k`;
    }
    return `${Math.round(value)}`;
  }

  formatReachDiff(diff: number): string {
    const rounded = Math.round(diff);
    if (rounded === 0) {
      return '0 personas';
    }
    const sign = rounded > 0 ? '+' : '-';
    return `${sign}${Math.abs(rounded).toLocaleString('es-CO')} personas`;
  }

  getPlatformColor(platform: string): string {
    return PLATFORM_COLORS[platform] ?? '#4f46e5';
  }

  private buildIndividualChartOption(
    model: RegressionModelResult,
    budget: number,
    projectedReach: number,
    currency: CurveCurrency,
    platform: CurvePlatformFilter,
  ): SimulatorChartOption {
    const platformColor = this.getPlatformColor(platform === 'DV360' ? 'Display' : platform);
    const maxCurveX =
      model.curvePoints.length > 0 ? model.curvePoints[model.curvePoints.length - 1].x : budget;

    return {
      animationDuration: 320,
      grid: {
        top: 38,
        right: 22,
        bottom: 34,
        left: 58,
      },
      legend: {
        top: 4,
        right: 8,
        textStyle: {
          color: '#475569',
          fontSize: 11.5,
          fontFamily: CHART_FONT_FAMILY,
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: {
          color: '#f8fafc',
          fontSize: 12,
          fontFamily: CHART_FONT_FAMILY,
        },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          if (!item) {
            return '';
          }
          if (item.seriesName === 'Campañas Históricas') {
            const point = model.historicalPoints[item.dataIndex];
            if (!point) {
              return '';
            }
            return [
              `<div style="font-weight:700;margin-bottom:4px;">${this.escapeHtml(point.label)}</div>`,
              `<div style="color:#94a3b8;font-size:11px;margin-bottom:6px;">Periodo: ${this.escapeHtml(point.periodo)}</div>`,
              `<div>Inversión: <strong>${this.escapeHtml(this.formatCurrency(point.x, currency))}</strong></div>`,
              `<div>Alcance real: <strong>${this.escapeHtml(this.formatInteger(point.y))}</strong></div>`,
              `<div>CPMa real: <strong>${this.escapeHtml(this.formatCurrency(point.cpma, currency, true))}</strong></div>`,
            ].join('');
          }
          if (item.seriesName === 'Escenario Simulado') {
            const simCpma = projectedReach > 0 && budget > 0 ? (budget / projectedReach) * 1000 : 0;
            return [
              `<div style="font-weight:700;color:#34d399;margin-bottom:4px;">Escenario Simulado</div>`,
              `<div>Presupuesto: <strong>${this.escapeHtml(this.formatCurrency(budget, currency))}</strong></div>`,
              `<div>Alcance proyectado: <strong>${this.escapeHtml(this.formatInteger(projectedReach))}</strong></div>`,
              `<div>CPMa proyectado: <strong>${this.escapeHtml(this.formatCurrency(simCpma, currency, true))}</strong></div>`,
            ].join('');
          }
          const tuple = Array.isArray(item.value) ? item.value : [];
          const xVal = Number(tuple[0] ?? 0);
          const yVal = Number(tuple[1] ?? 0);
          return [
            `<div style="font-weight:700;margin-bottom:4px;">Curva de Regresión</div>`,
            `<div>Inversión: <strong>${this.escapeHtml(this.formatCurrency(xVal, currency))}</strong></div>`,
            `<div>Alcance estimado: <strong>${this.escapeHtml(this.formatInteger(yVal))}</strong></div>`,
          ].join('');
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: maxCurveX > 0 ? maxCurveX : undefined,
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          fontFamily: CHART_FONT_FAMILY,
          formatter: (val: number) => this.formatCompactCurrency(val),
        },
        splitLine: {
          lineStyle: {
            color: '#f1f5f9',
            type: 'dashed',
          },
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: model.universeCap > 0 ? model.universeCap : undefined,
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          fontFamily: CHART_FONT_FAMILY,
          formatter: (val: number) => this.formatCompactNumber(val),
        },
        splitLine: {
          lineStyle: {
            color: '#f1f5f9',
          },
        },
      },
      series: [
        {
          name: 'Curva de Regresión',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: model.curvePoints.map((pt) => [pt.x, Math.round(pt.y)]),
          lineStyle: {
            width: 3,
            color: '#4f46e5',
          },
          itemStyle: {
            color: '#4f46e5',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(79, 70, 229, 0.22)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0.01)' },
            ]),
          },
          z: 2,
        },
        {
          name: 'Campañas Históricas',
          type: 'scatter',
          symbolSize: 10,
          data: model.historicalPoints.map((pt) => [pt.x, Math.round(pt.y)]),
          itemStyle: {
            color: platformColor,
            borderColor: '#ffffff',
            borderWidth: 1.5,
            opacity: 0.9,
          },
          z: 3,
        },
        {
          name: 'Escenario Simulado',
          type: 'scatter',
          symbolSize: 15,
          data: [[budget, Math.round(projectedReach)]],
          itemStyle: {
            color: '#10b981',
            borderColor: '#ffffff',
            borderWidth: 2.5,
            shadowBlur: 10,
            shadowColor: 'rgba(16, 185, 129, 0.45)',
          },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            lineStyle: {
              type: 'dashed',
              color: '#10b981',
              width: 1.5,
            },
            label: {
              show: false,
            },
            data: [{ xAxis: budget }, { yAxis: Math.round(projectedReach) }],
          },
          z: 4,
        },
      ],
    };
  }

  private buildMixChartOption(
    activeRows: readonly MixChannelEvaluation[],
    netCrossReach: number,
    universe: number,
  ): SimulatorChartOption {
    const categories = [...activeRows.map((row) => row.platform), 'Alcance Neto Cross-Channel'];

    const barItems = [
      ...activeRows.map((row) => ({
        value: row.projectedReach,
        itemStyle: {
          color: this.getPlatformColor(row.platform),
          borderRadius: [8, 8, 0, 0] as [number, number, number, number],
        },
      })),
      {
        value: netCrossReach,
        itemStyle: {
          color: '#4f46e5',
          borderColor: '#312e81',
          borderWidth: 2,
          borderRadius: [8, 8, 0, 0] as [number, number, number, number],
        },
      },
    ];

    return {
      animationDuration: 320,
      grid: {
        top: 30,
        right: 20,
        bottom: 34,
        left: 58,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: {
          color: '#f8fafc',
          fontSize: 12,
          fontFamily: CHART_FONT_FAMILY,
        },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          if (!item) {
            return '';
          }
          const reachVal = Number(item.value ?? 0);
          const pct = universe > 0 ? ((reachVal / universe) * 100).toFixed(2) : '0.00';
          return [
            `<div style="font-weight:700;margin-bottom:4px;">${this.escapeHtml(item.name)}</div>`,
            `<div>Alcance: <strong>${this.escapeHtml(this.formatInteger(reachVal))}</strong></div>`,
            `<div>Penetración país: <strong>${pct}%</strong></div>`,
          ].join('');
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: '#334155',
          fontWeight: 600,
          fontSize: 11.5,
          fontFamily: CHART_FONT_FAMILY,
          interval: 0,
        },
        axisLine: {
          lineStyle: { color: '#cbd5e1' },
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: universe > 0 ? universe : undefined,
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          fontFamily: CHART_FONT_FAMILY,
          formatter: (val: number) => this.formatCompactNumber(val),
        },
        splitLine: {
          lineStyle: { color: '#f1f5f9' },
        },
      },
      series: [
        {
          name: 'Alcance',
          type: 'bar',
          barMaxWidth: 54,
          data: barItems,
          label: {
            show: true,
            position: 'top',
            color: '#0f172a',
            fontWeight: 700,
            fontSize: 11,
            fontFamily: CHART_FONT_FAMILY,
            formatter: (params) => this.formatCompactNumber(Number(params.value ?? 0)),
          },
        },
      ],
    };
  }

  private initChartSafely(el: HTMLDivElement): echarts.ECharts | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return null;
    }
    try {
      const probeCanvas = document.createElement('canvas');
      if (typeof probeCanvas.getContext !== 'function' || !probeCanvas.getContext('2d')) {
        return null;
      }
      return echarts.init(el);
    } catch {
      return null;
    }
  }

  private resizeChartSafely(instance: echarts.ECharts | null, el: HTMLDivElement): void {
    if (!instance || instance.isDisposed()) {
      return;
    }
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      instance.resize();
    }
  }

  private scheduleFrameResize(kind: 'individual' | 'mix', el: HTMLDivElement): void {
    if (typeof requestAnimationFrame !== 'function') {
      return;
    }
    if (kind === 'individual') {
      if (this.individualResizeFrame !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.individualResizeFrame);
      }
      this.individualResizeFrame = requestAnimationFrame(() => {
        this.individualResizeFrame = null;
        this.resizeChartSafely(this.individualChartInstance, el);
      });
      return;
    }

    if (this.mixResizeFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.mixResizeFrame);
    }
    this.mixResizeFrame = requestAnimationFrame(() => {
      this.mixResizeFrame = null;
      this.resizeChartSafely(this.mixChartInstance, el);
    });
  }

  private disposeChart(kind: 'individual' | 'mix'): void {
    if (kind === 'individual') {
      if (this.individualResizeFrame !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.individualResizeFrame);
        this.individualResizeFrame = null;
      }
      if (this.individualResizeObserver) {
        this.individualResizeObserver.disconnect();
        this.individualResizeObserver = null;
      }
      if (this.individualChartInstance) {
        this.individualChartInstance.dispose();
        this.individualChartInstance = null;
      }
      return;
    }

    if (this.mixResizeFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.mixResizeFrame);
      this.mixResizeFrame = null;
    }
    if (this.mixResizeObserver) {
      this.mixResizeObserver.disconnect();
      this.mixResizeObserver = null;
    }
    if (this.mixChartInstance) {
      this.mixChartInstance.dispose();
      this.mixChartInstance = null;
    }
  }

  private matchesPlatformFilter(
    recordPlatform: ReachCurvePlatform,
    filter: CurvePlatformFilter,
  ): boolean {
    if (filter === 'DV360') {
      return recordPlatform === 'YouTube' || recordPlatform === 'Display';
    }
    return recordPlatform === filter;
  }

  private convertAllBudgets(from: CurveCurrency, to: CurveCurrency): void {
    const convertedIndividual = this.reachCurveService.convertInvestment(
      this.individualBudget(),
      from,
      to,
    );
    this.individualBudget.set(this.roundBudgetForCurrency(convertedIndividual, to));

    this.mixRows.update((rows) =>
      rows.map((row) => ({
        ...row,
        budget: this.roundBudgetForCurrency(
          this.reachCurveService.convertInvestment(row.budget, from, to),
          to,
        ),
      })),
    );
  }

  private roundBudgetForCurrency(amount: number, currency: CurveCurrency): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    if (currency === 'USD') {
      return Math.round(amount * 100) / 100;
    }
    return Math.round(amount);
  }

  private getDefaultBudgetFloor(currency: CurveCurrency): number {
    switch (currency) {
      case 'USD':
        return 5_000;
      case 'MXN':
        return 100_000;
      case 'COP':
        return 20_000_000;
    }
  }

  private sanitizeNonNegativeNumber(raw: number | string | null): number {
    if (raw === null || raw === '') {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private resolveReliabilityLevel(rSquared: number): R2ReliabilityLevel {
    if (rSquared >= 0.75) {
      return 'high';
    }
    if (rSquared >= 0.5) {
      return 'medium';
    }
    return 'low';
  }

  private trimDecimals(value: number): string {
    return value.toFixed(1).replace(/\.0$/, '');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private copyWithFallbackTextarea(text: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  private showCopiedFeedback(): void {
    this.tableCopiedFeedback.set(true);
    if (this.copiedFeedbackTimer !== null) {
      clearTimeout(this.copiedFeedbackTimer);
    }
    this.copiedFeedbackTimer = setTimeout(() => {
      this.tableCopiedFeedback.set(false);
      this.copiedFeedbackTimer = null;
    }, 2500);
  }
}

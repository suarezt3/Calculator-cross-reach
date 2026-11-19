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
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Calendar01Icon,
  Cancel01Icon,
  ChartLineData02Icon,
  Clock01Icon,
  CloudUploadIcon,
  Exchange01Icon,
  FilterIcon,
  FloppyDiskIcon,
  Globe02Icon,
  Layers01Icon,
  RefreshIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';
import { ReachCurveImportModalComponent } from '../reach-curve-import-modal/reach-curve-import-modal.component';
import { ReachCurvesDocModalComponent } from '../reach-curves-doc-modal/reach-curves-doc-modal.component';
import { ReachCurveSimulatorComponent } from '../reach-curve-simulator/reach-curve-simulator.component';
import { ReachCurveService } from '../../services/reach-curve.service';
import {
  CurveBuyType,
  CurveCountry,
  CurveCurrency,
  CurveCut,
  CurveStage,
  CurveSyncStatus,
  PlatformFreshnessItem,
  ReachCurveFreshness,
  ReachCurvePlatform,
  ReachCurveRecord,
  SendProjectionToMatrixPayload,
} from '../../models/reach-curve.models';

export type ReachCurvesTab = 'simulator' | 'audit';

export const CURVE_COUNTRIES: readonly CurveCountry[] = [
  'Colombia',
  'Mexico',
  'Chile',
  'Peru',
  'Costa Rica',
];

export const CURVE_PLATFORMS: readonly ReachCurvePlatform[] = [
  'Meta',
  'TikTok',
  'YouTube',
  'Display',
];

export const CURVE_CUTS: readonly CurveCut[] = ['W1', 'W2', 'W3', 'W4'];

export const CURVE_STAGES: readonly CurveStage[] = ['ATT', 'CON', 'PUR', 'LOY'];

export const CURVE_BUY_TYPES: readonly CurveBuyType[] = ['CPM', 'CPV', 'CPC', 'CPE', 'CPL', 'CPA'];

export interface PlatformCountItem {
  readonly platform: ReachCurvePlatform;
  readonly count: number;
}

export interface CountryCountItem {
  readonly country: CurveCountry;
  readonly count: number;
}

export interface AuditDisplayRow {
  readonly record: ReachCurveRecord;
  readonly currencyCode: CurveCurrency;
  readonly displayInvestment: number;
  readonly displayCpma: number;
  readonly frequency: string;
}

@Component({
  selector: 'app-reach-curves-view',
  standalone: true,
  imports: [
    FormsModule,
    HugeiconsIconComponent,
    PlatformIconComponent,
    ReachCurveImportModalComponent,
    ReachCurvesDocModalComponent,
    ReachCurveSimulatorComponent,
  ],
  templateUrl: './reach-curves-view.component.html',
  styleUrl: './reach-curves-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onDocumentEscape()',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ReachCurvesViewComponent {
  readonly reachCurveService = inject(ReachCurveService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly freshnessWrapRef = viewChild<ElementRef<HTMLElement>>('freshnessWrap');

  readonly notify = output<string>();
  readonly sendProjectionToMatrix = output<SendProjectionToMatrixPayload>();

  // Iconos de Hugeicons
  readonly CloudUploadIcon = CloudUploadIcon;
  readonly RefreshIcon = RefreshIcon;
  readonly FloppyDiskIcon = FloppyDiskIcon;
  readonly Exchange01Icon = Exchange01Icon;
  readonly FilterIcon = FilterIcon;
  readonly Analytics02Icon = Analytics02Icon;
  readonly ChartLineData02Icon = ChartLineData02Icon;
  readonly Globe02Icon = Globe02Icon;
  readonly Calendar01Icon = Calendar01Icon;
  readonly ArrowLeft01Icon = ArrowLeft01Icon;
  readonly ArrowRight01Icon = ArrowRight01Icon;
  readonly ArrowDown01Icon = ArrowDown01Icon;
  readonly Tick02Icon = Tick02Icon;
  readonly Cancel01Icon = Cancel01Icon;
  readonly Layers01Icon = Layers01Icon;
  readonly Clock01Icon = Clock01Icon;
  readonly BookOpen01Icon = BookOpen01Icon;
  readonly Alert02Icon = Alert02Icon;

  // Catálogos de opciones
  readonly countries = CURVE_COUNTRIES;
  readonly platforms = CURVE_PLATFORMS;
  readonly cuts = CURVE_CUTS;
  readonly stages = CURVE_STAGES;
  readonly buyTypes = CURVE_BUY_TYPES;
  readonly pageSize = 25;

  // Estado de navegación interna, modales, frescura y tasas de cambio
  readonly activeTab = signal<ReachCurvesTab>(
    this.reachCurveService.records().length > 0 ? 'simulator' : 'audit',
  );
  readonly showImportModal = signal<boolean>(false);
  readonly isCurvesDocOpen = signal<boolean>(false);
  readonly isFreshnessPopoverOpen = signal<boolean>(false);
  readonly isFreshnessPopoverHovered = signal<boolean>(false);
  readonly isRefreshing = signal<boolean>(false);
  readonly copToUsdInput = signal<number>(4200);
  readonly mxnToUsdInput = signal<number>(20);
  readonly rateError = signal<string | null>(null);
  readonly rateSavedBanner = signal<boolean>(false);

  readonly showFreshnessPopover = computed<boolean>(
    () =>
      this.reachCurveService.dataFreshness().hasData &&
      (this.isFreshnessPopoverOpen() || this.isFreshnessPopoverHovered()),
  );

  private userSelectedTab = false;
  private previousRecordsCount = this.reachCurveService.records().length;

  // Filtros reactivos
  readonly filterCountry = signal<'ALL' | CurveCountry>('ALL');
  readonly filterPlatform = signal<'ALL' | ReachCurvePlatform>('ALL');
  readonly filterPeriod = signal<'ALL' | string>('ALL');
  readonly filterCut = signal<'ALL' | CurveCut>('ALL');
  readonly filterStage = signal<'ALL' | CurveStage>('ALL');
  readonly filterBuyType = signal<'ALL' | CurveBuyType>('ALL');
  readonly displayCurrency = signal<'LOCAL' | CurveCurrency>('LOCAL');
  readonly currentPage = signal<number>(1);

  private rateSavedTimer: ReturnType<typeof setTimeout> | null = null;

  // KPIs reactivos de cobertura histórica
  readonly totalRecordsCount = computed<number>(() => this.reachCurveService.records().length);

  readonly availablePeriods = computed<string[]>(() => this.reachCurveService.availablePeriods());

  readonly periodsCount = computed<number>(() => this.availablePeriods().length);

  readonly periodRangeLabel = computed<string>(() => {
    const periods = this.availablePeriods();
    if (periods.length === 0) {
      return 'Sin periodos cargados';
    }
    if (periods.length === 1) {
      return periods[0];
    }
    return `${periods[0]} → ${periods[periods.length - 1]}`;
  });

  readonly platformBreakdown = computed<PlatformCountItem[]>(() => {
    const counts = new Map<ReachCurvePlatform, number>();
    for (const platform of CURVE_PLATFORMS) {
      counts.set(platform, 0);
    }
    for (const record of this.reachCurveService.records()) {
      counts.set(record.plataforma, (counts.get(record.plataforma) ?? 0) + 1);
    }
    return CURVE_PLATFORMS.map((platform) => ({
      platform,
      count: counts.get(platform) ?? 0,
    }));
  });

  readonly countryBreakdown = computed<CountryCountItem[]>(() => {
    const counts = new Map<CurveCountry, number>();
    for (const country of CURVE_COUNTRIES) {
      counts.set(country, 0);
    }
    for (const record of this.reachCurveService.records()) {
      counts.set(record.pais, (counts.get(record.pais) ?? 0) + 1);
    }
    return CURVE_COUNTRIES.map((country) => ({
      country,
      count: counts.get(country) ?? 0,
    }));
  });

  readonly syncStatusLabel = computed<string>(() => {
    const status = this.reachCurveService.lastSyncStatus();
    switch (status) {
      case 'synced':
        return 'Sincronizadas en la nube';
      case 'local_only':
        return 'Modo caché local';
      case 'error':
        return 'Sincronización pendiente';
    }
  });

  readonly hasActiveFilters = computed<boolean>(() => {
    return (
      this.filterCountry() !== 'ALL' ||
      this.filterPlatform() !== 'ALL' ||
      this.filterPeriod() !== 'ALL' ||
      this.filterCut() !== 'ALL' ||
      this.filterStage() !== 'ALL' ||
      this.filterBuyType() !== 'ALL' ||
      this.displayCurrency() !== 'LOCAL'
    );
  });

  readonly filteredRecords = computed<ReachCurveRecord[]>(() => {
    const country = this.filterCountry();
    const platform = this.filterPlatform();
    const period = this.filterPeriod();
    const cut = this.filterCut();
    const stage = this.filterStage();
    const buyType = this.filterBuyType();

    return this.reachCurveService.records().filter((record) => {
      if (country !== 'ALL' && record.pais !== country) {
        return false;
      }
      if (platform !== 'ALL' && record.plataforma !== platform) {
        return false;
      }
      if (period !== 'ALL' && record.periodo !== period) {
        return false;
      }
      if (cut !== 'ALL' && record.corte !== cut) {
        return false;
      }
      if (stage !== 'ALL' && record.stage !== stage) {
        return false;
      }
      if (buyType !== 'ALL' && record.tipo_compra !== buyType) {
        return false;
      }
      return true;
    });
  });

  readonly totalPages = computed<number>(() =>
    Math.max(1, Math.ceil(this.filteredRecords().length / this.pageSize)),
  );

  readonly safeCurrentPage = computed<number>(() =>
    Math.min(Math.max(1, this.currentPage()), this.totalPages()),
  );

  readonly pageStartIndex = computed<number>(() => {
    if (this.filteredRecords().length === 0) {
      return 0;
    }
    return (this.safeCurrentPage() - 1) * this.pageSize + 1;
  });

  readonly pageEndIndex = computed<number>(() =>
    Math.min(this.safeCurrentPage() * this.pageSize, this.filteredRecords().length),
  );

  readonly paginatedRows = computed<AuditDisplayRow[]>(() => {
    const filtered = this.filteredRecords();
    const page = this.safeCurrentPage();
    const start = (page - 1) * this.pageSize;
    const slice = filtered.slice(start, start + this.pageSize);
    const selectedCurrency = this.displayCurrency();

    return slice.map((record) => {
      const currencyCode: CurveCurrency =
        selectedCurrency === 'LOCAL' ? record.moneda : selectedCurrency;
      const displayInvestment =
        selectedCurrency === 'LOCAL'
          ? record.inversion
          : this.reachCurveService.convertInvestment(
              record.inversion,
              record.moneda,
              selectedCurrency,
            );
      const displayCpma = record.alcance > 0 ? (displayInvestment / record.alcance) * 1000 : 0;
      const frequency =
        record.alcance > 0 ? (record.impresiones / record.alcance).toFixed(2) : '0.00';

      return {
        record,
        currencyCode,
        displayInvestment,
        displayCpma,
        frequency,
      };
    });
  });

  constructor() {
    effect(() => {
      const rates = this.reachCurveService.exchangeRates();
      this.copToUsdInput.set(rates.cop_to_usd);
      this.mxnToUsdInput.set(rates.mxn_to_usd);
    });

    let filtersInitialized = false;
    effect(() => {
      this.filterCountry();
      this.filterPlatform();
      this.filterPeriod();
      this.filterCut();
      this.filterStage();
      this.filterBuyType();
      this.displayCurrency();
      if (filtersInitialized) {
        this.currentPage.set(1);
      } else {
        filtersInitialized = true;
      }
    });

    effect(() => {
      const count = this.reachCurveService.records().length;
      if (this.previousRecordsCount === 0 && count > 0 && !this.userSelectedTab) {
        this.activeTab.set('simulator');
      }
      this.previousRecordsCount = count;
    });

    this.destroyRef.onDestroy(() => {
      if (this.rateSavedTimer !== null) {
        clearTimeout(this.rateSavedTimer);
        this.rateSavedTimer = null;
      }
    });
  }

  setActiveTab(tab: ReachCurvesTab): void {
    this.userSelectedTab = true;
    this.activeTab.set(tab);
  }

  handleSendProjectionToMatrix(payload: SendProjectionToMatrixPayload): void {
    this.sendProjectionToMatrix.emit(payload);
  }

  openImportModal(): void {
    this.closeFreshnessPopover();
    this.showImportModal.set(true);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
  }

  openCurvesDocModal(): void {
    this.closeFreshnessPopover();
    this.isCurvesDocOpen.set(true);
  }

  closeCurvesDocModal(): void {
    this.isCurvesDocOpen.set(false);
  }

  toggleFreshnessPopover(): void {
    if (this.isFreshnessPopoverOpen()) {
      this.closeFreshnessPopover();
      return;
    }
    this.isFreshnessPopoverOpen.set(true);
  }

  closeFreshnessPopover(): void {
    this.isFreshnessPopoverOpen.set(false);
    this.isFreshnessPopoverHovered.set(false);
  }

  onFreshnessMouseEnter(): void {
    this.isFreshnessPopoverHovered.set(true);
  }

  onFreshnessMouseLeave(): void {
    this.isFreshnessPopoverHovered.set(false);
  }

  onFreshnessFocusIn(): void {
    this.isFreshnessPopoverHovered.set(true);
  }

  onFreshnessFocusOut(event: FocusEvent): void {
    const wrap = this.freshnessWrapRef()?.nativeElement;
    const related = event.relatedTarget;
    if (wrap && related instanceof Node && wrap.contains(related)) {
      return;
    }
    this.isFreshnessPopoverHovered.set(false);
  }

  onDocumentEscape(): void {
    if (this.showFreshnessPopover()) {
      this.closeFreshnessPopover();
    }
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.showFreshnessPopover()) {
      return;
    }
    const wrap = this.freshnessWrapRef()?.nativeElement;
    if (wrap && event.target instanceof Node && !wrap.contains(event.target)) {
      this.closeFreshnessPopover();
    }
  }

  isPlatformOutdated(item: PlatformFreshnessItem, globalLatestPeriodRaw: string | null): boolean {
    if (!globalLatestPeriodRaw || item.recordsCount === 0 || !item.latestPeriodRaw) {
      return false;
    }
    return item.latestPeriodRaw < globalLatestPeriodRaw;
  }

  hasAnyOutdatedPlatform(freshness: ReachCurveFreshness): boolean {
    return freshness.byPlatform.some((item) =>
      this.isPlatformOutdated(item, freshness.latestPeriodRaw),
    );
  }

  handleImportCompleted(event: { savedCount: number; syncStatus: CurveSyncStatus }): void {
    this.showImportModal.set(false);
    this.currentPage.set(1);

    if (event.syncStatus === 'synced') {
      this.notify.emit(
        `Se importaron y sincronizaron ${event.savedCount} campañas históricas en la nube.`,
      );
    } else if (event.syncStatus === 'local_only') {
      this.notify.emit(
        `Se importaron ${event.savedCount} campañas en caché local (sin conexión en la nube).`,
      );
    } else {
      this.notify.emit(
        `Se procesaron ${event.savedCount} campañas con advertencia de sincronización.`,
      );
    }
  }

  async refreshData(): Promise<void> {
    if (this.isRefreshing()) {
      return;
    }
    this.isRefreshing.set(true);
    try {
      await Promise.all([
        this.reachCurveService.loadRecords(),
        this.reachCurveService.loadExchangeRates(),
      ]);
      const syncStatus = this.reachCurveService.lastSyncStatus();
      if (syncStatus === 'synced') {
        this.notify.emit('Base histórica y tasas de cambio actualizadas desde la nube.');
      } else if (syncStatus === 'local_only') {
        this.notify.emit('Datos cargados desde caché local (sin conexión en la nube).');
      } else {
        this.notify.emit('No fue posible sincronizar los datos desde la nube.');
      }
    } finally {
      this.isRefreshing.set(false);
    }
  }

  onCopRateChange(rawValue: number | string | null): void {
    this.rateError.set(null);
    this.rateSavedBanner.set(false);
    if (rawValue === null || rawValue === '') {
      this.copToUsdInput.set(0);
      return;
    }
    const parsed = Number(rawValue);
    this.copToUsdInput.set(Number.isFinite(parsed) ? parsed : 0);
  }

  onMxnRateChange(rawValue: number | string | null): void {
    this.rateError.set(null);
    this.rateSavedBanner.set(false);
    if (rawValue === null || rawValue === '') {
      this.mxnToUsdInput.set(0);
      return;
    }
    const parsed = Number(rawValue);
    this.mxnToUsdInput.set(Number.isFinite(parsed) ? parsed : 0);
  }

  async saveExchangeRates(): Promise<void> {
    const copToUsd = Number(this.copToUsdInput());
    const mxnToUsd = Number(this.mxnToUsdInput());

    if (
      !Number.isFinite(copToUsd) ||
      copToUsd <= 0 ||
      !Number.isFinite(mxnToUsd) ||
      mxnToUsd <= 0
    ) {
      this.rateError.set('Ingresa tasas válidas mayores a 0.');
      this.rateSavedBanner.set(false);
      return;
    }

    this.rateError.set(null);
    await this.reachCurveService.updateExchangeRates({
      id: 'global',
      cop_to_usd: copToUsd,
      mxn_to_usd: mxnToUsd,
    });

    this.rateSavedBanner.set(true);
    if (this.rateSavedTimer !== null) {
      clearTimeout(this.rateSavedTimer);
    }
    this.rateSavedTimer = setTimeout(() => {
      this.rateSavedBanner.set(false);
      this.rateSavedTimer = null;
    }, 3500);

    const msg =
      this.reachCurveService.lastSyncStatus() === 'synced'
        ? 'Tasas de cambio guardadas y sincronizadas en la nube.'
        : 'Tasas de cambio actualizadas en caché local.';
    this.notify.emit(msg);
  }

  setCountryFilter(value: 'ALL' | CurveCountry): void {
    this.filterCountry.set(value);
    this.currentPage.set(1);
  }

  setPlatformFilter(value: 'ALL' | ReachCurvePlatform): void {
    this.filterPlatform.set(value);
    this.currentPage.set(1);
  }

  setPeriodFilter(value: 'ALL' | string): void {
    this.filterPeriod.set(value);
    this.currentPage.set(1);
  }

  setCutFilter(value: 'ALL' | CurveCut): void {
    this.filterCut.set(value);
    this.currentPage.set(1);
  }

  setStageFilter(value: 'ALL' | CurveStage): void {
    this.filterStage.set(value);
    this.currentPage.set(1);
  }

  setBuyTypeFilter(value: 'ALL' | CurveBuyType): void {
    this.filterBuyType.set(value);
    this.currentPage.set(1);
  }

  setDisplayCurrency(value: 'LOCAL' | CurveCurrency): void {
    this.displayCurrency.set(value);
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.filterCountry.set('ALL');
    this.filterPlatform.set('ALL');
    this.filterPeriod.set('ALL');
    this.filterCut.set('ALL');
    this.filterStage.set('ALL');
    this.filterBuyType.set('ALL');
    this.displayCurrency.set('LOCAL');
    this.currentPage.set(1);
  }

  goToPreviousPage(): void {
    const page = this.safeCurrentPage();
    if (page > 1) {
      this.currentPage.set(page - 1);
    }
  }

  goToNextPage(): void {
    const page = this.safeCurrentPage();
    if (page < this.totalPages()) {
      this.currentPage.set(page + 1);
    }
  }

  formatInteger(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '0';
    }
    return Math.round(value).toLocaleString('es-CO');
  }

  formatCurrency(value: number, currency: CurveCurrency, isCpma = false): string {
    if (!Number.isFinite(value)) {
      return `0 ${currency}`;
    }
    const minDigits = isCpma || currency === 'USD' ? 2 : 0;
    const maxDigits = 2;
    const formatted = value.toLocaleString('es-CO', {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    });
    return `$${formatted} ${currency}`;
  }

  getStageBadgeClass(stage: CurveStage): string {
    return `stage-badge stage-${stage.toLowerCase()}`;
  }
}

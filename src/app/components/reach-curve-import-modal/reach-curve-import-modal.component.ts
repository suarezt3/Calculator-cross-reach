import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Alert02Icon,
  Calendar01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CloudUploadIcon,
  Delete02Icon,
  File01Icon,
  Layers01Icon,
  Tick02Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons';
import {
  CurveCountry,
  CurveCut,
  CurveStage,
  CurveSyncStatus,
  FileParseSummary,
  ReachCurveRecord,
  UploadPlatformSource,
} from '../../models/reach-curve.models';
import { ReachCurveService } from '../../services/reach-curve.service';
import { PlatformIconComponent } from '../../shared/components/platform-icon/platform-icon.component';

interface PlatformUploadOption {
  readonly id: UploadPlatformSource;
  readonly label: string;
  readonly subtitle: string;
  readonly columnsLegend: string;
}

interface QueuedFileItem {
  readonly summary: FileParseSummary;
  readonly requiresManualInput: boolean;
  readonly manualPeriod: string;
  readonly manualCut: CurveCut | '';
}

interface CountryCountBadge {
  readonly country: CurveCountry;
  readonly count: number;
}

interface StageCountBadge {
  readonly stage: CurveStage;
  readonly count: number;
}

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const CURVE_CUTS: readonly CurveCut[] = ['W1', 'W2', 'W3', 'W4'];

const CURVE_COUNTRIES: readonly CurveCountry[] = [
  'Colombia',
  'Mexico',
  'Chile',
  'Peru',
  'Costa Rica',
];

const CURVE_STAGES: readonly CurveStage[] = ['ATT', 'CON', 'PUR', 'LOY'];

const PLATFORM_OPTIONS: readonly PlatformUploadOption[] = [
  {
    id: 'Meta',
    label: 'Meta',
    subtitle: 'Meta Ads Manager',
    columnsLegend: 'Nombre de la campaña · Monto gastado (COP/MXN) · Alcance · Impresiones',
  },
  {
    id: 'TikTok',
    label: 'TikTok',
    subtitle: 'TikTok Ads Manager',
    columnsLegend: 'Campaign name · Spend · Reach · Impressions · Currency',
  },
  {
    id: 'DV360',
    label: 'DV360',
    subtitle: 'YouTube & Display',
    columnsLegend: 'Campaign · Insertion Order · Total Media Cost · Unique Reach · Impressions',
  },
];

@Component({
  selector: 'app-reach-curve-import-modal',
  standalone: true,
  imports: [FormsModule, HugeiconsIconComponent, PlatformIconComponent],
  templateUrl: './reach-curve-import-modal.component.html',
  styleUrl: './reach-curve-import-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscapePressed()',
  },
})
export class ReachCurveImportModalComponent {
  readonly reachCurveService = inject(ReachCurveService);

  readonly isOpen = input<boolean>(false);
  readonly closeModal = output<void>();
  readonly importCompleted = output<{ savedCount: number; syncStatus: CurveSyncStatus }>();

  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly CloudUploadIcon = CloudUploadIcon;
  readonly Upload01Icon = Upload01Icon;
  readonly File01Icon = File01Icon;
  readonly Cancel01Icon = Cancel01Icon;
  readonly Delete02Icon = Delete02Icon;
  readonly Alert02Icon = Alert02Icon;
  readonly CheckmarkCircle02Icon = CheckmarkCircle02Icon;
  readonly Tick02Icon = Tick02Icon;
  readonly Calendar01Icon = Calendar01Icon;
  readonly Layers01Icon = Layers01Icon;

  readonly platformOptions = PLATFORM_OPTIONS;
  readonly availableCuts = CURVE_CUTS;

  readonly selectedPlatform = signal<UploadPlatformSource | null>(null);
  readonly queuedFiles = signal<QueuedFileItem[]>([]);
  readonly parsedRecords = signal<ReachCurveRecord[]>([]);
  readonly isParsing = signal<boolean>(false);
  readonly isDragOver = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  private readonly isSubmitting = signal<boolean>(false);

  private wasOpen = false;
  private hasOpenedOnce = false;

  readonly isSaving = computed<boolean>(
    () => this.reachCurveService.isSaving() || this.isSubmitting(),
  );

  readonly totalValidRecords = computed<number>(() => this.parsedRecords().length);

  readonly hasPendingManualPeriodOrCut = computed<boolean>(() =>
    this.queuedFiles().some((item) => {
      if (item.summary.validRecordsCount <= 0) {
        return false;
      }
      const periodOk = this.isValidPeriod(item.summary.detectedPeriod);
      const cutOk = this.isValidCurveCut(item.summary.detectedCut);
      return !periodOk || !cutOk || item.summary.needsManualPeriodOrCut;
    }),
  );

  readonly countryBreakdown = computed<readonly CountryCountBadge[]>(() => {
    const counts = new Map<CurveCountry, number>();
    for (const country of CURVE_COUNTRIES) {
      counts.set(country, 0);
    }
    for (const record of this.parsedRecords()) {
      counts.set(record.pais, (counts.get(record.pais) ?? 0) + 1);
    }
    return CURVE_COUNTRIES.map((country) => ({
      country,
      count: counts.get(country) ?? 0,
    })).filter((entry) => entry.count > 0);
  });

  readonly stageBreakdown = computed<readonly StageCountBadge[]>(() => {
    const counts = new Map<CurveStage, number>();
    for (const stage of CURVE_STAGES) {
      counts.set(stage, 0);
    }
    for (const record of this.parsedRecords()) {
      counts.set(record.stage, (counts.get(record.stage) ?? 0) + 1);
    }
    return CURVE_STAGES.map((stage) => ({
      stage,
      count: counts.get(stage) ?? 0,
    })).filter((entry) => entry.count > 0);
  });

  readonly canSave = computed<boolean>(
    () =>
      this.totalValidRecords() > 0 &&
      !this.hasPendingManualPeriodOrCut() &&
      !this.isParsing() &&
      !this.isSaving(),
  );

  constructor() {
    effect(() => {
      const open = this.isOpen();
      if (open && !this.wasOpen) {
        if (this.hasOpenedOnce) {
          untracked(() => this.resetAllState());
        }
        this.hasOpenedOnce = true;
      } else if (!open && this.wasOpen) {
        untracked(() => this.resetAllState());
      }
      this.wasOpen = open;
    });
  }

  onEscapePressed(): void {
    if (this.isOpen() && !this.isSaving()) {
      this.handleClose();
    }
  }

  handleClose(): void {
    if (this.isSaving()) {
      return;
    }
    this.resetAllState();
    this.closeModal.emit();
  }

  selectPlatform(platform: UploadPlatformSource): void {
    if (this.isParsing() || this.isSaving()) {
      return;
    }
    if (this.selectedPlatform() === platform) {
      return;
    }
    this.clearQueueState();
    this.selectedPlatform.set(platform);
  }

  triggerFileInput(): void {
    if (!this.selectedPlatform() || this.isParsing() || this.isSaving()) {
      return;
    }
    this.fileInputRef()?.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.selectedPlatform() || this.isParsing() || this.isSaving()) {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
      this.isDragOver.set(false);
      return;
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (!this.selectedPlatform() || this.isParsing() || this.isSaving()) {
      return;
    }

    const fileList = event.dataTransfer?.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    await this.processFiles(Array.from(fileList));
  }

  async onFileInputChange(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const fileList = inputEl.files;
    if (!fileList || fileList.length === 0) {
      return;
    }
    const files = Array.from(fileList);
    inputEl.value = '';
    await this.processFiles(files);
  }

  async processFiles(rawFiles: File[]): Promise<void> {
    const platform = this.selectedPlatform();
    if (!platform || this.isParsing() || this.isSaving()) {
      return;
    }

    const rejectedNames: string[] = [];
    const excelByName = new Map<string, File>();

    for (const file of rawFiles) {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        excelByName.set(file.name, file);
      } else {
        rejectedNames.push(file.name);
      }
    }

    if (rejectedNames.length > 0) {
      this.errorMessage.set(
        `Solo se admiten archivos Excel (.xlsx o .xls). Omitidos: ${rejectedNames.join(', ')}.`,
      );
    } else {
      this.errorMessage.set(null);
    }

    const filesToParse = Array.from(excelByName.values());
    if (filesToParse.length === 0) {
      return;
    }

    this.isParsing.set(true);
    try {
      const result = await this.reachCurveService.parseExcelFiles(filesToParse, platform);

      if (!this.isOpen() || this.selectedPlatform() !== platform) {
        return;
      }

      const incomingFileNames = new Set<string>(filesToParse.map((file) => file.name));
      for (const summary of result.summaries) {
        incomingFileNames.add(summary.fileName);
      }

      const newItems: QueuedFileItem[] = result.summaries.map((summary) => ({
        summary,
        requiresManualInput: summary.needsManualPeriodOrCut && summary.validRecordsCount > 0,
        manualPeriod: summary.detectedPeriod ?? '',
        manualCut: summary.detectedCut ?? '',
      }));

      this.queuedFiles.update((current) => [
        ...current.filter((item) => !incomingFileNames.has(item.summary.fileName)),
        ...newItems,
      ]);

      this.parsedRecords.update((current) => [
        ...current.filter((record) => !incomingFileNames.has(record.source_file ?? '')),
        ...result.records,
      ]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error inesperado al analizar los archivos Excel seleccionados.';
      this.errorMessage.set(msg);
    } finally {
      this.isParsing.set(false);
    }
  }

  onManualPeriodChange(fileName: string, rawPeriod: string): void {
    const cleanPeriod = String(rawPeriod ?? '').trim();
    this.updateManualFields(fileName, cleanPeriod, undefined);
  }

  onManualCutChange(fileName: string, rawCut: string): void {
    const cleanRaw = String(rawCut ?? '').trim();
    const cleanCut = this.isValidCurveCut(cleanRaw) ? cleanRaw : '';
    this.updateManualFields(fileName, undefined, cleanCut);
  }

  removeFile(fileName: string): void {
    if (this.isParsing() || this.isSaving()) {
      return;
    }
    this.queuedFiles.update((current) =>
      current.filter((item) => item.summary.fileName !== fileName),
    );
    this.parsedRecords.update((current) =>
      current.filter((record) => record.source_file !== fileName),
    );
    this.errorMessage.set(null);
  }

  async saveAndSync(): Promise<void> {
    if (!this.canSave()) {
      return;
    }

    const activeFileNames = new Set(this.queuedFiles().map((item) => item.summary.fileName));
    const recordsToSave = this.parsedRecords().filter(
      (record) =>
        activeFileNames.has(record.source_file ?? '') &&
        this.isValidPeriod(record.periodo) &&
        this.isValidCurveCut(record.corte),
    );

    if (recordsToSave.length === 0) {
      this.errorMessage.set('No hay registros válidos listos para guardar.');
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      const savedCount = recordsToSave.length;
      await this.reachCurveService.upsertRecords(recordsToSave);
      const syncStatus = this.reachCurveService.lastSyncStatus();

      this.resetAllState();
      this.importCompleted.emit({ savedCount, syncStatus });
      this.closeModal.emit();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo completar la sincronización en la nube. Intenta nuevamente.';
      this.errorMessage.set(msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  formatNumber(val: number): string {
    return Math.round(val).toLocaleString('es-ES');
  }

  private updateManualFields(
    fileName: string,
    nextPeriod: string | undefined,
    nextCut: CurveCut | '' | undefined,
  ): void {
    let resolvedPeriod: string | null = null;
    let resolvedCut: CurveCut | null = null;

    this.queuedFiles.update((current) =>
      current.map((item) => {
        if (item.summary.fileName !== fileName) {
          return item;
        }
        const manualPeriod = nextPeriod !== undefined ? nextPeriod : item.manualPeriod;
        const manualCut = nextCut !== undefined ? nextCut : item.manualCut;
        const periodValid = this.isValidPeriod(manualPeriod);
        const cutValid = this.isValidCurveCut(manualCut);

        if (periodValid && cutValid) {
          resolvedPeriod = manualPeriod;
          resolvedCut = manualCut;
        }

        return {
          ...item,
          manualPeriod,
          manualCut,
          summary: {
            ...item.summary,
            detectedPeriod: periodValid ? manualPeriod : null,
            detectedCut: cutValid ? manualCut : null,
            needsManualPeriodOrCut: !(periodValid && cutValid),
          },
        };
      }),
    );

    if (resolvedPeriod !== null && resolvedCut !== null) {
      const targetPeriod = resolvedPeriod;
      const targetCut = resolvedCut;
      this.parsedRecords.update((current) =>
        this.reachCurveService.assignManualPeriodAndCut(current, fileName, targetPeriod, targetCut),
      );
    }
  }

  private clearQueueState(): void {
    this.queuedFiles.set([]);
    this.parsedRecords.set([]);
    this.isDragOver.set(false);
    this.errorMessage.set(null);
    const inputEl = this.fileInputRef()?.nativeElement;
    if (inputEl) {
      inputEl.value = '';
    }
  }

  private resetAllState(): void {
    this.clearQueueState();
    this.selectedPlatform.set(null);
    this.isParsing.set(false);
    this.isSubmitting.set(false);
  }

  private isValidPeriod(value: string | null | undefined): value is string {
    return typeof value === 'string' && PERIOD_REGEX.test(value.trim());
  }

  private isValidCurveCut(value: string | null | undefined): value is CurveCut {
    return value === 'W1' || value === 'W2' || value === 'W3' || value === 'W4';
  }
}

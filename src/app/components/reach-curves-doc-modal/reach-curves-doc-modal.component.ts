import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Alert02Icon,
  BookOpen01Icon,
  CalculatorIcon,
  Cancel01Icon,
  ChartLineData02Icon,
  CheckmarkCircle02Icon,
  CloudUploadIcon,
  Exchange01Icon,
  FunctionIcon,
  Globe02Icon,
  InformationCircleIcon,
  Layers01Icon,
  MathIcon,
  Shield01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { DEFAULT_COUNTRY_UNIVERSES } from '../../models/platform.models';
import { CurveBuyType, CurveCountry, CurveStage } from '../../models/reach-curve.models';

export type DocModalTab = 'formulas' | 'guide' | 'rules';

interface DocTabOption {
  readonly id: DocModalTab;
  readonly label: string;
  readonly icon: typeof MathIcon;
}

interface ReliabilityTrafficItem {
  readonly level: 'high' | 'medium' | 'low';
  readonly threshold: string;
  readonly title: string;
  readonly description: string;
}

interface GuideStepItem {
  readonly stepNumber: number;
  readonly title: string;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly tip?: string;
}

interface ActiveCountryItem {
  readonly country: CurveCountry;
  readonly codes: string;
  readonly universe: number;
}

interface StageDictionaryItem {
  readonly stage: CurveStage;
  readonly name: string;
  readonly patterns: string;
  readonly note: string;
  readonly recommended?: boolean;
}

interface BuyTypeDictionaryItem {
  readonly priority: number;
  readonly buyType: CurveBuyType;
  readonly patterns: string;
  readonly kpiFocus: string;
}

interface Dv360FormatItem {
  readonly formato: string;
  readonly keywords: string;
}

const DOC_TABS: readonly DocTabOption[] = [
  { id: 'formulas', label: 'Fórmulas y Matemática', icon: MathIcon },
  { id: 'guide', label: 'Cómo usar esta ventana', icon: BookOpen01Icon },
  { id: 'rules', label: 'Reglas de Datos y Diccionarios', icon: Shield01Icon },
];

const RELIABILITY_TRAFFIC_LIGHT: readonly ReliabilityTrafficItem[] = [
  {
    level: 'high',
    threshold: 'R² ≥ 75%',
    title: 'Alta precisión',
    description:
      'El histórico muestra un comportamiento consistente. La curva proyecta con alta solidez para definir presupuestos.',
  },
  {
    level: 'medium',
    threshold: '50% – 74%',
    title: 'Precisión moderada',
    description:
      'Existe dispersión por estacionalidad, audiencias o creatividades. Úsala como referencia direccional.',
  },
  {
    level: 'low',
    threshold: '< 50% o n < 3',
    title: 'Baja confiabilidad',
    description:
      'Muestra insuficiente o alta variabilidad. Se recomienda cargar más meses históricos antes de proyectar.',
  },
];

const GUIDE_STEPS: readonly GuideStepItem[] = [
  {
    stepNumber: 1,
    title: 'Descargar los 4 Cortes Acumulados',
    summary:
      'Cada reporte semanal debe descargarse acumulado desde el día 1 del mes para preservar el alcance único deduplicado.',
    highlights: [
      'W1: días 1 al 7 del mes',
      'W2: días 1 al 14 del mes',
      'W3: días 1 al 21 del mes',
      'W4: mes completo cerrado',
    ],
    tip: 'Regla de Oro: nunca sumes alcances semanales independientes; duplicarías personas que vieron anuncios en varias semanas.',
  },
  {
    stepNumber: 2,
    title: 'Importación Masiva y Actualización Mensual',
    summary:
      'Presiona Importar Reportes Excel, selecciona obligatoriamente la plataforma (Meta, TikTok o DV360) y arrastra tus archivos .xlsx crudos.',
    highlights: [
      'Detección automática de periodo, corte, país, stage y tipo de compra',
      'Guardar en la nube mediante actualización incremental (Upsert) sin duplicar historial previo',
    ],
  },
  {
    stepNumber: 3,
    title: 'Configurar Tasas de Cambio (TRM)',
    summary:
      'Define las tasas de referencia en el panel superior para convertir inversiones históricas entre monedas locales y dólares en tiempo real.',
    highlights: [
      'TRM Casaca (COP → USD): aplica a Colombia (CO), Chile (CL), Perú (PE) y Costa Rica (CR)',
      'TRM México (MXN → USD): aplica a México (MX)',
      'Simula indistintamente en moneda local o en USD desde el selector global',
    ],
  },
  {
    stepNumber: 4,
    title: 'Simular Curva Individual y Tabla de Escenarios',
    summary:
      'Selecciona País, Stage (ATT recomendado para alcance masivo), Corte y Tipo de Compra para proyectar presupuestos sobre puntos reales.',
    highlights: [
      'Ajusta el presupuesto con el slider o campo numérico y compara contra campañas cerradas',
      'Descarga el gráfico en PNG de alta resolución para presentaciones',
      'Copia la tabla de sensibilidad (-50% a +50%) directo para pegar en Excel',
    ],
  },
  {
    stepNumber: 5,
    title: 'Simular Mix Cross-Channel y Enviar a la Matriz Principal',
    summary:
      'Combina múltiples plataformas en el sub-modo Mix Cross-Channel, distribuye presupuestos y evalúa el alcance neto sin duplicados.',
    highlights: [
      'Visualiza la comparación entre alcance bruto individual y alcance neto deduplicado',
      'Usa "Enviar a Matriz Cross Reach" para transferir la proyección directo a la calculadora principal',
    ],
  },
];

const ACTIVE_COUNTRIES: readonly ActiveCountryItem[] = [
  { country: 'Colombia', codes: '_CO_ / _COL_', universe: DEFAULT_COUNTRY_UNIVERSES['Colombia'] },
  { country: 'Mexico', codes: '_MX_ / _MEX_', universe: DEFAULT_COUNTRY_UNIVERSES['Mexico'] },
  { country: 'Chile', codes: '_CL_ / _CHL_', universe: DEFAULT_COUNTRY_UNIVERSES['Chile'] },
  { country: 'Peru', codes: '_PE_ / _PER_', universe: DEFAULT_COUNTRY_UNIVERSES['Peru'] },
  {
    country: 'Costa Rica',
    codes: '_CR_ / _CRI_',
    universe: DEFAULT_COUNTRY_UNIVERSES['Costa Rica'],
  },
];

const EXCLUDED_RULES: readonly string[] = [
  'Otros mercados fuera del perímetro: Panamá (_PAN_ / _PA_), Bolivia (_BOL_), Guatemala (_GTM_), El Salvador (_SLV_) y Uruguay (_URY_).',
  'Filas con inversión igual a 0 o alcance único igual a 0 (incluyendo valores "-" o vacíos).',
  'Filas de totales y resúmenes de plataforma ("Resultados totales", "Total of...", cabeceras o metadatos de reporte).',
];

const STAGE_DICTIONARY: readonly StageDictionaryItem[] = [
  {
    stage: 'ATT',
    name: 'Attention / Awareness',
    patterns: 'Attention, attn, att',
    note: 'Recomendado para modelar curvas de alcance masivo',
    recommended: true,
  },
  {
    stage: 'CON',
    name: 'Consideration',
    patterns: 'Consideration, Cons',
    note: 'Campañas orientadas a consideración y tráfico',
  },
  {
    stage: 'LOY',
    name: 'Loyalty / Leads',
    patterns: 'Loyalty, LOY, Leads, Lead',
    note: 'Fidelización, retargeting o captura de prospectos',
  },
  {
    stage: 'PUR',
    name: 'Purchase / Conversion',
    patterns: 'Purchase, Purch',
    note: 'Conversión final y performance de ventas',
  },
];

const BUY_TYPE_DICTIONARY: readonly BuyTypeDictionaryItem[] = [
  {
    priority: 1,
    buyType: 'CPC',
    patterns: 'CPC, WebVisits, Clicks, Traffic',
    kpiFocus: 'Costo por clic y tráfico al sitio',
  },
  {
    priority: 2,
    buyType: 'CPM',
    patterns: 'CPM, Reach, Impresiones',
    kpiFocus: 'Alcance e impresiones (valor por defecto)',
  },
  {
    priority: 3,
    buyType: 'CPV',
    patterns: 'CPV, Thruplay, Views',
    kpiFocus: 'Reproducciones completas de video',
  },
  {
    priority: 4,
    buyType: 'CPE',
    patterns: 'CPE, Engagement',
    kpiFocus: 'Interacciones sociales y engagement',
  },
  {
    priority: 5,
    buyType: 'CPL',
    patterns: 'CPL, Leads, PotencialClients',
    kpiFocus: 'Formularios y captura de leads',
  },
  {
    priority: 6,
    buyType: 'CPA',
    patterns: 'CPA, Purch, Conversion',
    kpiFocus: 'Costo por adquisición o compra',
  },
];

const DV360_YOUTUBE_FORMATS: readonly Dv360FormatItem[] = [
  { formato: 'Bumper Ad', keywords: 'YBA, BUM (delimitado por separadores)' },
  { formato: 'YouTube Skippable', keywords: 'YTSK' },
  { formato: 'Non-Skip Trueview', keywords: 'YTNSTV' },
  { formato: 'Non-Skip', keywords: 'YTNS' },
  { formato: 'Skippable Trueview', keywords: 'YTSTV' },
  { formato: 'Demand Gen', keywords: 'DMG' },
];

const DV360_DISPLAY_FORMATS: readonly Dv360FormatItem[] = [
  { formato: 'Standard Banners', keywords: 'STDB, DISPLAY, IBD, _D_STD_, _STD_' },
  { formato: 'Handraisers', keywords: 'Handraisers' },
  { formato: 'Online Video', keywords: 'Display-OLV, OLV, Video, INSV, _V_' },
];

/**
 * Interactive documentation modal explaining reach curve econometric formulas,
 * operational workflow, and Excel ingestion dictionaries.
 */
@Component({
  selector: 'app-reach-curves-doc-modal',
  standalone: true,
  imports: [HugeiconsIconComponent],
  templateUrl: './reach-curves-doc-modal.component.html',
  styleUrl: './reach-curves-doc-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscapePressed()',
  },
})
export class ReachCurvesDocModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly closeModal = output<void>();

  readonly activeTab = signal<DocModalTab>('formulas');

  // Verified Hugeicons references
  readonly BookOpen01Icon = BookOpen01Icon;
  readonly Cancel01Icon = Cancel01Icon;
  readonly MathIcon = MathIcon;
  readonly FunctionIcon = FunctionIcon;
  readonly ChartLineData02Icon = ChartLineData02Icon;
  readonly CheckmarkCircle02Icon = CheckmarkCircle02Icon;
  readonly Alert02Icon = Alert02Icon;
  readonly Shield01Icon = Shield01Icon;
  readonly Layers01Icon = Layers01Icon;
  readonly CloudUploadIcon = CloudUploadIcon;
  readonly Exchange01Icon = Exchange01Icon;
  readonly CalculatorIcon = CalculatorIcon;
  readonly Globe02Icon = Globe02Icon;
  readonly InformationCircleIcon = InformationCircleIcon;
  readonly Tick02Icon = Tick02Icon;

  readonly tabs = DOC_TABS;
  readonly reliabilityItems = RELIABILITY_TRAFFIC_LIGHT;
  readonly guideSteps = GUIDE_STEPS;
  readonly activeCountries = ACTIVE_COUNTRIES;
  readonly excludedRules = EXCLUDED_RULES;
  readonly stageDictionary = STAGE_DICTIONARY;
  readonly buyTypeDictionary = BUY_TYPE_DICTIONARY;
  readonly dv360YoutubeFormats = DV360_YOUTUBE_FORMATS;
  readonly dv360DisplayFormats = DV360_DISPLAY_FORMATS;

  private wasOpen = false;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      if (open && !this.wasOpen) {
        untracked(() => this.activeTab.set('formulas'));
      } else if (!open && this.wasOpen) {
        untracked(() => this.activeTab.set('formulas'));
      }
      this.wasOpen = open;
    });
  }

  onEscapePressed(): void {
    if (this.isOpen()) {
      this.handleClose();
    }
  }

  setTab(tab: DocModalTab): void {
    this.activeTab.set(tab);
  }

  handleClose(): void {
    this.closeModal.emit();
  }

  formatUniverse(value: number): string {
    return Math.round(value).toLocaleString('es-ES');
  }
}

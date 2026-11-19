import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DEFAULT_COUNTRY_UNIVERSES } from '../../models/platform.models';
import { CurveCountry } from '../../models/reach-curve.models';
import { DocModalTab, ReachCurvesDocModalComponent } from './reach-curves-doc-modal.component';

function clickTabByLabel(root: HTMLElement, label: string): HTMLButtonElement {
  const tabs = Array.from(root.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
  const target = tabs.find((btn) => btn.textContent?.includes(label));
  expect(target).toBeDefined();
  target!.click();
  return target!;
}

describe('ReachCurvesDocModalComponent', () => {
  let fixture: ComponentFixture<ReachCurvesDocModalComponent>;
  let component: ReachCurvesDocModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReachCurvesDocModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReachCurvesDocModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render dialog when isOpen is false and ignores Escape while closed', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const closedSpy = vi.fn();
    component.closeModal.subscribe(closedSpy);

    expect(component.isOpen()).toBe(false);
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(closedSpy).not.toHaveBeenCalled();

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.querySelector('#curves-doc-modal-title')?.textContent).toContain(
      'Guía Metodológica y Fórmulas de Curvas de Alcance',
    );
  });

  it('emits closeModal on X button, footer button, backdrop click, Escape key, and resets activeTab on reopen', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const closedSpy = vi.fn();
    component.closeModal.subscribe(closedSpy);

    // Clicking inside dialog must NOT trigger backdrop close
    const dialog = el.querySelector('.modal-dialog') as HTMLElement;
    dialog.click();
    fixture.detectChanges();
    expect(closedSpy).not.toHaveBeenCalled();

    // Header close button
    (el.querySelector('.btn-close') as HTMLButtonElement).click();
    expect(closedSpy).toHaveBeenCalledTimes(1);

    // Footer close button
    const footerBtn = el.querySelector('.btn-primary-close') as HTMLButtonElement;
    expect(footerBtn.textContent).toContain('Entendido / Cerrar');
    footerBtn.click();
    expect(closedSpy).toHaveBeenCalledTimes(2);

    // Backdrop click
    (el.querySelector('.modal-backdrop') as HTMLElement).click();
    expect(closedSpy).toHaveBeenCalledTimes(3);

    // Escape keydown
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closedSpy).toHaveBeenCalledTimes(4);

    // Switch tab, close and reopen -> activeTab resets to 'formulas'
    clickTabByLabel(el, 'Reglas de Datos y Diccionarios');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('rules');

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.activeTab()).toBe('formulas');
  });

  it('renders Tab 1 (Fórmulas y Matemática) with OLS, Log vs Linear models, shielding rules, R² traffic light, and practical example', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const tabButtons = Array.from(el.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(tabButtons.map((b) => b.textContent?.trim())).toEqual([
      'Fórmulas y Matemática',
      'Cómo usar esta ventana',
      'Reglas de Datos y Diccionarios',
    ]);
    expect(component.activeTab()).toBe('formulas');

    const text = el.textContent ?? '';

    // Cards 1 & 2
    expect(text).toContain('¿Qué es una Curva de Alcance?');
    expect(text).toContain('Inversión (eje X)');
    expect(text).toContain('Alcance Único de personas (eje Y)');
    expect(text).toContain('Mínimos Cuadrados Ordinarios (OLS)');

    // Card 3: 2 mathematical models
    expect(text).toContain('Curva Logarítmica de Saturación');
    expect(text).toContain('Recomendada');
    expect(text).toContain('Alcance = a · ln(Inversión) + b');
    expect(text).toContain('Regresión Lineal Simple');
    expect(text).toContain('Alcance = m · Inversión + b');

    // Card 4: Shielding rules
    expect(text).toContain('Techo de Universo Poblacional');
    expect(text).toContain('min(Universo, max(0, Proyección))');
    expect(text).toContain('CPMa Ponderado Real');
    expect(text).toContain('CPMa = (Inversión / Alcance) × 1000');
    expect(text).toContain('CPM Imp. = (Inversión / Impresiones) × 1000');
    expect(text).toContain('Deduplicación Cross-Channel');
    expect(text).toContain('R_cross = R1 + R2 - (1.05 × R1 × R2)');

    // Card 5: R² traffic light
    const trafficCards = el.querySelectorAll('.traffic-card');
    expect(trafficCards).toHaveLength(3);
    expect(el.querySelector('.traffic-card--high')?.textContent).toContain('R² ≥ 75%');
    expect(el.querySelector('.traffic-card--high')?.textContent).toContain('Alta precisión');
    expect(el.querySelector('.traffic-card--medium')?.textContent).toContain('50% – 74%');
    expect(el.querySelector('.traffic-card--medium')?.textContent).toContain('Precisión moderada');
    expect(el.querySelector('.traffic-card--low')?.textContent).toContain('< 50% o n < 3');
    expect(el.querySelector('.traffic-card--low')?.textContent).toContain('Baja confiabilidad');

    // Card 6: Practical example
    expect(text).toContain('Meta Colombia · CPM · Corte W4');
    expect(text).toContain('$20M COP');
    expect(text).toContain('8.2M personas');
    expect(text).toContain('$30M COP (+50%)');
    expect(text).toContain('9.1M personas (+11.0%)');
  });

  it('switches to Tab 2 (Cómo usar esta ventana) and displays all 5 operational steps', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const guideTab = clickTabByLabel(el, 'Cómo usar esta ventana');
    fixture.detectChanges();

    expect(component.activeTab()).toBe('guide');
    expect(guideTab.getAttribute('aria-selected')).toBe('true');

    const stepCards = Array.from(el.querySelectorAll('.step-card'));
    expect(stepCards).toHaveLength(5);

    const text = el.textContent ?? '';
    expect(text).toContain('Descargar los 4 Cortes Acumulados');
    expect(text).toContain('W1: días 1 al 7 del mes');
    expect(text).toContain('W2: días 1 al 14 del mes');
    expect(text).toContain('W3: días 1 al 21 del mes');
    expect(text).toContain('W4: mes completo cerrado');
    expect(text).toContain('Regla de Oro');

    expect(text).toContain('Importación Masiva y Actualización Mensual');
    expect(text).toContain('Importar Reportes Excel');
    expect(text).toContain('Guardar en la nube mediante actualización incremental (Upsert)');

    expect(text).toContain('Configurar Tasas de Cambio (TRM)');
    expect(text).toContain('TRM Casaca (COP → USD)');
    expect(text).toContain('TRM México (MXN → USD)');

    expect(text).toContain('Simular Curva Individual y Tabla de Escenarios');
    expect(text).toContain('Simular Mix Cross-Channel y Enviar a la Matriz Principal');
    expect(text).toContain('Enviar a Matriz Cross Reach');
  });

  it('switches to Tab 3 (Reglas de Datos y Diccionarios) and renders countries, exclusions, stage/buyType, and DV360 split', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const rulesTab = clickTabByLabel(el, 'Reglas de Datos y Diccionarios');
    fixture.detectChanges();

    expect(component.activeTab()).toBe('rules');
    expect(rulesTab.getAttribute('aria-selected')).toBe('true');

    const text = el.textContent ?? '';

    // Active countries and official universes
    const expectedCountries: readonly CurveCountry[] = [
      'Colombia',
      'Mexico',
      'Chile',
      'Peru',
      'Costa Rica',
    ];
    for (const country of expectedCountries) {
      expect(text).toContain(country);
      const formattedUniverse = Math.round(DEFAULT_COUNTRY_UNIVERSES[country]).toLocaleString(
        'es-ES',
      );
      expect(text).toContain(formattedUniverse);
    }

    // Exclusions
    for (const excluded of ['Panamá', 'Bolivia', 'Guatemala', 'El Salvador', 'Uruguay']) {
      expect(text).toContain(excluded);
    }

    // Stages & Buy Types
    for (const stage of ['ATT', 'CON', 'LOY', 'PUR']) {
      expect(text).toContain(stage);
    }
    for (const buyType of ['CPC', 'CPM', 'CPV', 'CPE', 'CPL', 'CPA']) {
      expect(text).toContain(buyType);
    }

    // DV360 YouTube vs Display separation
    const ytGroup = el.querySelector('.dv360-group--youtube')?.textContent ?? '';
    for (const ytFormat of [
      'Bumper Ad',
      'Non-Skip Trueview',
      'Non-Skip',
      'Skippable Trueview',
      'Demand Gen',
    ]) {
      expect(ytGroup).toContain(ytFormat);
    }

    const displayGroup = el.querySelector('.dv360-group--display')?.textContent ?? '';
    for (const displayFormat of ['Standard Banners', 'Handraisers', 'Online Video']) {
      expect(displayGroup).toContain(displayFormat);
    }
  });

  it('never exposes Supabase/PostgreSQL/UUID or monospace font classes across any tab', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const tabs: readonly DocModalTab[] = ['formulas', 'guide', 'rules'];

    for (const tab of tabs) {
      component.setTab(tab);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(el.textContent ?? '').not.toMatch(/supabase|postgresql|postgres|uuid/i);
      expect(el.querySelector('.font-mono')).toBeNull();
      expect(el.innerHTML.toLowerCase()).not.toContain('monospace');
      expect(el.innerHTML.toLowerCase()).not.toContain('font-mono');
    }
  });
});

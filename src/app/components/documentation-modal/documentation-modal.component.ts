import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-documentation-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-title-group">
            <div class="header-icon">
              <span>📖</span>
            </div>
            <div>
              <h2 class="modal-title">Documentación Técnica del Modelo de Multialcance</h2>
              <p class="modal-subtitle">Fundamentos matemáticos, deduplicación de audiencias y metodología de cálculo</p>
            </div>
          </div>
          <button type="button" class="btn-close" (click)="close.emit()" aria-label="Cerrar">✕</button>
        </div>

        <!-- Modal Body / Content -->
        <div class="modal-body">
          <!-- Sección 1: El reto del solapamiento -->
          <section class="doc-section">
            <div class="section-tag">01. Fundamento Conceptual</div>
            <h3 class="section-heading">¿Por qué no se pueden sumar los alcances de diferentes plataformas?</h3>
            <p class="section-text">
              En una estrategia publicitaria omnicanal (Meta, YouTube, TikTok, Display, etc.), los usuarios suelen estar activos simultáneamente en múltiples redes. Si un anunciante suma directamente los alcances brutos:
            </p>
            <div class="formula-callout error-callout">
              <span class="callout-badge error-badge">Inexacto</span>
              <code>Alcance Bruto = Alcance(Meta) + Alcance(YouTube) + Alcance(TikTok)</code>
              <p class="callout-desc">
                Esta suma simple cuenta múltiples veces a la misma persona si vio anuncios en más de un canal, inflando artificialmente el alcance real de la campaña.
              </p>
            </div>
          </section>

          <!-- Sección 2: El Modelo Probabilístico -->
          <section class="doc-section">
            <div class="section-tag">02. Formulación Matemática</div>
            <h3 class="section-heading">Modelo de Deduplicación Probabilística Iterativa</h3>
            <p class="section-text">
              Nuestra plataforma implementa un modelo estocástico de solapamiento de conjuntos probabilísticos ponderados. La tasa de alcance conjunto para dos canales independientes se calcula eliminando la intersección solapada:
            </p>

            <div class="math-box">
              <div class="math-title">Fórmula Base de 2 Canales:</div>
              <div class="math-formula">
                R<sub>1,2</sub> = R<sub>1</sub> + R<sub>2</sub> - (1.05 &times; R<sub>1</sub> &times; R<sub>2</sub>)
              </div>
              <div class="math-legend">
                <div class="legend-item">
                  <span class="legend-var">R<sub>1</sub>, R<sub>2</sub>:</span>
                  <span>Porcentajes de alcance de cada canal sobre el universo poblacional (valores entre 0 y 1).</span>
                </div>
                <div class="legend-item">
                  <span class="legend-var">1.05:</span>
                  <span>Factor de afinidad empírico de co-exposición cruzada en ecosistemas digitales en Latinoamérica.</span>
                </div>
                <div class="legend-item">
                  <span class="legend-var">R<sub>1,2</sub>:</span>
                  <span>Tasa de multialcance neto resultante (sin duplicados).</span>
                </div>
              </div>
            </div>

            <div class="doc-subsection">
              <h4 class="subheading">Algoritmo Iterativo para Múltiples Plataformas (N &ge; 3):</h4>
              <p class="section-text">
                Cuando intervienen 3 o más redes publicitarias, el sistema aplica un proceso iterativo de acumulación ordenada descendente:
              </p>
              <ol class="steps-list">
                <li>
                  <strong>Ordenamiento prioritario:</strong> Se ordenan las plataformas activas de mayor a menor alcance individual:
                  <code>R<sub>(1)</sub> &ge; R<sub>(2)</sub> &ge; ... &ge; R<sub>(n)</sub></code>
                </li>
                <li>
                  <strong>Inicialización:</strong> Se establece el acumulador con el canal principal:
                  <code>R<sub>acum</sub> = R<sub>(1)</sub></code>
                </li>
                <li>
                  <strong>Iteración sucesiva:</strong> Para cada canal siguiente <code>i = 2...n</code>:
                  <code>R<sub>acum</sub> = R<sub>acum</sub> + R<sub>(i)</sub> - (1.05 &times; R<sub>acum</sub> &times; R<sub>(i)</sub>)</code>
                </li>
                <li>
                  <strong>Acotación de límites:</strong> El resultado se normaliza estrictamente entre 0% y 100%:
                  <code>R<sub>final</sub> = min(max(R<sub>acum</sub>, 0), 1)</code>
                </li>
                <li>
                  <strong>Volumen neto de personas:</strong> Se multiplica por el universo total del país o región:
                  <code>Volumen Neto = R<sub>final</sub> &times; Universo</code>
                </li>
              </ol>
            </div>
          </section>

          <!-- Sección 3: Ejemplo Práctico -->
          <section class="doc-section">
            <div class="section-tag">03. Caso Práctico Demostrativo</div>
            <h3 class="section-heading">Ejemplo Paso a Paso en Colombia (Universo: 38.000.000 personas)</h3>
            <div class="example-grid">
              <div class="example-card">
                <span class="example-badge">Datos de Entrada</span>
                <ul class="example-list">
                  <li><strong>Meta:</strong> 40.0% (15.200.000 pers.)</li>
                  <li><strong>YouTube:</strong> 30.0% (11.400.000 pers.)</li>
                  <li><strong>TikTok:</strong> 20.0% (7.600.000 pers.)</li>
                  <li><em class="text-slate-500">Suma Bruta sin deduplicar: 90.0% (34.200.000)</em></li>
                </ul>
              </div>

              <div class="example-card">
                <span class="example-badge">Deduplicación Aplicada</span>
                <div class="calc-step">
                  <div class="step-num">Paso 1: Meta + YouTube</div>
                  <div class="step-calc">
                    0.40 + 0.30 - (1.05 &times; 0.40 &times; 0.30)<br>
                    = 0.70 - 0.126 = <strong>57.40%</strong>
                  </div>
                </div>
                <div class="calc-step">
                  <div class="step-num">Paso 2: Acumulado + TikTok</div>
                  <div class="step-calc">
                    0.574 + 0.20 - (1.05 &times; 0.574 &times; 0.20)<br>
                    = 0.774 - 0.1205 = <strong>65.35%</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="result-summary-box">
              <div class="res-item">
                <span class="res-label">Multialcance Neto Final</span>
                <span class="res-value highlight">65.35%</span>
                <span class="res-desc">24.833.000 personas únicas</span>
              </div>
              <div class="res-item">
                <span class="res-label">Impactos Duplicados Prevenidos</span>
                <span class="res-value text-emerald-600">9.367.000</span>
                <span class="res-desc">24.65% de solapamiento depurado</span>
              </div>
            </div>
          </section>

          <!-- Sección 4: Mercados Agregados -->
          <section class="doc-section">
            <div class="section-tag">04. Consolidación Regional</div>
            <h3 class="section-heading">Mercados Agregados (Casaca y Latam)</h3>
            <p class="section-text">
              Para los bloques regionales, el sistema suma los universos de los países componentes y los alcances individuales de cada red, y luego ejecuta el modelo iterativo sobre el universo consolidado:
            </p>
            <div class="regions-list">
              <div class="region-pill">
                <strong>Casaca:</strong> Se calcula automáticamente cuando están presentes 2 o más países de [Colombia, Chile, Perú, Costa Rica].
              </div>
              <div class="region-pill">
                <strong>Latam:</strong> Se calcula automáticamente cuando está presente México más al menos otro país de la región.
              </div>
            </div>
          </section>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button type="button" class="btn-primary" (click)="close.emit()">
            <span>Entendido / Cerrar</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 16px;
    }

    .modal-container {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 780px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: scale(0.97) translateY(8px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .header-title-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-icon {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: #e0e7ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .modal-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 2px 0 0;
    }

    .btn-close {
      background: transparent;
      border: 1px solid #cbd5e1;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 14px;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .doc-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .section-tag {
      font-size: 11px;
      font-weight: 700;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .section-heading {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .section-text {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin: 0;
    }

    .formula-callout {
      padding: 16px;
      border-radius: 10px;
      margin-top: 6px;

      &.error-callout {
        background: #fef2f2;
        border: 1px solid #fecaca;
      }

      code {
        display: block;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        font-weight: 600;
        color: #991b1b;
        margin-top: 6px;
      }
    }

    .callout-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;

      &.error-badge {
        background: #fee2e2;
        color: #b91c1c;
      }
    }

    .callout-desc {
      font-size: 13px;
      color: #7f1d1d;
      margin: 6px 0 0;
      line-height: 1.5;
    }

    .math-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      margin-top: 6px;
    }

    .math-title {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }

    .math-formula {
      font-family: 'JetBrains Mono', monospace;
      font-size: 17px;
      font-weight: 700;
      color: #1e1b4b;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 12px 16px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 14px;
    }

    .math-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      color: #475569;
    }

    .legend-item {
      display: flex;
      gap: 8px;
      line-height: 1.4;
    }

    .legend-var {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #312e81;
      min-width: 60px;
    }

    .doc-subsection {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }

    .subheading {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px;
    }

    .steps-list {
      margin: 8px 0 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;

      code {
        font-family: 'JetBrains Mono', monospace;
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        color: #4338ca;
      }
    }

    .example-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 6px;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .example-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
    }

    .example-badge {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      display: block;
      margin-bottom: 8px;
    }

    .example-list {
      margin: 0;
      padding-left: 18px;
      font-size: 13px;
      color: #334155;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .calc-step {
      margin-bottom: 8px;
      &:last-child {
        margin-bottom: 0;
      }
    }

    .step-num {
      font-size: 12px;
      font-weight: 600;
      color: #4338ca;
    }

    .step-calc {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #1e293b;
      background: #ffffff;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      margin-top: 2px;
      line-height: 1.4;
    }

    .result-summary-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 10px;
      padding: 16px;
      margin-top: 10px;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .res-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .res-label {
      font-size: 12px;
      font-weight: 600;
      color: #4338ca;
    }

    .res-value {
      font-size: 24px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: #1e1b4b;

      &.highlight {
        color: #4338ca;
      }
    }

    .res-desc {
      font-size: 12px;
      color: #64748b;
    }

    .regions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
    }

    .region-pill {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #4f46e5;
      padding: 10px 14px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
    }

    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover {
        background: #4338ca;
      }
    }
  `]
})
export class DocumentationModalComponent {
  @Output() close = new EventEmitter<void>();
}

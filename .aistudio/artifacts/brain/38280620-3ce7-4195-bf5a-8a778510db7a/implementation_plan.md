# Ajustes de Visualización en 'Ver Todas', Botones de Exportación por Tarjeta y Control Global de Decimales

Corrección estructural del contenedor de desplazamiento para evitar el corte superior de la primera tabla en la vista 'Ver Todas', implementación de botones de acción compactos (solo iconos) en la cabecera de cada tarjeta individual, y unificación del selector de decimales para que aplique de manera homogénea a todos los porcentajes de la tabla (enteros sin decimales vs dos decimales).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Alcance del Selector de Decimales:** El selector de decimales se aplica globalmente a **todos los porcentajes** de la tabla (tanto a cada medio individual como al total), permitiendo alternar entre:
>   - **Enteros:** `37%`, `30%`, `18%`, `64%` (0 decimales).
>   - **Dos Decimales:** `37.20%`, `29.81%`, `17.56%`, `64.00%` (2 decimales).
> - **Botones de Exportación por Ficha Individual en 'Ver Todas':** Cada tarjeta de país/mercado contará con sus propios botones de acción compactos (solo iconos vectoriales de 28x28px con tooltip):
>   - 📸 **Copiar Imagen** de esa ficha específica.
>   - 📥 **Descargar PNG** de esa ficha específica.
>   - 📋 **Copiar Datos (Excel)** de esa ficha específica.
> - **Corrección de Desplazamiento y Visibilidad:** Se corrige la regla CSS `align-items: center` del contenedor de desplazamiento que provocaba el recorte y ocultamiento de la parte superior de la primera tarjeta, alineando el contenido a `flex-start` para asegurar que todas las tablas sean 100% visibles y desplazables desde el primer pixel.

---

## 1. Overview & Core Concept

1. **Visibilidad Total de la Cuadrícula:** Al abrir 'Ver Todas', el planificador de medios verá inmediatamente la cabecera completa de la primera tabla (`MEDIO | REACH | %`) sin recortes ni solapamientos, con un flujo vertical limpio y fluido.
2. **Acciones Inmediatas por Territorio:** En lugar de tener que salir de 'Ver Todas' para exportar un país concreto, cada tarjeta ofrece sus micro-botones para copiar o descargar esa ficha directamente con un solo clic.
3. **Consistencia Numérica en Porcentajes:** El control de decimales garantiza que no haya discrepancias entre los medios individuales y la fila TOTAL, mostrando una tabla visualmente uniforme.

---

## 2. User Experience & Visual Design

### Nueva Cabecera de Tarjeta en 'Ver Todas':

```
┌────────────────────────────────────────────────────────┐
│  [ COL ] Colombia   Univ: 27,000,000    [ 📸 ] [ 📥 ] [ 📋 ]  <-- Iconos compactos
├────────────────────────────────────────────────────────┤
│  MEDIO          │      REACH        │      %           │
├─────────────────┼───────────────────┼──────────────────┤
│  Meta           │    18,500,000     │   68.52%         │
│  YouTube        │    14,200,000     │   52.59%         │
│  TikTok         │     8,900,000     │   32.96%         │
├─────────────────┼───────────────────┼──────────────────┤
│  TOTAL          │    24,150,000     │   89.44%         │
└────────────────────────────────────────────────────────┘
```

- **Dimensiones de los botones por tarjeta:** Cuadrados de `26x26px`, diseño sutil sin estorbar el espacio visual.
- **Tooltips descriptivos:** *"Copiar imagen de Colombia"*, *"Descargar PNG de Colombia"*, *"Copiar datos de Colombia para Excel"*.
- **Contenedor Scroll:** Cambio de `align-items: center` a `align-items: flex-start; padding-top: 24px;` para garantizar que el primer elemento nunca quede truncado en la parte superior.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                       ReportTableModalComponent                        │
├────────────────────────────────────────────────────────────────────────┤
│  decimals = signal<0 | 2>(0)  <-- Aplica a getPercentage() & Total     │
│  formatPercentage(val) = val.toFixed(decimals()) + '%'                 │
│  formatTotalPercentage(val) = val.toFixed(decimals()) + '%'            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     Acciones Globales         │       │    Acciones por Tarjeta       │
│ • Exportar Mosaico Completo   │       │ • copySingleCard(target, el)  │
│ • Cambiar Vistas              │       │ • downloadSingleCard(target)  │
│ • Selector de Decimales       │       │ • copySingleTsv(target)       │
└───────────────────────────────┘       └───────────────────────────────┘
```

1. **Lógica de Formato Homogénea:**
   - La función `formatPercentage(val)` leerá directamente `this.decimals()` (0 o 2).
   - La función `formatMatrixPercentage(val)` leerá `this.decimals()`.
   - La función `formatTotalPercentage(val)` leerá `this.decimals()`.
   - Resultado: Todos los porcentajes de la vista se transforman simultáneamente de `37%` a `37.20%` y viceversa.
2. **Exportador Individual por Elemento HTML:**
   - Se crea un método `copyTargetImage(target, targetElement)` y `downloadTargetImage(target, targetElement)` que renderiza únicamente el nodo DOM de esa ficha mediante `toBlob`/`toPng` con `pixelRatio: 2.5`.

---

## 4. Plan de Tareas de Implementación

1. **Actualizar `ReportTableModalComponent`:**
   - Corregir el CSS de `.table-preview-scroll` (`align-items: flex-start; justify-content: center; padding-top: 24px;`).
   - Unificar la señal `decimals = signal<0 | 2>(0)` para que afecte a todos los porcentajes de la tabla (medios individuales y fila TOTAL).
   - Actualizar el control segmentado en la cabecera: `% Decimales: [ 37% ] [ 37.20% ]`.
   - Agregar en cada tarjeta de 'Ver Todas' la barra de herramientas compacta con 3 iconos vectoriales (Copiar Imagen, Descargar PNG, Copiar Excel).
   - Implementar los manejadores individuales de captura y copia TSV por tarjeta.
2. **Verificación y Compilación:**
   - Ejecutar `compile_applet`, verificar la ausencia de errores y validar la respuesta del servidor en vivo.

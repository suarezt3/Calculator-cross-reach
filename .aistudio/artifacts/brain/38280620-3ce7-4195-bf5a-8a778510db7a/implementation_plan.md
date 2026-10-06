# Unificación de Vistas de Reporte: Matriz Multi-País, Ficha Individual y Vista Adaptativa

Estructuración del modal de descarga y captura (`ReportTableModalComponent`) con un selector de tres modos de visualización ejecutiva: **Matriz Multi-País** (formato original con selección de múltiples países en columnas y filas de plataformas), **Ficha Individual** (tabla vertical `MEDIO | REACH | %` según la imagen de referencia, con pestañas por iniciales `COL`, `CHL`, `PER`, `CRI`, `MX`) y **Ver Todas** (cuadrícula completa donde cada tarjeta omite automáticamente los medios sin pauta en ese país).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Tres Vistas en el Modal de Reporte:**
>   1. **📊 Matriz Multi-País:** Conserva la tabla original comparativa donde se pueden marcar varios países simultáneamente como columnas (`COL`, `CHL`, etc.) y las plataformas en filas con porcentajes, volumen total y total %.
>   2. **📑 Ficha Individual:** La tabla vertical exacta de la referencia (`MEDIO`, `REACH`, `%` y fila `TOTAL` en verde salvia), seleccionando el país mediante iniciales compactas (`COL`, `CHL`, `PER`, `CRI`, `MX`, `CASACA`, `LATAM`).
>   3. **🗂️ Ver Todas (Cuadrícula):** Tarjetas simultáneas para cada país/mercado.
> - **Ajuste Dinámico por Medios Activos:** En las fichas ejecutivas (individual y cuadrícula), cada tabla muestra **únicamente los medios que tuvieron alcance activo** en ese territorio (si en Costa Rica no hubo Disney o Display, no se muestran en esa tabla).
> - **Iniciales Amigables de Países:** Pestañas y cabeceras etiquetadas como **`COL`**, **`CHL`**, **`PER`**, **`CRI`**, **`MX`**, **`CASACA`** y **`LATAM`**.

---

## 1. Overview & Core Concept

El usuario final tendrá la flexibilidad de exportar la información en el formato que mejor se adapte a su presentación:
1. **Para visión regional o comparativa:** La *Matriz Multi-País*, con selección dinámica de qué países incluir mediante chips y sumatoria deduplicada.
2. **Para entrega ejecutiva por cliente/país:** La *Ficha Individual*, con la gráfica limpia y formal de la referencia.
3. **Para reporte condensado de campaña:** La vista *Ver Todas*, con un lienzo limpio donde cada país tiene su tarjeta ajustada únicamente a sus medios reales.

---

## 2. User Experience & Visual Design

### Navegación Superior del Modal:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  [ 📊 Matriz Multi-País ]    [ 📑 Ficha Individual ]    [ 🗂️ Ver Todas ]                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Iniciales:  [ COL ]  [ CHL ]  [ PER ]  [ CRI ]  [ MX ]  [ CASACA ]  [ LATAM ]         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Comportamiento de las Vistas:

#### Vista 1: Matriz Multi-País (La vista original solicitada)
- Selector de chips de países con checkboxes: Permite marcar y desmarcar qué países y mercados entran en la tabla comparativa.
- Cabecera: `COL`, `CHL`, `PER`, `CRI`, `MX`, `CASACA`, `LATAM`.
- Filas de plataformas con % de cobertura por territorio.
- Filas de cierre: `Volumen total` y `Total %` deduplicado.

#### Vista 2: Ficha Individual (Referencia de imagen)
- Pestañas con iniciales (`COL`, `CHL`, `PER`, `CRI`, `MX`, `CASACA`, `LATAM`).
- Cabecera azul marino `#0f1f3d` (`MEDIO`, `REACH`, `%`).
- **Solo medios activos**: Si Costa Rica tuvo Meta, YouTube y TikTok pero no Disney o Display, la tabla solo contiene 3 filas de medios + la fila verde `TOTAL`.
- Fila `TOTAL` en verde salvia pastel `#c8dfc4`.

#### Vista 3: Ver Todas (Cuadrícula)
- Muestra una cuadrícula de tarjetas lado a lado de todos los territorios seleccionados.
- Cada tarjeta se adapta individualmente: muestra el nombre/código del país y su lista exclusiva de medios con pauta real.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ReportTableModalComponent                       │
├────────────────────────────────────────────────────────────────────────┤
│  viewMode: 'multi_matrix' | 'single_card' | 'all_grid'                 │
│  activeColumnKeys: Set<string> (para Matriz Multi-País)                │
│  selectedTargetKey: string (para Ficha Individual)                     │
│  countryCodeMap: 'colombia' -> 'COL', 'mexico' -> 'MX', etc.           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  Matriz Multi-País   │  │   Ficha Individual   │  │   Ver Todas Grid     │
│ • Columnas = Países  │  │ • Solo medios > 0    │  │ • N tarjetas         │
│ • Filas = Medios     │  │ • Cabecera azul      │  │ • Cada una con       │
│ • Totales abajo      │  │ • TOTAL verde salvia │  │   sus medios activos │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

1. **Normalización de Iniciales:**
   - Se actualiza el diccionario de códigos de país para que México use **`MX`** (y `COL`, `CHL`, `PER`, `CRI`, `CASACA`, `LATAM`).
2. **Filtrado Dinámico de Medios Activos:**
   - La función `getMediaRowsForTarget(target)` filtrará exclusivamente `p.reach > 0` para que no aparezcan filas vacías en países donde no hubo inversión en ese medio (por ejemplo, Disney o Display en Costa Rica).
3. **Exportación Contextual:**
   - Al hacer clic en `Copiar Imagen`, `Descargar PNG` o `Copiar Datos (Excel)`, la exportación se adapta automáticamente a la vista activa (`multi_matrix`, `single_card` o `all_grid`).

---

## 4. Plan de Tareas de Implementación

1. **Actualizar `ReportTableModalComponent`:**
   - Añadir la señal de estado `viewMode = signal<'multi_matrix' | 'single_card' | 'all_grid'>('multi_matrix')`.
   - Incorporar el selector superior de tres vistas.
   - Enriquecer el mapeo de iniciales para utilizar exactamente `COL`, `CHL`, `PER`, `CRI`, `MX`, `CASACA` y `LATAM`.
   - Reintegrar la vista de **Matriz Multi-País** con selección múltiple de columnas mediante chips.
   - Implementar el filtrado estricto de medios activos (`reach > 0`) para la **Ficha Individual** y la cuadrícula **Ver Todas**.
   - Ajustar los generadores de TSV para Excel y captura de imagen según la vista activa.
2. **Verificación y Compilación:**
   - Ejecutar `compile_applet`, verificar ausencia de errores de compilación y validar el servidor en vivo.

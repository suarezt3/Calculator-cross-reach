# Corrección de Exportación en Ficha Individual y Cabecera Ejecutiva con Bandera de País

Solución al problema de datos vacíos al copiar o descargar en la vista de Ficha Individual, e incorporación de una cabecera ejecutiva integrada a las tablas individuales (con bandera patria estilizada, código y nombre del país, y universo objetivo) tanto en visualización como en las imágenes PNG y datos de portapapeles exportados.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Causa y Solución de Exportación Vacía:**
>   - La clave `selectedTargetKey` utilizaba identificadores dinámicos que quedaban desincronizados al recalcular la matriz, provocando que `selectedTarget()` evaluara a `null` y se copiara/descargara contenido en blanco.
>   - Se normaliza la vinculación por nombre canónico de país (`country.toLowerCase()`), garantizando que siempre exista un objetivo activo y que tanto la imagen del lienzo como el texto para Excel capturen los datos reales de la ficha.
> - **Cabecera Ejecutiva con Bandera Nacional:**
>   - Toda tabla individual (tanto en **Ficha Individual** como en las tarjetas de **Ver Todas**) incluirá en su parte superior una barra ejecutiva con la bandera del país en gráficos vectoriales nítidos (amarillo, azul y rojo para Colombia; tricolor con escudo para México; franja azul, estrella y rojo para Chile; rojo y blanco para Perú; azul, blanco y rojo para Costa Rica; y distintivos regionales para Casaca y Latam).
>   - Se muestran las iniciales (`COL`, `MX`, etc.), el nombre completo del país y el universo demográfico.
>   - Esta cabecera forma parte del bloque de captura, de modo que al descargar el PNG o copiar la imagen, el archivo contiene formalmente el país identificado.

---

## 1. Overview & Core Concept

1. **Exportación 100% Confiable:** Al hacer clic en *Copiar Imagen*, *Descargar PNG* o *Copiar Datos (Excel)* en Ficha Individual, el sistema exporta de inmediato la tabla con sus medios activos, cifras y totales, sin vacíos ni pantallas blancas.
2. **Identificación Inmediata en Presentaciones:** Al pegar la imagen capturada en PowerPoint o enviarla por Slack, cualquier persona identificará al instante el mercado gracias a la bandera y el encabezado del país sobre la tabla de medios.

---

## 2. User Experience & Visual Design

### Nueva Ficha Individual Ejecutiva con Bandera (Captura y Visualización):

```
┌────────────────────────────────────────────────────────┐
│  🇨🇴  COL · COLOMBIA              Universo: 27,000,000  │  <-- Cabecera con Bandera
├─────────────────┬───────────────────┬──────────────────┤
│  MEDIO          │      REACH        │      %           │  <-- Cabecera azul marino (#0f1f3d)
├─────────────────┼───────────────────┼──────────────────┤
│  Meta           │    18,500,000     │   69%            │
│  YouTube        │    14,200,000     │   53%            │
│  TikTok         │     8,900,000     │   33%            │
│  Netflix        │     1,850,000     │    7%            │
│  Disney         │     1,100,000     │    4%            │
│  Display        │     2,400,000     │    9%            │
│  OOH            │       950,000     │    4%            │
│  DOOH           │       550,000     │    2%            │
├─────────────────┼───────────────────┼──────────────────┤
│  TOTAL          │    24,150,000     │   89%            │  <-- Fila verde salvia (#c8dfc4)
└─────────────────┴───────────────────┴──────────────────┘
```

- **Renderizado de Banderas:** Gráficos vectoriales SVG puros integrados directamente en el DOM, garantizando renderizado instantáneo en `html-to-image` sin peticiones externas ni problemas de CORS.
- **Formato TSV para Excel:**
  ```tsv
  PAÍS: COLOMBIA (COL)	UNIVERSO: 27,000,000
  MEDIO	REACH	%
  Meta	18,500,000	69%
  YouTube	14,200,000	53%
  ...
  TOTAL	24,150,000	89%
  ```

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ReportTableModalComponent                       │
├────────────────────────────────────────────────────────────────────────┤
│  selectedTargetKey: string (ej: 'colombia', 'mexico', 'peru')          │
│  selectedTarget = computed(() => list.find(r => r.country === key))   │
│  singleCardCanvas: ElementRef (Contenedor que incluye Bandera + Tabla) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     Captura de Imagen (PNG)   │       │     Copiado TSV (Excel)       │
│ • toBlob(singleCardCanvas)    │       │ • Encabezado de País + Univ   │
│ • pixelRatio: 2.5 (Retina)    │       │ • Filas de Medios Activos     │
│ • Descarga o Portapapeles     │       │ • Fila TOTAL Deduplicado      │
└───────────────────────────────┘       └───────────────────────────────┘
```

1. **Resolución del Fallo de Datos Vacíos:**
   - La selección del país se amarra de manera inmutable al nombre canónico (`country.toLowerCase()`).
   - Se asegura que `#singleCardCanvas` envuelva tanto la cabecera del país con bandera como la tabla, y que `copyImageToClipboard` y `downloadAsPng` capturen exactamente ese nodo activo.
2. **Generador SVG de Banderas:**
   - Función auxiliar o template con los vectores oficiales de Colombia, México, Chile, Perú, Costa Rica, Casaca y Latam.

---

## 4. Plan de Tareas de Implementación

1. **Actualizar `ReportTableModalComponent`:**
   - Corregir la reactividad de `selectedTargetKey` y `selectedTarget`.
   - Incorporar la cabecera ejecutiva con bandera SVG a la ficha individual y a las tarjetas de 'Ver Todas'.
   - Ajustar el selector de nodo en `copyImageToClipboard` y `downloadAsPng` para enfocar directamente el contenedor de la ficha seleccionada.
   - Enriquecer `copyAsSpreadsheetTsv` para incluir el país y su universo en los datos tabulados de Excel.
2. **Verificación y Compilación:**
   - Ejecutar `compile_applet`, verificar la compilación sin errores y probar la respuesta del servidor en vivo.

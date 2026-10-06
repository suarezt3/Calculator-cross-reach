# Corrección Definitiva de Recorte de Imagen e Integración de Botones en Cada Cabecera de Tabla

Solución al desfase horizontal y recorte en la generación de imágenes en **Matriz Multi-País** y **Ficha Individual**, e integración uniforme de los botones de acción (Copiar Imagen, Descargar PNG, Copiar Datos Excel) directamente en la cabecera de cada tabla en las tres vistas del reporte.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Integración de Botones en la Cabecera de Cada Tabla:** En todas las vistas (**Matriz Multi-País**, **Ficha Individual** y **Ver Todas**), los botones de acción se ubican directamente en la cabecera de la tabla que representan, permitiendo una interacción contextual e inmediata y eliminando la barra superior redundante.
> - **Causa Técnica del Recorte Lateral en la Imagen Exportada:**
>   - Las imágenes adjuntas evidenciaron un amplio espacio en blanco en el costado izquierdo con la tabla desplazada hacia la derecha y recortada en el borde.
>   - Esto ocurría porque el contenedor con `justify-content: center` y márgenes automáticos transfería un desplazamiento horizontal (`offsetLeft` / `left` relativo) al clon virtual de `html-to-image` dentro del `<foreignObject>`.
>   - En la opción de *Ver Todas*, la exportación funcionaba con total precisión porque capturaba una caja independiente con dimensiones exactas sin desfases de centrado flex.
>   - Se aplicará esa misma estructura a las tres vistas, complementado con normalización explícita de estilo (`margin: 0`, `transform: none`, `width: scrollWidth`) en `toBlob` y `toPng`.

---

## 1. Overview & Core Concept

1. **Imágenes Centradas al 100% Sin Desfase:** Al exportar la Matriz Multi-País o la Ficha Individual, la imagen PNG o copiada al portapapeles se generará ajustada exactamente al ancho y alto real del contenido, sin espacios vacíos a la izquierda ni tablas cortadas a la derecha.
2. **Experiencia de Usuario Homogénea:** Todas las vistas comparten la misma interacción: la cabecera de la tabla contiene su título, bandera/identificador, métricas y los tres botones de exportación compactos (📸, 📥, 📋).

---

## 2. User Experience & Visual Design

### Cabecera Unificada para las Tres Vistas:

#### Vista 1: Matriz Multi-País
```
┌────────────────────────────────────────────────────────────────────────┐
│  📊 Matriz Comparativa Regional (4 Países)       [ 📸 ] [ 📥 ] [ 📋 ]  │  <-- Botones en cabecera
├─────────────────┬───────────┬───────────┬───────────┬──────────┬───────┤
│  MEDIO          │    COL    │    MX     │    PER    │   CHL    │ ...   │
├─────────────────┼───────────┼───────────┼───────────┼──────────┼───────┤
│  Meta           │    69%    │    37%    │    82%    │   82%    │ ...   │
│  ...            │    ...    │    ...    │    ...    │   ...    │ ...   │
├─────────────────┼───────────┼───────────┼───────────┼──────────┼───────┤
│  Volumen total  │24.150.000 │34.135.252 │15.200.000 │7.800.000 │ ...   │
│  Total %        │    89%    │    64%    │    82%    │   82%    │ ...   │
└─────────────────┴───────────┴───────────┴───────────┴──────────┴───────┘
```

#### Vista 2: Ficha Individual
```
┌────────────────────────────────────────────────────────────────────────┐
│  🇲🇽  MX · MÉXICO     Universo: 53,000,000        [ 📸 ] [ 📥 ] [ 📋 ]  │  <-- Botones en cabecera
├─────────────────┬───────────────────┬──────────────────────────────────┤
│  MEDIO          │      REACH        │      %                           │
├─────────────────┼───────────────────┼──────────────────────────────────┤
│  Meta           │    19,716,710     │   37%                            │
│  YouTube        │    15,800,616     │   30%                            │
│  ...            │        ...        │   ...                            │
├─────────────────┼───────────────────┼──────────────────────────────────┤
│  TOTAL          │    33,920,000     │   64%                            │
└─────────────────┴───────────────────┴──────────────────────────────────┘
```

#### Vista 3: Ver Todas
- Conserva sus tarjetas individuales en cuadrícula, cada una con su cabecera y sus 3 botones individuales funcionales.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Exportador html-to-image                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│       Estructura DOM          │       │    Parámetros de Captura      │
│ • Bloque autónomo fit-content │       │ • width: element.scrollWidth  │
│ • Sin offset flex en ancestro │       │ • height: element.scrollHeight│
│ • Contenedor directo sin      │       │ • style: { margin: 0,         │
│   márgenes desfasados         │       │     transform: 'none' }       │
└───────────────────────────────┘       └───────────────────────────────┘
```

1. **Aislamiento del Nodo a Capturar:**
   - La tabla y su cabecera se encapsulan en una caja con clase `.exportable-card-box` (`display: flex; flex-direction: column; width: fit-content; min-width: 320px; box-sizing: border-box;`).
   - El contenedor scroll padre usa `display: block; overflow: auto; text-align: center;` con el hijo en `display: inline-block; text-align: left;`, lo que elimina los desfases de coordenadas relativas en WebKit y Blink.
2. **Parámetros Explícitos de Exportación:**
   - Se asegura que `html-to-image` reciba `width: node.scrollWidth`, `height: node.scrollHeight` y `style: { margin: '0', transform: 'none', left: '0', top: '0', position: 'static' }`.
3. **Copiado de Datos TSV:**
   - En la Matriz: Exporta la tabla completa comparativa con columnas de países y filas de plataformas.
   - En la Ficha Individual: Exporta los datos de ese país con su encabezado oficial de universo.

---

## 4. Plan de Tareas de Implementación

1. **Actualizar `ReportTableModalComponent`:**
   - Incorporar los botones de acción (Copiar Imagen, Descargar PNG, Copiar Datos Excel) en la cabecera de la **Matriz Multi-País**.
   - Incorporar los botones de acción en la cabecera de la **Ficha Individual**.
   - Eliminar la barra de exportación superior redundante para dejar un espacio limpio y directo.
   - Reestructurar el CSS del lienzo scroll para usar un contenedor `inline-block` aislado sin desfases de flex centering.
   - Ajustar los métodos `copyElementImage`, `downloadElementPng` y `copyAsSpreadsheetTsv` para pasar parámetros de dimensiones libres de offset a `toBlob` y `toPng`.
2. **Verificación y Compilación:**
   - Ejecutar `compile_applet`, verificar compilación y validar el servidor en vivo.

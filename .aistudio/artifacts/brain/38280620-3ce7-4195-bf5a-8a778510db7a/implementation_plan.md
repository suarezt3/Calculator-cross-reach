# Ajuste Tipográfico 'Plus Jakarta Sans' y Nombres Completos de Mercados

Actualización del estilo visual de la tabla condensada para reportes mediante la integración tipográfica de la fuente corporativa de alta legibilidad **Plus Jakarta Sans** (con numerales tabulares nítidos) y la presentación en mayúsculas completas de los mercados regionales agregados (**CASACA** y **LATAM** en lugar de códigos abreviados).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Tipografía de la Tabla de Reporte:** Adopción formal de **Plus Jakarta Sans** para todos los encabezados y celdas de la tabla (emparejada con alineación `tabular-nums` para los datos porcentuales y de volumen).
> - **Visualización de Mercados Agregados:** Mostrar el nombre completo en mayúsculas: **CASACA** y **LATAM** (reemplazando `CAS` y `LAT`), manteniendo los códigos de 3 letras para los países individuales (`COL`, `CHL`, `PER`, `CRI`, etc.).

---

## 1. Overview & Core Concept

- **Alineación Visual y Claridad:** Los reportes ejecutivos destinados a clientes y comités directivos requieren máxima claridad semántica. Mientras que los países se reconocen universalmente por sus códigos ISO de 3 letras (`COL`, `CHL`), los bloques comerciales (`Casaca` y `Latam`) necesitan mostrar su nombre completo (**CASACA** y **LATAM**) para evitar confusiones o interpretaciones erróneas.
- **Tipografía Formal y Pulida:** Se aplicará formalmente la familia tipográfica **Plus Jakarta Sans** (importada con pesos 500, 600, 700 y 800), dotando a la tabla de una presencia limpia, moderna y con espaciado óptimo entre letras (`letter-spacing: -0.01em` en cabeceras y `0.02em` en mayúsculas), perfecta para capturas en presentaciones corporativas.

---

## 2. User Experience & Visual Changes

1. **Encabezados de Columna:**
   - Países individuales: Se mantienen los códigos de 3 letras (`COL`, `CHL`, `PER`, `CRI`, `MEX`, etc.) en negrita con fondo azul pastel `#B8D4EE`.
   - Mercados regionales: Se muestran con su nombre íntegro en mayúsculas: **CASACA** y **LATAM**.
2. **Tipografía Global de la Tabla:**
   - Familia de fuente: `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`.
   - Encabezado: Peso `700`, tamaño `15px`, color `#0a1f33`, contraste óptimo sobre `#B8D4EE`.
   - Filas de plataforma y totales: Peso `600` para etiquetas y peso `500` con `tabular-nums` para cifras.
   - Copia de imagen y descarga PNG mantendrán exactamente este renderizado vectorial nítido a 2.5x.

---

## 3. Plan de Tareas de Implementación

1. **Actualización de Mapeo de Cabeceras en `ReportTableModalComponent`:**
   - Ajustar `getCountryCode(country)` para que devuelva explícitamente `'CASACA'` cuando sea el mercado Casaca y `'LATAM'` cuando sea el mercado Latam.
2. **Aplicación de Estilo Tipográfico:**
   - Configurar la regla CSS `font-family: 'Plus Jakarta Sans', -apple-system, sans-serif` en `.report-table`, `.country-header-cell`, `.platform-row-header` y celdas numéricas.
3. **Verificación y Pruebas:**
   - Ejecutar `compile_applet` y validar que el dev server compile sin advertencias.

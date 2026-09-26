# Plan de Integración de Logos Oficiales

Integrar los logotipos oficiales de **Meta**, **YouTube**, **TikTok** (basados exactamente en las imágenes subidas) y el icono de **Display** en toda la experiencia de usuario.

---

## 1. Integración de Activos Gráficos
- **Meta**: Símbolo oficial de bucle infinito en azul `#0064E0` con curvatura y proporciones idénticas a la imagen oficial provista.
- **YouTube**: Botón de reproducción rojo `#FF0000` con triángulo blanco y proporciones oficiales idénticas a la imagen provista.
- **TikTok**: Isotipo de nota musical con efecto cromático cian/magenta (`#25F4EE` y `#FE2C55`) sobre fondo oscuro `#000000` idéntico a la imagen provista.
- **Display**: Icono corporativo de banner publicitario / display digital `#0284C7`.

---

## 2. Ajustes en Componentes
1. **`src/app/shared/components/platform-icon/platform-icon.component.ts`**:
   - Actualización de los vectores SVG con coordenadas de alta resolución que reproducen con total precisión los logos adjuntados tanto en formato isotipo como en contenedores compactos (tarjetas, modales, encabezados de tabla).
2. **`src/app/models/platform.models.ts`**:
   - Validación de la suite: `['Meta', 'YouTube', 'TikTok', 'Display']`.
3. **`src/app/components/platform-form/platform-form.component.html` & SCSS**:
   - Reflejo visual de los logos en las tarjetas interactivas de alcance y en el modal de selección de plataformas.
4. **`src/app/components/results-table/results-table.component.html`**:
   - Visualización nítida de los logos en las columnas de la matriz analítica.
5. **Compilación y verificación**:
   - Ejecución de `compile_applet` y recarga del servidor.

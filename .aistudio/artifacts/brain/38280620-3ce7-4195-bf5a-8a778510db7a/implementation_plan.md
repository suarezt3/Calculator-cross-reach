# Plan para Crear Carpeta de Iconos e Integrar Archivos PNG Nativos

## Objetivo
Atender la solicitud directa del usuario: crear una carpeta dedicada de iconos (`/public/icons/`) que contenga los archivos de imagen `.png` oficiales con los nombres exactos provistos (`Meta_Logo.png`, `Youtube.png`, `tiktok.png`, `display.png`) y actualizar la aplicación para que apunte directamente a estas imágenes.

---

## 1. Creación de la Carpeta de Iconos y Generación de Archivos PNG
- Crear el directorio `public/icons/` y `src/assets/icons/platforms/`.
- Generar los archivos PNG de alta resolución idénticos a los adjuntados por el usuario:
  - `public/icons/Meta_Logo.png`: Símbolo de bucle infinito en azul corporativo y tipografía Meta con fondo transparente.
  - `public/icons/Youtube.png`: Botón de reproducción rojo con triángulo blanco y tipografía oficial YouTube.
  - `public/icons/tiktok.png`: Badge negro con nota musical en aberración cian/magenta y tipografía TikTok.
  - `public/icons/display.png`: Isotipo de red publicitaria Display.

---

## 2. Apuntar el Código Directamente a la Carpeta de Iconos
- Actualizar `src/app/shared/components/platform-icon/platform-icon.component.ts`:
  - Enrutar las imágenes a `/icons/Meta_Logo.png`, `/icons/Youtube.png`, `/icons/tiktok.png`, `/icons/display.png`.
  - Usar etiquetas nativas `<img [src]="iconPath" [alt]="platformName" />` con renderizado nítido.
- Sincronizar en:
  - Tarjetas de alcance individual (`platform-form`)
  - Modal selector de plataformas
  - Cabecera de la tabla de resultados (`results-table`)
  - Tarjetas de KPIs ejecutivos (`kpi-summary`)

---

## 3. Verificación
- Compilar la aplicación con `compile_applet`.
- Reiniciar el servidor de desarrollo y validar que las imágenes PNG se sirvan y muestren correctamente en la interfaz.

# Selector Dinámico de Países y Mercados en Tabla de Reporte

Habilitación de una barra interactiva de selección de países y mercados regionales mediante chips con casillas de verificación en la **Tabla Resumen para Reporte**, permitiendo incluir o excluir columnas específicas antes de copiar o descargar la imagen.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Tipo de Control:** Chips interactivos con casillas de verificación (checkbox) individuales para activar o desactivar cada país con un solo clic.
> - **Gestión de Mercados:** Los mercados agregados (**CASACA** y **LATAM**) se integran directamente como chips seleccionables junto con los países individuales (con un distintivo sutil para diferenciarlos), eliminando interruptores secundarios redundantes.
> - **Acciones Rápidas:** Botones de ayuda *"Seleccionar todos"* y *"Deseleccionar todos"* para agilizar la preparación de reportes enfocado en 1 o 2 países.

---

## 1. Overview & Core Concept

Al generar reportes ejecutivos o capturas para clientes específicos, con frecuencia se necesita presentar únicamente una selección acotada (por ejemplo, solo `COL` y `PER`, o solo `MEX` y `LATAM`), sin necesidad de alterar los datos cargados en la tabla analítica general.

La barra de selección de países dentro del modal de reporte permitirá:
1. Ver de un vistazo qué columnas están activas en el reporte.
2. Alternar la inclusión de cualquier país o mercado con un clic sobre su chip interactivo.
3. Asegurar que al menos 1 columna permanezca seleccionada para mantener la validez visual de la tabla.
4. Generar la imagen y el copiado a portapapeles/Excel considerando exclusivamente las columnas seleccionadas.

---

## 2. User Experience & Visual Layout

### Componentes de la Interfaz:
1. **Barra de Selección de Columnas (Chips Bar):**
   - Ubicada directamente entre la barra de herramientas superior y el lienzo de vista previa de la tabla.
   - Etiqueta explicativa: `Columnas visibles en el reporte (X seleccionadas):`
   - Botones rápidos de conveniencia: `[Marcar todos]` y `[Desmarcar todos]`.
   - **Chips de Países:** Chip con checkbox, código del país en negrita (`COL`, `CHL`, etc.) y nombre completo en subtítulo tooltip.
   - **Chips de Mercados:** Chip con borde violeta/indigo distintivo y texto en mayúsculas (`CASACA`, `LATAM`).
2. **Actualización Reactiva en Tiempo Real:**
   - La tabla se reajusta inmediatamente al marcar o desmarcar chips.
   - Si no hay ningún país seleccionado, se muestra un mensaje amigable invitando a marcar al menos una columna.
3. **Persistencia dentro de la Sesión del Modal:**
   - Por defecto, al abrir el modal se muestran todos los países disponibles seleccionados para conveniencia.

---

## 3. Plan de Tareas de Implementación

1. **Estado Reactivo en `ReportTableModalComponent`:**
   - Crear un signal `selectedCountryIds = signal<Set<string>>(new Set())` para registrar qué países/mercados están activos.
   - Inicializar el conjunto con todos los países y mercados disponibles al recibir los datos.
   - Métodos: `toggleColumn(id: string)`, `selectAll()`, `deselectAll()`.
2. **Filtrado Reactivo de Columnas (`activeColumns`):**
   - Actualizar el computed `activeColumns` para filtrar según `selectedCountryIds()`.
3. **Template HTML y Estilos SCSS de los Chips:**
   - Diseñar chips modernos con checkbox interactivo, estados hover, active y focus accesibles.
   - Estilo diferenciado para mercados regionales (borde acentuado).
4. **Verificación y Pruebas:**
   - Probar selección múltiple, copiado de imagen PNG, copiado de datos TSV a Excel y descarga con subconjuntos de países.
   - Ejecutar `compile_applet` para garantizar cero errores de TypeScript y AOT.

# Plan de Implementación: Agregar Nuevos Canales a Países Existentes

## Objetivo
Permitir que el usuario agregue uno o más canales adicionales (por ejemplo, **Display**, **Netflix**, **OOH**, etc.) a cualquier país que ya se encuentre cargado en la tabla de resultados, de forma rápida, intuitiva y sin perder ni alterar ninguna funcionalidad existente.

---

## 1. Selector Rápido "+ Canal" en Modo Edición de la Tabla (`ResultsTableComponent`)
Actualmente, la tabla solo muestra columnas para los canales que ya tienen datos en al menos un país (`uniquePlatforms`). Cuando un usuario edita una fila (ej. **Perú**) y necesita añadir un canal que aún no figura como columna en la tabla:

- **Botón "+ Canal" en Edición**:
  - Al activar el modo edición en una fila (`editingId`), se mostrará un botón interactivo **"+ Canal"** tanto en la barra/cabecera de plataformas de la tabla como en la propia fila en edición.
- **Popover / Selector Rápido de Canal**:
  - Al hacer clic en **"+ Canal"**, se desplegará un selector ligero con los canales disponibles en el catálogo (`AVAILABLE_PLATFORMS` con sus íconos oficiales) que aún no tengan valor en ese país, más la opción de escribir un canal personalizado.
  - Al elegir el canal (ej. **Display**), se añadirá inmediatamente la columna correspondiente a la tabla (si no existía ya) y se enfocará el campo numérico de Reach de ese canal en la fila editada para que el usuario ingrese el alcance directamente.
  - Se podrán agregar tantos canales adicionales como se requiera en la misma sesión de edición o en ediciones posteriores.
- **Guardado y Recálculo Automático**:
  - Al confirmar los cambios con el botón de guardar (`✓`), se actualizará el listado de canales del país y el servicio (`CrossReachService`) recalculará automáticamente el **Cross Reach Neto Deduplicado**, el **% Cross Reach Final**, las métricas ejecutivas y los mercados regionales (**Latam** y **Casaca**).

---

## 2. Fusión Inteligente desde el Formulario Superior (`App` y `PlatformFormComponent`)
Si el usuario prefiere usar el panel superior **"Configuración de País"** seleccionando un país que ya existe en la tabla (ej. **Perú**):

- **Detección y Fusión sin Duplicados**:
  - Al enviar el formulario para un país que ya está registrado en la tabla, el sistema no creará una fila duplicada.
  - Fusionará los canales existentes del país con los nuevos canales ingresados en el formulario (actualizando el alcance si el canal ya existía o agregándolo si es nuevo, y manteniendo el Universo actualizado).
- **Indicador Visual en el Formulario**:
  - Cuando el usuario seleccione en el formulario un país que ya está cargado en la tabla, se mostrará un aviso sutil indicando que los canales ingresados se sumarán o actualizarán sobre el país existente.

---

## Archivos a Modificar
1. `src/app/components/results-table/results-table.component.ts`: Lógica de columnas dinámicas adicionales durante la edición (`addedPlatformsInEdit`), apertura del selector rápido de canales y emisión de la fila actualizada.
2. `src/app/components/results-table/results-table.component.html`: Inclusión del botón **"+ Canal"** y menú desplegable con íconos de medios durante el modo edición de una fila.
3. `src/app/components/results-table/results-table.component.scss`: Estilos limpios para el botón **"+ Canal"** y el selector rápido flotante manteniendo la estética de la tabla.
4. `src/app/app.ts` y `src/app/components/platform-form/platform-form.component.ts`: Lógica de fusión inteligente (`addOrMergeCountry`) cuando se agrega información para un país que ya existe en la tabla.

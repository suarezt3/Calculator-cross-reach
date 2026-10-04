# Simplificación de Iconos de Tabla, Corrección de Borrado en la Nube y Homologación de Terminología

Reemplazo de los botones de texto de la tabla de resultados por botones de icono compactos (Hugeicons), resolución técnica del borrado persistente de escenarios en la base de datos en la nube y sustitución de toda referencia a 'Supabase' por la terminología ejecutiva 'En la nube'.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> - **Botones de Acción en Filas:** Botones compactos únicamente con icono (sin texto "Editar" ni "Eliminar"), con fondo sutil (azul pastel para editar, rojo pastel para eliminar) y tooltip descriptivo con el nombre del país.
> - **Terminología de Almacenamiento:** Eliminar la palabra "Supabase" de todos los textos, cabeceras, botones, badges y modales, unificándolo bajo **"En la nube"** (*Guardado en la nube*, *Historial en la nube*, *Sincronizado en la nube*).
> - **Persistencia de Eliminación:** Solución al problema de reaparición de escenarios eliminados:
>   1. El código actual restringía el borrado con un `owner_token` aleatorio por sesión que no coincidía con escenarios creados previamente.
>   2. No se eliminaban previamente las dependencias de la tabla hija `scenario_platforms`, lo cual impedía eliminar el escenario padre.
>   3. Se incorporará un mecanismo de eliminación en cascada (`scenario_platforms` -> `scenarios`) por nombre e ID sin filtro restrictivo de token, junto con una lista local de exclusión permanente para garantizar que un escenario eliminado jamás vuelva a cargarse en el navegador.

---

## 1. Overview & Core Concept

1. **Tabla Más Limpia y Ejecutiva:** Al sustituir los botones anchos de texto por iconos vectoriales sutiles de Hugeicons (`Edit02Icon` y `Delete02Icon`), las columnas de la tabla ganan espacio horizontal, mejorando la visualización de los datos numéricos y reduciendo la fatiga visual.
2. **Eliminación Confiable en la Nube:** Al pulsar "Eliminar" en el gestor de escenarios, el sistema ejecutará la eliminación efectiva en la nube y en la memoria local, eliminando tanto los registros de plataformas asociadas como los registros de escenarios.
3. **Cero Confusión de Proveedor Técnico:** El usuario final ve una experiencia limpia orientada a negocios ("Almacenamiento en la nube"), sin tecnicismos ajenos a su flujo de trabajo.

---

## 2. User Experience & Visual Design

### Nueva Apariencia de Acciones por Fila:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ País          │ Universo    │ Meta         │ YouTube      │ ... │ Acciones                  │
├───────────────┼─────────────┼──────────────┼──────────────┼─────┼───────────────────────────┤
│ Colombia      │ 27.000.000  │ 22.000.000   │ 18.000.000   │ ... │ [ ✏️ ]  [ 🗑️ ]             │
│               │             │              │              │     │ (Azul)  (Rojo)            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Botón Editar:** Cuadrado suave de `32x32px`, fondo `bg-blue-50`, borde `border-blue-200`, icono azul `Edit02Icon`. En modo edición cambia a `Tick02Icon` (verde para guardar) y `Cancel01Icon` (gris para cancelar).
- **Botón Eliminar:** Cuadrado suave de `32x32px`, fondo `bg-rose-50`, borde `border-rose-200`, icono carmesí `Delete02Icon`.
- **Efecto Hover:** Elevación sutil con micro-sombra y saturación suave del color.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ScenarioService.deleteScenario()                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     1. Limpieza Local         │       │     2. Limpieza Remota        │
│ • Remover de state signal     │       │ • DELETE /scenario_platforms  │
│ • Guardar en localStorage     │       │   (hijos por scenario_id)     │
│ • Registrar en deletedMap     │       │ • DELETE /scenarios           │
│   (anti-reaparición)          │       │   (padre por id o name)       │
└───────────────────────────────┘       └───────────────────────────────┘
```

1. **Eliminación en Cascada:**
   - Buscar primero los `id` de todos los registros en `scenarios` que coincidan con el nombre del escenario.
   - Eliminar los registros hijos en `scenario_platforms` usando `scenario_id=in.(...)`.
   - Eliminar los registros en `scenarios` usando `id=in.(...)` o `name=eq.(...)` sin condicionar por `owner_token`.
2. **Protección Anti-Reaparición (`deletedScenariosIds`):**
   - Se mantiene un registro persistente de IDs y nombres eliminados por el usuario para que cualquier sincronización o recarga descarte automáticamente elementos que hayan sido marcados como borrados.
3. **Reemplazo Textual Global:**
   - En `SaveScenarioModalComponent`: Cambiar *"Almacena esta matriz en la nube con Supabase"* por *"Almacena esta matriz en la nube"*.
   - En `ScenarioDrawerComponent`: Cambiar *"Historial en la nube de Supabase"* y *"Recargar desde Supabase"* por *"Historial de escenarios en la nube"* y *"Recargar desde la nube"*. Badge *"☁️ En la nube"*.
   - En `AppComponent`: Actualizar tooltips y mensajes toast.

---

## 4. Plan de Tareas de Implementación

1. **Actualizar `ResultsTableComponent`:**
   - Importar `Edit02Icon`, `Delete02Icon`, `Tick02Icon`, `Cancel01Icon` de `@hugeicons/core-free-icons`.
   - Reemplazar los botones de texto `✏️ Editar` y `🗑️ Eliminar` por botones de icono compactos estilizados con clases `btn-row-action edit` y `btn-row-action delete`.
   - Reemplazar los botones de guardar y cancelar en modo edición con sus iconos correspondientes.
   - Ajustar los estilos CSS/SCSS para lograr dimensiones perfectas (`32x32px`), centrado flex y micro-interacciones hover.
2. **Actualizar `ScenarioService`:**
   - Implementar eliminación en 2 fases (primero `scenario_platforms`, luego `scenarios`) eliminando el parámetro restrictivo `owner_token`.
   - Añadir manejo de lista negra local de eliminados (`deleted_scenarios_blacklist`) para evitar que escenarios huérfanos reaparezcan al recargar.
3. **Reemplazar Toda Referencia a Supabase en la UI:**
   - Actualizar textos en `scenario-drawer.component.ts`, `save-scenario-modal.component.ts`, `app.html` y `app.ts`.
4. **Verificación y Compilación:**
   - Ejecutar `compile_applet`, verificar estado y probar la recarga en vivo.

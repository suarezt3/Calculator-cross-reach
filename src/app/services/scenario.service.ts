import { Injectable, signal, computed } from '@angular/core';
import { CountryRow, PlatformReach } from '../models/platform.models';
import { SavedScenario, SupabaseCountry, SupabaseScenarioRecord } from '../models/scenario.models';

@Injectable({
  providedIn: 'root'
})
export class ScenarioService {
  private readonly supabaseUrl = 'https://ndtqlmoqinbokpsrflii.supabase.co/rest/v1';
  private readonly supabaseKey = 'sb_publishable_BjiJA0a8TiIhzu4QkKXu1A_rDn7xPxb';
  private readonly localStorageKey = 'cross_reach_saved_scenarios_v1';
  private readonly deletedBlacklistKey = 'cross_reach_deleted_scenarios_blacklist_v1';
  private readonly ownerTokenKey = 'cross_reach_owner_token_v1';

  private ownerToken: string;
  private cachedCountries: SupabaseCountry[] = [];

  // Reactive state
  scenarios = signal<SavedScenario[]>([]);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  lastSyncStatus = signal<'synced' | 'local_only' | 'error'>('synced');

  scenariosCount = computed(() => this.scenarios().length);

  constructor() {
    this.ownerToken = this.getOrCreateOwnerToken();
    this.init();
  }

  private getOrCreateOwnerToken(): string {
    try {
      let token = localStorage.getItem(this.ownerTokenKey);
      if (!token) {
        token = crypto.randomUUID();
        localStorage.setItem(this.ownerTokenKey, token);
      }
      return token;
    } catch {
      return 'a0000000-0000-0000-0000-000000000001';
    }
  }

  private getDeletedBlacklist(): Set<string> {
    try {
      const raw = localStorage.getItem(this.deletedBlacklistKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr.map((s: string) => String(s).trim().toLowerCase()));
        }
      }
    } catch (e) {
      console.error('Error leyendo lista de exclusión de escenarios:', e);
    }
    return new Set<string>();
  }

  private addToBlacklist(name: string, id?: string): void {
    try {
      const set = this.getDeletedBlacklist();
      if (name) set.add(name.trim().toLowerCase());
      if (id) set.add(id.trim().toLowerCase());
      localStorage.setItem(this.deletedBlacklistKey, JSON.stringify(Array.from(set)));
    } catch (e) {
      console.error('Error guardando en lista de exclusión:', e);
    }
  }

  private removeFromBlacklist(name: string, id?: string): void {
    try {
      const set = this.getDeletedBlacklist();
      if (name) set.delete(name.trim().toLowerCase());
      if (id) set.delete(id.trim().toLowerCase());
      localStorage.setItem(this.deletedBlacklistKey, JSON.stringify(Array.from(set)));
    } catch (e) {
      console.error('Error eliminando de lista de exclusión:', e);
    }
  }

  private async init(): Promise<void> {
    // 1. Carga inmediata desde almacenamiento local para respuesta instantánea
    this.loadFromLocalStorage();

    // 2. Carga y sincronización con la nube en segundo plano
    await this.fetchCountriesList();
    await this.loadScenarios();
  }

  private getHeaders(): Record<string, string> {
    return {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  private async fetchCountriesList(): Promise<SupabaseCountry[]> {
    if (this.cachedCountries.length > 0) return this.cachedCountries;
    try {
      const res = await fetch(`${this.supabaseUrl}/countries?select=*`, {
        headers: this.getHeaders()
      });
      if (res.ok) {
        this.cachedCountries = await res.json();
      }
    } catch (err) {
      console.warn('No se pudo precargar lista de países desde la nube:', err);
    }
    return this.cachedCountries;
  }

  loadFromLocalStorage(): SavedScenario[] {
    try {
      const raw = localStorage.getItem(this.localStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const blacklist = this.getDeletedBlacklist();
          const clean = parsed.filter(
            item => !blacklist.has(item.name.trim().toLowerCase()) && !blacklist.has(item.id.trim().toLowerCase())
          );
          this.scenarios.set(clean);
          return clean;
        }
      }
    } catch (e) {
      console.error('Error leyendo escenarios desde almacenamiento local:', e);
    }
    return [];
  }

  private saveToLocalStorage(list: SavedScenario[]): void {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(list));
    } catch (e) {
      console.error('Error guardando escenarios en almacenamiento local:', e);
    }
  }

  /**
   * Consulta los escenarios en la nube y los combina con la caché local
   */
  async loadScenarios(): Promise<SavedScenario[]> {
    this.isLoading.set(true);
    const blacklist = this.getDeletedBlacklist();

    try {
      const res = await fetch(
        `${this.supabaseUrl}/scenarios?select=*,countries(*),scenario_platforms(*)&order=created_at.desc`,
        {
          headers: this.getHeaders()
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      const records: SupabaseScenarioRecord[] = await res.json();

      // Agrupar registros por nombre
      const groupedMap = new Map<string, SupabaseScenarioRecord[]>();
      records.forEach(r => {
        const key = r.name.trim();
        // Omitir si fue eliminado por el usuario
        if (blacklist.has(key.toLowerCase()) || (r.id && blacklist.has(r.id.toLowerCase()))) {
          return;
        }
        if (!groupedMap.has(key)) {
          groupedMap.set(key, []);
        }
        groupedMap.get(key)!.push(r);
      });

      const cloudScenarios: SavedScenario[] = [];

      groupedMap.forEach((countryRecords, name) => {
        const sortedByDate = [...countryRecords].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const latestRecord = sortedByDate[0];

        let totalUniv = 0;
        let totalCross = 0;
        const countriesList: string[] = [];

        const rows: CountryRow[] = countryRecords.map(rec => {
          const cName = rec.countries?.name || 'País';
          countriesList.push(cName);
          totalUniv += Number(rec.universe || 0);
          totalCross += Number(rec.total_cross_reach || 0);

          const platforms: PlatformReach[] = (rec.scenario_platforms || []).map(p => ({
            platformName: p.platform_name,
            reach: Number(p.reach)
          }));

          return {
            id: rec.id || crypto.randomUUID(),
            country: cName,
            universe: Number(rec.universe || 0),
            platforms: platforms,
            crossReach: Number(rec.total_cross_reach || 0),
            crossReachPercentage: Number(rec.total_cross_reach_percentage || 0)
          };
        });

        const uniquePlats = new Set<string>();
        rows.forEach(r => r.platforms.forEach(p => uniquePlats.add(p.platformName)));

        const eff = totalUniv > 0 ? (totalCross / totalUniv) * 100 : 0;

        cloudScenarios.push({
          id: latestRecord.id || crypto.randomUUID(),
          name: name,
          createdAt: latestRecord.created_at,
          countriesCount: rows.length,
          platformsCount: uniquePlats.size,
          totalUniverse: totalUniv,
          totalCrossReach: totalCross,
          totalEfficiency: parseFloat(eff.toFixed(2)),
          countriesList: Array.from(new Set(countriesList)),
          rows: rows,
          source: 'cloud'
        });
      });

      // Combinar con escenarios locales limpios
      const localScenarios = this.loadFromLocalStorage();
      const combined = [...cloudScenarios];

      localScenarios.forEach(localItem => {
        const existsInCloud = combined.some(
          s => s.name.toLowerCase().trim() === localItem.name.toLowerCase().trim()
        );
        if (!existsInCloud) {
          combined.push({ ...localItem, source: 'local' });
        }
      });

      // Ordenar por fecha descendente
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      this.scenarios.set(combined);
      this.saveToLocalStorage(combined);
      this.lastSyncStatus.set('synced');
      return combined;
    } catch (err) {
      console.warn('Fallback a almacenamiento local tras error en la nube:', err);
      this.lastSyncStatus.set('local_only');
      const fallback = this.loadFromLocalStorage();
      return fallback;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Guarda un escenario en la nube y en la caché local
   */
  async saveScenario(name: string, rawRows: CountryRow[]): Promise<SavedScenario> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('El nombre del escenario es obligatorio.');
    }

    const validCountryRows = (rawRows || []).filter(r => !r.isMarket);
    if (validCountryRows.length === 0) {
      throw new Error('Debes tener al menos un país con datos para guardar el escenario.');
    }

    this.isSaving.set(true);

    try {
      const scenarioId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      // Si el escenario había sido eliminado previamente, remover de la lista de exclusión
      this.removeFromBlacklist(trimmedName, scenarioId);

      let totalUniv = 0;
      let totalCross = 0;
      const countriesList: string[] = [];
      const uniquePlats = new Set<string>();

      validCountryRows.forEach(r => {
        countriesList.push(r.country);
        totalUniv += Number(r.universe || 0);
        totalCross += Number(r.crossReach || 0);
        r.platforms.forEach(p => {
          if (p.reach && p.reach > 0) uniquePlats.add(p.platformName);
        });
      });

      const eff = totalUniv > 0 ? (totalCross / totalUniv) * 100 : 0;

      const newScenario: SavedScenario = {
        id: scenarioId,
        name: trimmedName,
        createdAt: createdAt,
        countriesCount: validCountryRows.length,
        platformsCount: uniquePlats.size,
        totalUniverse: totalUniv,
        totalCrossReach: totalCross,
        totalEfficiency: parseFloat(eff.toFixed(2)),
        countriesList: Array.from(new Set(countriesList)),
        rows: validCountryRows,
        source: 'synced'
      };

      // 1. Guardar en local inmediatamente para respuesta instantánea
      const currentList = this.scenarios();
      const updatedList = [
        newScenario,
        ...currentList.filter(s => s.name.toLowerCase().trim() !== trimmedName.toLowerCase())
      ];
      this.scenarios.set(updatedList);
      this.saveToLocalStorage(updatedList);

      // 2. Persistir en la base de datos en la nube
      await this.persistToCloud(trimmedName, validCountryRows);

      this.lastSyncStatus.set('synced');
      return newScenario;
    } catch (err) {
      console.warn('Guardado completado en local, aviso de sincronización en la nube:', err);
      this.lastSyncStatus.set('local_only');
      return this.scenarios()[0];
    } finally {
      this.isSaving.set(false);
    }
  }

  private async persistToCloud(scenarioName: string, rows: CountryRow[]): Promise<void> {
    const countries = await this.fetchCountriesList();

    for (const row of rows) {
      const match = countries.find(
        c => c.name.toLowerCase().trim() === row.country.toLowerCase().trim()
      );
      const countryId = match ? match.id : (countries[0]?.id || '0c4cfdcb-a744-4859-9eee-c93552cad2df');

      const scenarioPayload = {
        name: scenarioName,
        country_id: countryId,
        universe: Math.round(row.universe || 0),
        total_cross_reach: Math.round(row.crossReach || 0),
        total_cross_reach_percentage: parseFloat((row.crossReachPercentage || 0).toFixed(2)),
        owner_token: this.ownerToken
      };

      const resScenario = await fetch(`${this.supabaseUrl}/scenarios`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(scenarioPayload)
      });

      if (resScenario.ok) {
        const createdRecords = await resScenario.json();
        const createdScenario = createdRecords[0];

        if (createdScenario?.id) {
          for (const p of row.platforms) {
            if (p.reach && p.reach > 0) {
              await fetch(`${this.supabaseUrl}/scenario_platforms`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                  scenario_id: createdScenario.id,
                  platform_name: p.platformName,
                  reach: Math.round(p.reach)
                })
              }).catch(e => console.warn('Aviso guardando plataforma en la nube:', e));
            }
          }
        }
      }
    }
  }

  /**
   * Elimina un escenario tanto de forma local como en la base de datos en la nube
   */
  async deleteScenario(scenarioId: string, name: string): Promise<void> {
    const trimmedName = name.trim();

    // 1. Agregar inmediatamente a la lista de exclusión permanente local
    this.addToBlacklist(trimmedName, scenarioId);

    // 2. Eliminar de la señal reactiva y de la memoria local
    const filtered = this.scenarios().filter(
      s => s.id !== scenarioId && s.name.toLowerCase().trim() !== trimmedName.toLowerCase()
    );
    this.scenarios.set(filtered);
    this.saveToLocalStorage(filtered);

    // 3. Ejecutar borrado en cascada en la base de datos en la nube
    try {
      // Paso A: Obtener todos los IDs de registros con este nombre en 'scenarios'
      const queryRes = await fetch(
        `${this.supabaseUrl}/scenarios?name=eq.${encodeURIComponent(trimmedName)}&select=id`,
        { headers: this.getHeaders() }
      );

      let recordIds: string[] = [];
      if (queryRes.ok) {
        const records = await queryRes.json();
        if (Array.isArray(records)) {
          recordIds = records.map((r: { id: string }) => r.id).filter(Boolean);
        }
      }
      if (scenarioId && !recordIds.includes(scenarioId)) {
        recordIds.push(scenarioId);
      }

      // Paso B: Eliminar registros dependientes en 'scenario_platforms'
      for (const id of recordIds) {
        await fetch(`${this.supabaseUrl}/scenario_platforms?scenario_id=eq.${id}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        }).catch(e => console.warn('Aviso borrado plataformas hijas:', e));
      }

      // Paso C: Eliminar registros padres en 'scenarios' por ID individual
      for (const id of recordIds) {
        await fetch(`${this.supabaseUrl}/scenarios?id=eq.${id}`, {
          method: 'DELETE',
          headers: this.getHeaders()
        }).catch(e => console.warn('Aviso borrado escenario por ID:', e));
      }

      // Paso D: Eliminar registros en 'scenarios' por nombre directo (sin restricción de token)
      await fetch(
        `${this.supabaseUrl}/scenarios?name=eq.${encodeURIComponent(trimmedName)}`,
        {
          method: 'DELETE',
          headers: this.getHeaders()
        }
      ).catch(e => console.warn('Aviso borrado escenario por nombre:', e));

    } catch (err) {
      console.warn('Aviso al ejecutar borrado en la nube:', err);
    }
  }
}

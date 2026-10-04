import { CountryRow } from './platform.models';

export interface SavedScenario {
  id: string;
  name: string;
  createdAt: string; // ISO date string
  countriesCount: number;
  platformsCount: number;
  totalUniverse: number;
  totalCrossReach: number;
  totalEfficiency: number;
  countriesList: string[]; // ['COL', 'MEX', 'PER', etc.]
  rows: CountryRow[];
  source?: 'cloud' | 'local' | 'synced' | 'supabase';
}

export interface SupabaseCountry {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface SupabaseScenarioRecord {
  id: string;
  name: string;
  country_id: string;
  universe: number;
  total_cross_reach: number;
  total_cross_reach_percentage: number;
  owner_token: string;
  created_at: string;
  countries?: SupabaseCountry;
  scenario_platforms?: {
    id: string;
    scenario_id: string;
    platform_name: string;
    reach: number;
    reach_percentage?: number | null;
  }[];
}

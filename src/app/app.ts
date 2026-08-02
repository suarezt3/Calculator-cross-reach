import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformFormComponent } from './components/platform-form/platform-form.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { CrossReachService } from './services/cross-reach.service';
import { CountryRow, PlatformReach } from './models/platform.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    PlatformFormComponent,
    ResultsTableComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  title = 'Cross Reach Calculator';
  tableData: CountryRow[] = [];

  constructor(private crossReachService: CrossReachService) {}

  get usedCountries(): string[] {
    return this.tableData
      .filter(row => !row.isMarket)
      .map(row => row.country);
  }

  // ESTE ES EL GETTER CLAVE
  get displayData(): CountryRow[] {
    return this.crossReachService.getAllRowsWithMarkets(this.tableData);
  }

  handleAddToTable(data: {
    country: string;
    universe: number;
    platforms: PlatformReach[];
  }): void {
    const newRow: CountryRow = {
      id: crypto.randomUUID(),
      country: data.country,
      universe: data.universe,
      platforms: data.platforms
    };

    this.tableData = this.crossReachService.addRowToTable(this.tableData, newRow);
  }

  handleEditRow(updatedRow: CountryRow): void {
    if (updatedRow.isMarket) {
      return;
    }
    this.tableData = this.crossReachService.updateRowInTable(this.tableData, updatedRow);
  }

  handleDeleteRow(id: string): void {
    this.tableData = this.crossReachService.deleteRowFromTable(this.tableData, id);
  }
}

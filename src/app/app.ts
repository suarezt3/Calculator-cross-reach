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

  /**
   * Maneja el evento de agregar a la tabla desde el formulario
   */
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

  /**
   * Maneja la edición de una fila
   */
  handleEditRow(updatedRow: CountryRow): void {
    this.tableData = this.crossReachService.updateRowInTable(this.tableData, updatedRow);
  }

  /**
   * Maneja la eliminación de una fila
   */
  handleDeleteRow(id: string): void {
    this.tableData = this.crossReachService.deleteRowFromTable(this.tableData, id);
  }
}

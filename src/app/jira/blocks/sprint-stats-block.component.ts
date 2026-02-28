import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { SprintStatRow } from '../jira.types';

@Component({
  selector: 'app-sprint-stats-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    <app-collapsible-block [blockCard]="false">
      <h2 header>Статистика по спринтам</h2>
      <table>
        <thead>
          <tr>
            <th>Спринт</th>
            <th>SP запланировано</th>
            <th>SP закрыто</th>
            <th>SP добавлено в середине</th>
            <th>Carry-over %</th>
            <th>% объёма добавлено</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let s of stats()"
            [class.selected-row]="selectedSprint() && s.sprintName === selectedSprint()"
          >
            <td>{{ s.sprintName }}</td>
            <td>{{ s.plannedSp }}</td>
            <td>{{ s.closedSp }}</td>
            <td>{{ s.addedMidSprintSp }}</td>
            <td>{{ s.carryOverPercent }}%</td>
            <td>{{ s.addedVolumePercent }}%</td>
          </tr>
        </tbody>
      </table>
    </app-collapsible-block>
  `,
  styles: [
    `
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 13px;
      }
      th,
      td {
        padding: 8px 10px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      th {
        font-weight: 600;
        color: #374151;
        background: #f3f4f6;
      }
      tbody tr:last-child td {
        border-bottom: none;
      }
      .selected-row {
        background: #dbeafe !important;
      }
    `
  ]
})
export class SprintStatsBlockComponent {
  readonly stats = input.required<SprintStatRow[]>();
  readonly selectedSprint = input<string | null>(null);
}

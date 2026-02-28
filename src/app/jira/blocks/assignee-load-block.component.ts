import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { AssigneeLoadStat } from '../jira.types';

@Component({
  selector: 'app-assignee-load-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (load().length) {
      <app-collapsible-block>
        <h3 header>Историческая загрузка по участникам</h3>
        <table class="assignee-table">
          <thead>
            <tr>
              <th>Участник</th>
              <th>SP закрыто всего</th>
              <th>Спринтов участвовал</th>
              <th>Средняя загрузка / спринт</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of load()">
              <td>{{ a.assignee }}</td>
              <td>{{ a.totalClosedSp }}</td>
              <td>{{ a.sprintsCount }}</td>
              <td>{{ a.avgPerSprint | number : '1.1-1' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="assignee-subblocks">
          @if (overloaded().length) {
            <div>
              <h4>Стабильно перегружены</h4>
              <ul>
                <li *ngFor="let a of overloaded()">
                  <span class="issue-key">{{ a.assignee }}</span>
                  <span class="issue-meta-small">
                    Средняя загрузка: {{ a.avgPerSprint | number : '1.1-1' }} SP/спринт
                  </span>
                </li>
              </ul>
            </div>
          }

          @if (underloaded().length) {
            <div>
              <h4>Недогружены</h4>
              <ul>
                <li *ngFor="let a of underloaded()">
                  <span class="issue-key">{{ a.assignee }}</span>
                  <span class="issue-meta-small">
                    Средняя загрузка: {{ a.avgPerSprint | number : '1.1-1' }} SP/спринт
                  </span>
                </li>
              </ul>
            </div>
          }
        </div>
      </app-collapsible-block>
    }
  `,
  styles: [
    `
      .assignee-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 12px;
      }
      .assignee-table th,
      .assignee-table td {
        padding: 6px 8px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      .assignee-table th {
        font-weight: 600;
        color: #374151;
        background: #f3f4f6;
      }
      .assignee-table tbody tr:last-child td {
        border-bottom: none;
      }
      .assignee-subblocks {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
      }
      .assignee-subblocks h4 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 600;
        color: #111827;
      }
      .assignee-subblocks ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .assignee-subblocks li {
        padding: 4px 6px;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
      }
      .issue-key {
        font-weight: 600;
        color: #1d4ed8;
      }
      .issue-meta-small {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: #6b7280;
      }
    `
  ]
})
export class AssigneeLoadBlockComponent {
  readonly load = input.required<AssigneeLoadStat[]>();
  readonly overloaded = input.required<AssigneeLoadStat[]>();
  readonly underloaded = input.required<AssigneeLoadStat[]>();
}

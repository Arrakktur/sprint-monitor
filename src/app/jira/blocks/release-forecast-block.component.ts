import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { ReleaseForecast } from '../jira.types';

@Component({
  selector: 'app-release-forecast-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (forecast(); as f) {
      <app-collapsible-block>
        <h3 header>Прогноз релиза</h3>
        <div class="velocity-grid">
          <div>
            <div class="metric-label">Осталось в бэклоге</div>
            <div class="metric-value">{{ f.remainingSp }} SP</div>
          </div>
          <div>
            <div class="metric-label">P50 (медианный прогноз)</div>
            <div class="metric-value">
              ~{{ f.p50Sprints | number : '1.1-1' }} спринтов,
              до {{ f.p50Date | date : 'dd.MM.yyyy' }}
            </div>
          </div>
          <div>
            <div class="metric-label">P80 (консервативный прогноз)</div>
            <div class="metric-value">
              ~{{ f.p80Sprints | number : '1.1-1' }} спринтов,
              до {{ f.p80Date | date : 'dd.MM.yyyy' }}
            </div>
          </div>
        </div>
      </app-collapsible-block>
    }
  `,
  styles: [
    `
      .velocity-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 12px;
        margin-top: 6px;
        font-size: 12px;
      }
      .metric-label {
        font-size: 11px;
        color: #6b7280;
      }
      .metric-value {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      }
    `
  ]
})
export class ReleaseForecastBlockComponent {
  readonly forecast = input<ReleaseForecast | null>(null);
}

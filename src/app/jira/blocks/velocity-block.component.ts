import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { VelocityStats } from '../jira.types';

@Component({
  selector: 'app-velocity-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (velocity(); as v) {
      <app-collapsible-block>
        <h3 header>Velocity / Capacity planning</h3>
        <div class="velocity-grid">
          <div>
            <div class="metric-label">Средняя velocity</div>
            <div class="metric-value">{{ v.average }}</div>
          </div>
          <div>
            <div class="metric-label">Стандартное отклонение</div>
            <div class="metric-value">{{ v.stdDev }}</div>
          </div>
          <div>
            <div class="metric-label">Тренд</div>
            <div class="metric-value">
              {{
                v.trend === 'up'
                  ? 'Растёт'
                  : v.trend === 'down'
                    ? 'Падает'
                    : 'Стабильна'
              }}
            </div>
          </div>
          <div>
            <div class="metric-label">Прогноз на следующий спринт</div>
            <div class="metric-value">{{ v.forecastNext }}</div>
          </div>
        </div>

        @if (aiForecast()) {
          <div class="ai-forecast">
            <div class="metric-label">AI-прогноз</div>
            <div class="metric-value">{{ aiForecast() }}</div>
          </div>
        }

        @if (recommendedSp() !== null) {
          <div class="ai-forecast">
            <div class="metric-label">Рекомендуемый объём следующего спринта</div>
            <div class="metric-value">{{ recommendedSp() }} SP</div>
          </div>
        }

        @if (v.history && v.history.length) {
          <div class="velocity-history">
            <div class="metric-label">История по спринтам</div>
            <ul>
              <li *ngFor="let h of v.history">
                <span class="issue-key">{{ h.sprintName }}</span>
                <span class="issue-meta-small">Velocity: {{ h.velocity }}</span>
              </li>
            </ul>
          </div>
        }
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
      .ai-forecast {
        margin-top: 8px;
      }
      .velocity-history {
        margin-top: 8px;
      }
      .velocity-history ul {
        list-style: none;
        padding: 0;
        margin: 4px 0 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .velocity-history li {
        padding: 4px 6px;
        border-radius: 6px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
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
export class VelocityBlockComponent {
  readonly velocity = input<VelocityStats | null>(null);
  readonly aiForecast = input<string | null>(null);
  readonly recommendedSp = input<number | null>(null);
}

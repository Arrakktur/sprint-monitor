import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { ExecutiveDashboard } from '../jira.types';

@Component({
  selector: 'app-executive-dashboard-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (data(); as d) {
      <app-collapsible-block>
        <h3 header>Executive Dashboard</h3>
        <div class="velocity-grid">
          <div>
            <div class="metric-label">Delivery predictability</div>
            <div class="metric-value">
              {{ d.deliveryPredictabilityPct | number : '1.0-0' }}%
            </div>
          </div>
          <div>
            <div class="metric-label">Predictability trend</div>
            <div class="metric-value">
              {{
                d.predictabilityTrend === 'up'
                  ? 'Улучшается'
                  : d.predictabilityTrend === 'down'
                    ? 'Ухудшается'
                    : 'Стабильна'
              }}
            </div>
          </div>
          <div>
            <div class="metric-label">Throughput (SP/спринт)</div>
            <div class="metric-value">
              {{ d.throughputPerSprint | number : '1.1-1' }}
            </div>
          </div>
          <div>
            <div class="metric-label">SLA соблюдение</div>
            <div class="metric-value">
              {{ d.slaCompliancePct | number : '1.0-0' }}%
            </div>
          </div>
          <div>
            <div class="metric-label">Burn rate команды (SP/чел/спринт)</div>
            <div class="metric-value">
              {{ d.burnRatePerPerson | number : '1.1-1' }}
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
export class ExecutiveDashboardBlockComponent {
  readonly data = input<ExecutiveDashboard | null>(null);
}

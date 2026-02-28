import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { AgingMetrics } from '../jira.types';

@Component({
  selector: 'app-aging-report-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (metrics(); as m) {
      <app-collapsible-block>
        <h3 header>Aging Report</h3>
        <div class="velocity-grid">
          <div>
            <div class="metric-label">Среднее время в работе</div>
            <div class="metric-value">
              {{ m.avgInProgressHours | number : '1.0-1' }} ч
            </div>
          </div>
          <div>
            <div class="metric-label">Среднее время в review</div>
            <div class="metric-value">
              {{ m.avgInReviewHours | number : '1.0-1' }} ч
            </div>
          </div>
          <div>
            <div class="metric-label">Средний cycle time</div>
            <div class="metric-value">
              {{ m.avgCycleTimeHours | number : '1.0-1' }} ч
            </div>
          </div>
          <div>
            <div class="metric-label">Flow efficiency (активная работа)</div>
            <div class="metric-value">
              {{ (m.avgFlowEfficiency * 100) | number : '1.0-0' }}%
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
export class AgingReportBlockComponent {
  readonly metrics = input<AgingMetrics | null>(null);
}

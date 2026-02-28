import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { ProcessAntipattern } from '../jira.types';

@Component({
  selector: 'app-antipatterns-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (items().length) {
      <app-collapsible-block>
        <h3 header>Антипаттерны в процессах</h3>
        <ul class="risk-list">
          <li *ngFor="let p of items()">
            <span class="issue-summary">{{ p.title }}</span>
            <span class="issue-meta-small">{{ p.description }}</span>
          </li>
        </ul>
      </app-collapsible-block>
    }
  `,
  styles: [
    `
      .risk-list {
        list-style: none;
        padding: 0;
        margin: 8px 0 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .risk-list li {
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #fef2f2;
        font-size: 12px;
      }
      .issue-summary {
        font-weight: 500;
        color: #111827;
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
export class AntipatternsBlockComponent {
  readonly items = input.required<ProcessAntipattern[]>();
}

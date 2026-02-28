import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { RiskIssue } from '../jira.types';

@Component({
  selector: 'app-risk-detection-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (issues().length) {
      <app-collapsible-block>
        <h3 header>Риск-детекция</h3>
        <ul class="risk-list">
          <li *ngFor="let r of issues()">
            <span class="issue-key">{{ r.issue.key }}</span>
            <span class="issue-summary">{{ r.issue.fields.summary }}</span>
            <span class="issue-meta-small">{{ r.reason }}</span>
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
      .issue-key {
        font-weight: 600;
        color: #1d4ed8;
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
export class RiskDetectionBlockComponent {
  readonly issues = input.required<RiskIssue[]>();
}

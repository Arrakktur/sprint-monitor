import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { JiraIssue } from '../jira.service';

@Component({
  selector: 'app-added-after-start-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (issues().length) {
      <app-collapsible-block [blockCard]="false">
        <h3 header>Задачи, добавленные после старта спринта</h3>
        <ul>
          <li *ngFor="let issue of issues()">
            <span class="issue-key">{{ issue.key }}</span>
            <span class="issue-summary">{{ issue.fields.summary }}</span>
            <span class="issue-meta-small">
              SP: {{ issue.fields.storyPoints ?? 0 }},
              Спринт: {{ issue.fields.sprintName ?? 'Без спринта' }}
            </span>
          </li>
        </ul>
      </app-collapsible-block>
    }
  `,
  styles: [
    `
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      li {
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
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
export class AddedAfterStartBlockComponent {
  readonly issues = input.required<JiraIssue[]>();
}

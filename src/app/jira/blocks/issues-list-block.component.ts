import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { JiraIssue } from '../jira.service';

@Component({
  selector: 'app-issues-list-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (issues().length) {
      <app-collapsible-block [blockCard]="false">
        <h2 header>
          Найдено задач{{ selectedSprint() ? ' по спринту «' + selectedSprint() + '»' : '' }}:
          {{ issues().length }}
        </h2>
        <ul class="issues-list">
          <li *ngFor="let issue of issues()">
            <div class="issue-key">{{ issue.key }}</div>
            <div class="issue-summary">{{ issue.fields.summary }}</div>
            <div class="issue-meta">
              @if (issue.fields.status) {
                <span>Статус: {{ issue.fields.status.name }}</span>
              }
              @if (issue.fields.assignee) {
                <span>· Исполнитель: {{ issue.fields.assignee.displayName }}</span>
              }
            </div>
          </li>
        </ul>
      </app-collapsible-block>
    }
  `,
  styles: [
    `
      .issues-list {
        list-style: none;
        padding: 0;
        margin: 16px 0 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .issues-list li {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        display: grid;
        grid-template-columns: minmax(120px, 160px) 1fr;
        grid-template-rows: auto auto;
        column-gap: 12px;
        row-gap: 4px;
        font-size: 13px;
      }
      .issue-key {
        grid-row: 1 / 3;
        align-self: center;
        font-weight: 600;
        color: #1d4ed8;
      }
      .issue-summary {
        font-weight: 500;
        color: #111827;
      }
      .issue-meta {
        font-size: 12px;
        color: #6b7280;
      }
      .issue-meta span + span::before {
        content: '';
        display: inline-block;
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: #d1d5db;
        margin: 0 6px;
        vertical-align: middle;
      }
    `
  ]
})
export class IssuesListBlockComponent {
  readonly issues = input.required<JiraIssue[]>();
  readonly selectedSprint = input<string | null>(null);
}

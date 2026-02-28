import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { IssueAnalysis } from '../jira.types';

@Component({
  selector: 'app-ai-analysis-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (analyzed().length) {
      <app-collapsible-block>
        <h3 header>AI-анализ описаний задач</h3>

        <div>
          <h4>Авто-классификация (баг / фича / техдолг)</h4>
          <ul class="risk-list">
            <li *ngFor="let a of analyzed()">
              <span class="issue-key">{{ a.issue.key }}</span>
              <span class="issue-summary">{{ a.issue.fields.summary }}</span>
              <span class="issue-meta-small">Тип: {{ a.kind }}</span>
            </li>
          </ul>
        </div>

        @if (largeIssues().length) {
          <div style="margin-top: 8px">
            <h4>Слишком большие задачи</h4>
            <ul class="risk-list">
              <li *ngFor="let a of largeIssues()">
                <span class="issue-key">{{ a.issue.key }}</span>
                <span class="issue-summary">{{ a.issue.fields.summary }}</span>
                <span class="issue-meta-small">
                  {{ a.suggestions[0] || 'Рекомендуется разбить на более мелкие задачи.' }}
                </span>
              </li>
            </ul>
          </div>
        }

        @if (poorlyDescribed().length) {
          <div style="margin-top: 8px">
            <h4>Плохо описанные задачи</h4>
            <ul class="risk-list">
              <li *ngFor="let a of poorlyDescribed()">
                <span class="issue-key">{{ a.issue.key }}</span>
                <span class="issue-summary">{{ a.issue.fields.summary }}</span>
                <span class="issue-meta-small">
                  {{ a.suggestions[1] || 'Нужно дополнить описание: цель, критерии готовности.' }}
                </span>
              </li>
            </ul>
          </div>
        }
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
      h4 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 600;
        color: #111827;
      }
    `
  ]
})
export class AiAnalysisBlockComponent {
  readonly analyzed = input.required<IssueAnalysis[]>();
  readonly largeIssues = input.required<IssueAnalysis[]>();
  readonly poorlyDescribed = input.required<IssueAnalysis[]>();
}

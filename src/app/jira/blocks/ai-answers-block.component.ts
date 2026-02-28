import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { JiraIssue } from '../jira.service';

@Component({
  selector: 'app-ai-answers-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    <app-collapsible-block>
        <h3 header>AI-ответы по спринту</h3>

        @if (whyFailed()) {
          <div>
            <h4>Почему этот спринт провалился?</h4>
            <p class="issue-meta-small">{{ whyFailed() }}</p>
          </div>
        }

        @if (risks().length) {
          <div style="margin-top: 8px">
            <h4>Какие риски в следующем спринте?</h4>
            <ul class="risk-list">
              <li *ngFor="let r of risks()">
                <span class="issue-summary">{{ r }}</span>
              </li>
            </ul>
          </div>
        }

        @if (overloaded().length) {
          <div style="margin-top: 8px">
            <h4>Кто перегружен?</h4>
            <ul class="risk-list">
              <li *ngFor="let p of overloaded()">
                <span class="issue-summary">{{ p }}</span>
              </li>
            </ul>
          </div>
        }

        @if (likelyMissed().length) {
          <div style="margin-top: 8px">
            <h4>Какие задачи с высокой вероятностью не успеем?</h4>
            <ul class="risk-list">
              <li *ngFor="let issue of likelyMissed()">
                <span class="issue-key">{{ issue.key }}</span>
                <span class="issue-summary">{{ issue.fields.summary }}</span>
                <span class="issue-meta-small">
                  SP: {{ issue.fields.storyPoints ?? 0 }},
                  статус: {{ issue.fields.status?.name || 'unknown' }}
                </span>
              </li>
            </ul>
          </div>
        }
      </app-collapsible-block>
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
export class AiAnswersBlockComponent {
  readonly whyFailed = input<string | null>(null);
  readonly risks = input<string[]>([]);
  readonly overloaded = input<string[]>([]);
  readonly likelyMissed = input<JiraIssue[]>([]);
}

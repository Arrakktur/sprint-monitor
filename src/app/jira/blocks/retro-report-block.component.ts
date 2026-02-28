import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollapsibleBlockComponent } from './collapsible-block.component';
import type { RetroReport } from '../jira.types';

@Component({
  selector: 'app-retro-report-block',
  standalone: true,
  imports: [CommonModule, CollapsibleBlockComponent],
  template: `
    @if (report(); as r) {
      <app-collapsible-block>
        <h3 header>Ретроспективная аналитика</h3>

        @if (r.wentWell.length) {
          <div>
            <h4>Что пошло хорошо</h4>
            <ul class="risk-list">
              <li *ngFor="let item of r.wentWell">
                <span class="issue-summary">{{ item }}</span>
              </li>
            </ul>
          </div>
        }

        @if (r.wentBadly.length) {
          <div style="margin-top: 8px">
            <h4>Где просели</h4>
            <ul class="risk-list">
              <li *ngFor="let item of r.wentBadly">
                <span class="issue-summary">{{ item }}</span>
              </li>
            </ul>
          </div>
        }

        @if (r.failingTypes.length) {
          <div style="margin-top: 8px">
            <h4>Типы задач, которые чаще фейлятся</h4>
            <ul class="risk-list">
              <li *ngFor="let t of r.failingTypes">
                <span class="issue-summary">
                  {{ t.kind }} — {{ (t.failureRate * 100) | number : '1.0-0' }}% неуспешных
                  ({{ t.total }} задач)
                </span>
              </li>
            </ul>
          </div>
        }

        @if (r.carryOverByAssignee.length) {
          <div style="margin-top: 8px">
            <h4>Кто чаще создаёт carry-over</h4>
            <ul class="risk-list">
              <li *ngFor="let a of r.carryOverByAssignee">
                <span class="issue-key">{{ a.assignee }}</span>
                <span class="issue-meta-small">
                  Carry-over: {{ a.carryOverSp }} SP, спринтов: {{ a.sprintsCount }}
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
export class RetroReportBlockComponent {
  readonly report = input<RetroReport | null>(null);
}

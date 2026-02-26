import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpHeaders } from '@angular/common/http';
import { JiraIssue } from './jira.service';
import { MockJiraService } from './mock-jira.service';

type AssigneeLoadStat = {
  assignee: string;
  totalClosedSp: number;
  sprintsCount: number;
  avgPerSprint: number;
};

type AgingMetrics = {
  avgInProgressHours: number;
  avgInReviewHours: number;
  avgCycleTimeHours: number;
  avgFlowEfficiency: number;
};

type RiskIssue = {
  issue: JiraIssue;
  reason: string;
};

type IssueAnalysis = {
  issue: JiraIssue;
  kind: 'bug' | 'feature' | 'tech_debt';
  isTooLarge: boolean;
  isPoorlyDescribed: boolean;
  suggestions: string[];
};

type RetroReport = {
  wentWell: string[];
  wentBadly: string[];
  failingTypes: {
    kind: 'bug' | 'feature' | 'tech_debt';
    failureRate: number;
    total: number;
  }[];
  carryOverByAssignee: {
    assignee: string;
    carryOverSp: number;
    sprintsCount: number;
  }[];
};

type ReleaseForecast = {
  remainingSp: number;
  p50Sprints: number;
  p80Sprints: number;
  p50Date: Date;
  p80Date: Date;
};

type ProcessAntipattern = {
  title: string;
  description: string;
};

type ExecutiveDashboard = {
  deliveryPredictabilityPct: number;
  predictabilityTrend: 'up' | 'down' | 'flat';
  throughputPerSprint: number;
  slaCompliancePct: number;
  burnRatePerPerson: number;
};

@Component({
  selector: 'app-jira-issues',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="jira-container">
      <h1>Jira задачи</h1>

      <form (ngSubmit)="loadIssues()" class="jira-form">
        <label for="jql">JQL запрос</label>
        <input
          id="jql"
          type="text"
          [ngModel]="jql()"
          (ngModelChange)="jql.set($event)"
          placeholder="project = YOURPROJECT AND statusCategory != Done ORDER BY created DESC"
        />

        <button type="submit" [disabled]="loading()">Загрузить задачи</button>
      </form>

      <div *ngIf="error()" class="error">
        {{ error() }}
      </div>

      <div *ngIf="loading()" class="loading">
        Загрузка задач из Jira...
      </div>

      <div *ngIf="!loading() && sprintStats().length" class="sprint-stats">
        <h2>Статистика по спринтам</h2>
        <table>
          <thead>
            <tr>
              <th>Спринт</th>
              <th>SP запланировано</th>
              <th>SP закрыто</th>
              <th>SP добавлено в середине</th>
              <th>Carry-over %</th>
              <th>% объёма добавлено</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of sprintStats()">
              <td>{{ s.sprintName }}</td>
              <td>{{ s.plannedSp }}</td>
              <td>{{ s.closedSp }}</td>
              <td>{{ s.addedMidSprintSp }}</td>
              <td>{{ s.carryOverPercent }}%</td>
              <td>{{ s.addedVolumePercent }}%</td>
            </tr>
          </tbody>
        </table>

        <div class="sprint-extra">
          <div *ngIf="executiveDashboard()" class="assignee-block">
            <h3>Executive Dashboard</h3>
            <div class="velocity-grid">
              <div>
                <div class="metric-label">Delivery predictability</div>
                <div class="metric-value">
                  {{ executiveDashboard()!.deliveryPredictabilityPct | number : '1.0-0' }}%
                </div>
              </div>
              <div>
                <div class="metric-label">Predictability trend</div>
                <div class="metric-value">
                  {{
                    executiveDashboard()!.predictabilityTrend === 'up'
                      ? 'Улучшается'
                      : executiveDashboard()!.predictabilityTrend === 'down'
                        ? 'Ухудшается'
                        : 'Стабильна'
                  }}
                </div>
              </div>
              <div>
                <div class="metric-label">Throughput (SP/спринт)</div>
                <div class="metric-value">
                  {{ executiveDashboard()!.throughputPerSprint | number : '1.1-1' }}
                </div>
              </div>
              <div>
                <div class="metric-label">SLA соблюдение</div>
                <div class="metric-value">
                  {{ executiveDashboard()!.slaCompliancePct | number : '1.0-0' }}%
                </div>
              </div>
              <div>
                <div class="metric-label">Burn rate команды (SP/чел/спринт)</div>
                <div class="metric-value">
                  {{ executiveDashboard()!.burnRatePerPerson | number : '1.1-1' }}
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="velocityStats()" class="velocity-block">
            <h3>Velocity / Capacity planning</h3>
            <div class="velocity-grid">
              <div>
                <div class="metric-label">Средняя velocity</div>
                <div class="metric-value">{{ velocityStats()?.average }}</div>
              </div>
              <div>
                <div class="metric-label">Стандартное отклонение</div>
                <div class="metric-value">{{ velocityStats()?.stdDev }}</div>
              </div>
              <div>
                <div class="metric-label">Тренд</div>
                <div class="metric-value">
                  {{
                    velocityStats()?.trend === 'up'
                      ? 'Растёт'
                      : velocityStats()?.trend === 'down'
                        ? 'Падает'
                        : 'Стабильна'
                  }}
                </div>
              </div>
              <div>
                <div class="metric-label">Прогноз на следующий спринт</div>
                <div class="metric-value">{{ velocityStats()?.forecastNext }}</div>
              </div>
            </div>

            <div class="ai-forecast" *ngIf="aiForecastText()">
              <div class="metric-label">AI-прогноз</div>
              <div class="metric-value">{{ aiForecastText() }}</div>
            </div>

            <div class="ai-forecast" *ngIf="recommendedNextSprintSp() !== null">
              <div class="metric-label">Рекомендуемый объём следующего спринта</div>
              <div class="metric-value">
                {{ recommendedNextSprintSp() }} SP
              </div>
            </div>

            <div class="velocity-history" *ngIf="velocityStats()?.history?.length">
              <div class="metric-label">История по спринтам</div>
              <ul>
                <li *ngFor="let v of velocityStats()!.history">
                  <span class="issue-key">{{ v.sprintName }}</span>
                  <span class="issue-meta-small">Velocity: {{ v.velocity }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div *ngIf="assigneeLoad().length" class="assignee-block">
            <h3>Историческая загрузка по участникам</h3>
            <table class="assignee-table">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>SP закрыто всего</th>
                  <th>Спринтов участвовал</th>
                  <th>Средняя загрузка / спринт</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let a of assigneeLoad()">
                  <td>{{ a.assignee }}</td>
                  <td>{{ a.totalClosedSp }}</td>
                  <td>{{ a.sprintsCount }}</td>
                  <td>{{ a.avgPerSprint | number : '1.1-1' }}</td>
                </tr>
              </tbody>
            </table>

            <div class="assignee-subblocks">
              <div *ngIf="overloadedAssignees().length">
                <h4>Стабильно перегружены</h4>
                <ul>
                  <li *ngFor="let a of overloadedAssignees()">
                    <span class="issue-key">{{ a.assignee }}</span>
                    <span class="issue-meta-small">
                      Средняя загрузка: {{ a.avgPerSprint | number : '1.1-1' }} SP/спринт
                    </span>
                  </li>
                </ul>
              </div>

              <div *ngIf="underloadedAssignees().length">
                <h4>Недогружены</h4>
                <ul>
                  <li *ngFor="let a of underloadedAssignees()">
                    <span class="issue-key">{{ a.assignee }}</span>
                    <span class="issue-meta-small">
                      Средняя загрузка: {{ a.avgPerSprint | number : '1.1-1' }} SP/спринт
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div *ngIf="releaseForecast()" class="assignee-block">
            <h3>Прогноз релиза</h3>
            <div class="velocity-grid">
              <div>
                <div class="metric-label">Осталось в бэклоге</div>
                <div class="metric-value">
                  {{ releaseForecast()!.remainingSp }} SP
                </div>
              </div>
              <div>
                <div class="metric-label">P50 (медианный прогноз)</div>
                <div class="metric-value">
                  ~{{ releaseForecast()!.p50Sprints | number : '1.1-1' }} спринтов,
                  до {{ releaseForecast()!.p50Date | date : 'dd.MM.yyyy' }}
                </div>
              </div>
              <div>
                <div class="metric-label">P80 (консервативный прогноз)</div>
                <div class="metric-value">
                  ~{{ releaseForecast()!.p80Sprints | number : '1.1-1' }} спринтов,
                  до {{ releaseForecast()!.p80Date | date : 'dd.MM.yyyy' }}
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="addedAfterStartIssues().length">
            <h3>Задачи, добавленные после старта спринта</h3>
            <ul>
              <li *ngFor="let issue of addedAfterStartIssues()">
                <span class="issue-key">{{ issue.key }}</span>
                <span class="issue-summary">{{ issue.fields.summary }}</span>
                <span class="issue-meta-small">
                  SP: {{ issue.fields.storyPoints ?? 0 }},
                  Спринт: {{ issue.fields.sprintName ?? 'Без спринта' }}
                </span>
              </li>
            </ul>
          </div>

          <div *ngIf="agingMetrics()" class="aging-block">
            <h3>Aging Report</h3>
            <div class="velocity-grid">
              <div>
                <div class="metric-label">Среднее время в работе</div>
                <div class="metric-value">
                  {{ agingMetrics()!.avgInProgressHours | number : '1.0-1' }} ч
                </div>
              </div>
              <div>
                <div class="metric-label">Среднее время в review</div>
                <div class="metric-value">
                  {{ agingMetrics()!.avgInReviewHours | number : '1.0-1' }} ч
                </div>
              </div>
              <div>
                <div class="metric-label">Средний cycle time</div>
                <div class="metric-value">
                  {{ agingMetrics()!.avgCycleTimeHours | number : '1.0-1' }} ч
                </div>
              </div>
              <div>
                <div class="metric-label">Flow efficiency (активная работа)</div>
                <div class="metric-value">
                  {{ (agingMetrics()!.avgFlowEfficiency * 100) | number : '1.0-0' }}%
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="riskIssues().length" class="assignee-block">
            <h3>Риск-детекция</h3>
            <ul class="risk-list">
              <li *ngFor="let r of riskIssues()">
                <span class="issue-key">{{ r.issue.key }}</span>
                <span class="issue-summary">{{ r.issue.fields.summary }}</span>
                <span class="issue-meta-small">
                  {{ r.reason }}
                </span>
              </li>
            </ul>
          </div>

          <div *ngIf="retroReport()" class="assignee-block">
            <h3>Ретроспективная аналитика</h3>

            <div *ngIf="retroReport()!.wentWell.length">
              <h4>Что пошло хорошо</h4>
              <ul class="risk-list">
                <li *ngFor="let item of retroReport()!.wentWell">
                  <span class="issue-summary">{{ item }}</span>
                </li>
              </ul>
            </div>

            <div *ngIf="retroReport()!.wentBadly.length" style="margin-top: 8px">
              <h4>Где просели</h4>
              <ul class="risk-list">
                <li *ngFor="let item of retroReport()!.wentBadly">
                  <span class="issue-summary">{{ item }}</span>
                </li>
              </ul>
            </div>

            <div *ngIf="retroReport()!.failingTypes.length" style="margin-top: 8px">
              <h4>Типы задач, которые чаще фейлятся</h4>
              <ul class="risk-list">
                <li *ngFor="let t of retroReport()!.failingTypes">
                  <span class="issue-summary">
                    {{ t.kind }} — {{ (t.failureRate * 100) | number : '1.0-0' }}% неуспешных
                    ({{ t.total }} задач)
                  </span>
                </li>
              </ul>
            </div>

            <div *ngIf="retroReport()!.carryOverByAssignee.length" style="margin-top: 8px">
              <h4>Кто чаще создаёт carry-over</h4>
              <ul class="risk-list">
                <li *ngFor="let a of retroReport()!.carryOverByAssignee">
                  <span class="issue-key">{{ a.assignee }}</span>
                  <span class="issue-meta-small">
                    Carry-over: {{ a.carryOverSp }} SP, спринтов: {{ a.sprintsCount }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div *ngIf="processAntipatterns().length" class="assignee-block">
            <h3>Антипаттерны в процессах</h3>
            <ul class="risk-list">
              <li *ngFor="let p of processAntipatterns()">
                <span class="issue-summary">{{ p.title }}</span>
                <span class="issue-meta-small">
                  {{ p.description }}
                </span>
              </li>
            </ul>
          </div>

          <div *ngIf="analyzedIssues.length" class="assignee-block">
            <h3>AI-анализ описаний задач</h3>

            <div>
              <h4>Авто-классификация (баг / фича / техдолг)</h4>
              <ul class="risk-list">
                <li *ngFor="let a of analyzedIssues">
                  <span class="issue-key">{{ a.issue.key }}</span>
                  <span class="issue-summary">{{ a.issue.fields.summary }}</span>
                  <span class="issue-meta-small">Тип: {{ a.kind }}</span>
                </li>
              </ul>
            </div>

            <div *ngIf="largeIssues.length" style="margin-top: 8px">
              <h4>Слишком большие задачи</h4>
              <ul class="risk-list">
                <li *ngFor="let a of largeIssues">
                  <span class="issue-key">{{ a.issue.key }}</span>
                  <span class="issue-summary">{{ a.issue.fields.summary }}</span>
                  <span class="issue-meta-small">
                    {{ a.suggestions[0] || 'Рекомендуется разбить на более мелкие задачи.' }}
                  </span>
                </li>
              </ul>
            </div>

            <div *ngIf="poorlyDescribedIssues.length" style="margin-top: 8px">
              <h4>Плохо описанные задачи</h4>
              <ul class="risk-list">
                <li *ngFor="let a of poorlyDescribedIssues">
                  <span class="issue-key">{{ a.issue.key }}</span>
                  <span class="issue-summary">{{ a.issue.fields.summary }}</span>
                  <span class="issue-meta-small">
                    {{ a.suggestions[1] || 'Нужно дополнить описание: цель, критерии готовности.' }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div
            *ngIf="
              aiWhySprintFailed() ||
              aiNextSprintRisks().length ||
              aiOverloadedPeople().length ||
              aiLikelyMissedIssues().length
            "
            class="assignee-block"
          >
            <h3>AI-ответы по спринту</h3>

            <div *ngIf="aiWhySprintFailed()">
              <h4>Почему этот спринт провалился?</h4>
              <p class="issue-meta-small">
                {{ aiWhySprintFailed() }}
              </p>
            </div>

            <div *ngIf="aiNextSprintRisks().length" style="margin-top: 8px">
              <h4>Какие риски в следующем спринте?</h4>
              <ul class="risk-list">
                <li *ngFor="let r of aiNextSprintRisks()">
                  <span class="issue-summary">{{ r }}</span>
                </li>
              </ul>
            </div>

            <div *ngIf="aiOverloadedPeople().length" style="margin-top: 8px">
              <h4>Кто перегружен?</h4>
              <ul class="risk-list">
                <li *ngFor="let p of aiOverloadedPeople()">
                  <span class="issue-summary">{{ p }}</span>
                </li>
              </ul>
            </div>

            <div *ngIf="aiLikelyMissedIssues().length" style="margin-top: 8px">
              <h4>Какие задачи с высокой вероятностью не успеем?</h4>
              <ul class="risk-list">
                <li *ngFor="let issue of aiLikelyMissedIssues()">
                  <span class="issue-key">{{ issue.key }}</span>
                  <span class="issue-summary">{{ issue.fields.summary }}</span>
                  <span class="issue-meta-small">
                    SP: {{ issue.fields.storyPoints ?? 0 }},
                    статус: {{ issue.fields.status?.name || 'unknown' }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div *ngIf="blockedLongIssues().length">
            <h3>Задачи в статусе Blocked &gt; {{ blockedThresholdDays }} дней</h3>
            <ul>
              <li *ngFor="let issue of blockedLongIssues()">
                <span class="issue-key">{{ issue.key }}</span>
                <span class="issue-summary">{{ issue.fields.summary }}</span>
                <span class="issue-meta-small">
                  Заблокирована с: {{ issue.fields.blockedSince }},
                  дней: {{ daysBlocked(issue) }}
                </span>
              </li>
            </ul>
          </div>

          <div *ngIf="frequentlyReopenedIssues().length">
            <h3>Часто переоткрываемые задачи</h3>
            <ul>
              <li *ngFor="let issue of frequentlyReopenedIssues()">
                <span class="issue-key">{{ issue.key }}</span>
                <span class="issue-summary">{{ issue.fields.summary }}</span>
                <span class="issue-meta-small">
                  Переоткрытий: {{ issue.fields.reopenCount ?? 0 }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div *ngIf="!loading() && issues().length">
        <h2>Найдено задач: {{ issues().length }}</h2>
        <ul class="issues-list">
          <li *ngFor="let issue of issues()">
            <div class="issue-key">{{ issue.key }}</div>
            <div class="issue-summary">{{ issue.fields.summary }}</div>
            <div class="issue-meta">
              <span *ngIf="issue.fields.status">Статус: {{ issue.fields.status?.name }}</span>
              <span *ngIf="issue.fields.assignee">
                · Исполнитель: {{ issue.fields.assignee.displayName }}
              </span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [
    `
      .jira-container {
        max-width: 960px;
        margin: 32px auto;
        padding: 24px;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 24px;
        font-weight: 600;
        color: #0f172a;
      }

      .jira-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }

      label {
        font-size: 14px;
        font-weight: 500;
        color: #475569;
      }

      input[type='text'] {
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid #cbd5f5;
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      input[type='text']:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.4);
      }

      button {
        align-self: flex-start;
        margin-top: 4px;
        padding: 8px 16px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.1s ease;
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
      }

      button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(37, 99, 235, 0.5);
      }

      button:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
      }

      button:disabled {
        opacity: 0.6;
        cursor: default;
        box-shadow: none;
      }

      .error {
        margin-top: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        background: #fee2e2;
        color: #b91c1c;
        font-size: 13px;
      }

      .loading {
        margin-top: 8px;
        font-size: 14px;
        color: #4b5563;
      }

      .sprint-stats {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
      }

      .sprint-stats table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 13px;
      }

      .sprint-stats th,
      .sprint-stats td {
        padding: 8px 10px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }

      .sprint-stats th {
        font-weight: 600;
        color: #374151;
        background: #f3f4f6;
      }

      .sprint-stats tbody tr:last-child td {
        border-bottom: none;
      }

      .sprint-extra {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
      }

      .velocity-block {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
      }

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

      .ai-forecast {
        margin-top: 8px;
      }

      .assignee-block {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      .assignee-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 12px;
      }

      .assignee-table th,
      .assignee-table td {
        padding: 6px 8px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }

      .assignee-table th {
        font-weight: 600;
        color: #374151;
        background: #f3f4f6;
      }

      .assignee-table tbody tr:last-child td {
        border-bottom: none;
      }

      .assignee-subblocks {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
      }

      .assignee-subblocks h4 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 600;
        color: #111827;
      }

      .assignee-subblocks ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .assignee-subblocks li {
        padding: 4px 6px;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
      }

      .aging-block {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
      }

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

      .sprint-extra h3 {
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      }

      .sprint-extra ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .sprint-extra li {
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        font-size: 12px;
      }

      .issue-meta-small {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: #6b7280;
      }

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
export class JiraIssuesComponent {
  private readonly jiraService = inject(MockJiraService);

  readonly jql = signal<string>('project = YOURPROJECT ORDER BY created DESC');
  readonly issues = signal<JiraIssue[]>([]);
  readonly sprintStats = signal<
    {
      sprintName: string;
      plannedSp: number;
      closedSp: number;
      addedMidSprintSp: number;
      carryOverPercent: number;
      addedVolumePercent: number;
    }[]
  >([]);
  readonly velocityStats = signal<{
    average: number;
    stdDev: number;
    trend: 'up' | 'down' | 'flat';
    forecastNext: number;
    history: { sprintName: string; velocity: number }[];
  } | null>(null);
  readonly aiForecastText = signal<string | null>(null);
  readonly recommendedNextSprintSp = signal<number | null>(null);
  readonly assigneeLoad = signal<AssigneeLoadStat[]>([]);
  readonly overloadedAssignees = signal<AssigneeLoadStat[]>([]);
  readonly underloadedAssignees = signal<AssigneeLoadStat[]>([]);
  readonly agingMetrics = signal<AgingMetrics | null>(null);
  readonly riskIssues = signal<RiskIssue[]>([]);
  readonly issueAnalysis = signal<IssueAnalysis[]>([]);
  readonly retroReport = signal<RetroReport | null>(null);
  readonly releaseForecast = signal<ReleaseForecast | null>(null);
  readonly processAntipatterns = signal<ProcessAntipattern[]>([]);
  readonly executiveDashboard = signal<ExecutiveDashboard | null>(null);
  readonly aiWhySprintFailed = signal<string | null>(null);
  readonly aiNextSprintRisks = signal<string[]>([]);
  readonly aiOverloadedPeople = signal<string[]>([]);
  readonly aiLikelyMissedIssues = signal<JiraIssue[]>([]);

  get analyzedIssues(): IssueAnalysis[] {
    return this.issueAnalysis();
  }

  get largeIssues(): IssueAnalysis[] {
    return this.issueAnalysis().filter((a) => a.isTooLarge);
  }

  get poorlyDescribedIssues(): IssueAnalysis[] {
    return this.issueAnalysis().filter((a) => a.isPoorlyDescribed);
  }
  readonly addedAfterStartIssues = signal<JiraIssue[]>([]);
  readonly blockedLongIssues = signal<JiraIssue[]>([]);
  readonly frequentlyReopenedIssues = signal<JiraIssue[]>([]);
  readonly blockedThresholdDays = 3;
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  loadIssues(): void {
    this.loading.set(true);
    this.error.set(null);
    this.issues.set([]);

    // Тестовый режим: используем MockJiraService и игнорируем JQL/headers
    const headers = new HttpHeaders();

    this.jiraService.getIssues().subscribe({
      next: (response) => {
        const issues = response.issues ?? [];
        this.issues.set(issues);
        const stats = this.calculateSprintStats(issues);
        this.sprintStats.set(stats);
        const velocity = this.calculateVelocityMetrics(stats);
        this.velocityStats.set(velocity);
        const assigneeLoad = this.calculateAssigneeLoad(issues);
        this.assigneeLoad.set(assigneeLoad);
        const { overloaded, underloaded } = this.classifyAssigneeLoad(assigneeLoad);
        this.overloadedAssignees.set(overloaded);
        this.underloadedAssignees.set(underloaded);
        this.aiForecastText.set(this.buildAiForecastText(velocity, assigneeLoad));
        this.recommendedNextSprintSp.set(
          this.calculateRecommendedNextSprintSp(velocity, assigneeLoad, issues)
        );
        this.agingMetrics.set(this.calculateAgingMetrics(issues));
        this.riskIssues.set(this.detectRiskIssues(issues));
        const analysis = this.analyzeIssues(issues);
        this.issueAnalysis.set(analysis);
        this.retroReport.set(this.calculateRetroReport(stats, issues, velocity, assigneeLoad, analysis));
        this.releaseForecast.set(this.calculateReleaseForecast(issues, velocity));
        this.processAntipatterns.set(
          this.detectProcessAntipatterns(stats, issues, velocity, assigneeLoad)
        );
        this.executiveDashboard.set(
          this.calculateExecutiveDashboard(stats, issues, velocity, assigneeLoad)
        );
        this.aiWhySprintFailed.set(
          this.buildWhySprintFailedAnswer(stats, issues, velocity, this.riskIssues(), analysis)
        );
        this.aiNextSprintRisks.set(
          this.buildNextSprintRisksAnswer(this.processAntipatterns(), this.releaseForecast(), this.riskIssues())
        );
        this.aiOverloadedPeople.set(
          this.buildOverloadedPeopleAnswer(assigneeLoad, this.overloadedAssignees())
        );
        this.aiLikelyMissedIssues.set(this.detectLikelyMissedIssues(issues));
        this.addedAfterStartIssues.set(this.findAddedAfterStartIssues(issues));
        this.blockedLongIssues.set(this.findBlockedLongIssues(issues, this.blockedThresholdDays));
        this.frequentlyReopenedIssues.set(this.findFrequentlyReopenedIssues(issues));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка при загрузке задач из Jira', err);
        this.error.set('Не удалось загрузить задачи из Jira. Проверьте авторизацию и доступность Jira.');
        this.loading.set(false);
      }
    });
  }

  private calculateSprintStats(issues: JiraIssue[]): {
    sprintName: string;
    plannedSp: number;
    closedSp: number;
    addedMidSprintSp: number;
    carryOverPercent: number;
    addedVolumePercent: number;
  }[] {
    const bySprint = new Map<
      string,
      {
        plannedSp: number;
        closedSp: number;
        addedMidSprintSp: number;
      }
    >();

    for (const issue of issues) {
      const sprintName = issue.fields.sprintName ?? 'Без спринта';
      const sp = issue.fields.storyPoints ?? 0;
      const planned = issue.fields.plannedInSprint ?? false;
      const addedMid = issue.fields.addedMidSprint ?? false;
      const isClosed = issue.fields.status?.name === 'Done';

      if (!bySprint.has(sprintName)) {
        bySprint.set(sprintName, {
          plannedSp: 0,
          closedSp: 0,
          addedMidSprintSp: 0
        });
      }

      const agg = bySprint.get(sprintName)!;

      if (planned) {
        agg.plannedSp += sp;
      }

      if (isClosed) {
        agg.closedSp += sp;
      }

      if (addedMid) {
        agg.addedMidSprintSp += sp;
      }
    }

    return Array.from(bySprint.entries()).map(([sprintName, agg]) => {
      const carryOver =
        agg.plannedSp > 0 ? Math.round(((agg.plannedSp - agg.closedSp) / agg.plannedSp) * 100) : 0;

      const totalVolume = agg.plannedSp + agg.addedMidSprintSp;
      const addedVolumePercent =
        totalVolume > 0 ? Math.round((agg.addedMidSprintSp / totalVolume) * 100) : 0;

      return {
        sprintName,
        plannedSp: agg.plannedSp,
        closedSp: agg.closedSp,
        addedMidSprintSp: agg.addedMidSprintSp,
        carryOverPercent: carryOver,
        addedVolumePercent
      };
    });
  }

  private calculateVelocityMetrics(stats: {
    sprintName: string;
    plannedSp: number;
    closedSp: number;
    addedMidSprintSp: number;
    carryOverPercent: number;
    addedVolumePercent: number;
  }[]):
    | {
        average: number;
        stdDev: number;
        trend: 'up' | 'down' | 'flat';
        forecastNext: number;
        history: { sprintName: string; velocity: number }[];
      }
    | null {
    if (!stats.length) {
      return null;
    }

    const history = stats.map((s) => ({
      sprintName: s.sprintName,
      velocity: s.closedSp
    }));

    const velocities = history.map((h) => h.velocity);
    const n = velocities.length;
    const sum = velocities.reduce((acc, v) => acc + v, 0);
    const average = n > 0 ? sum / n : 0;

    const variance =
      n > 0 ? velocities.reduce((acc, v) => acc + Math.pow(v - average, 2), 0) / n : 0;
    const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (n >= 2) {
      const first = velocities[0];
      const last = velocities[n - 1];
      const diff = last - first;
      if (diff > 1) {
        trend = 'up';
      } else if (diff < -1) {
        trend = 'down';
      } else {
        trend = 'flat';
      }
    }

    let forecastNext = velocities[n - 1] ?? 0;
    if (n >= 2) {
      const first = velocities[0];
      const last = velocities[n - 1];
      const slope = (last - first) / (n - 1);
      forecastNext = Math.max(0, Math.round(last + slope));
    }

    return {
      average: Math.round(average * 10) / 10,
      stdDev,
      trend,
      forecastNext,
      history
    };
  }

  private calculateAssigneeLoad(issues: JiraIssue[]): AssigneeLoadStat[] {
    const byAssignee = new Map<
      string,
      {
        totalClosedSp: number;
        sprints: Set<string>;
      }
    >();

    for (const issue of issues) {
      const assigneeName = issue.fields.assignee?.displayName ?? 'Без исполнителя';
      const sprintName = issue.fields.sprintName ?? 'Без спринта';
      const sp = issue.fields.storyPoints ?? 0;
      const isClosed = issue.fields.status?.name === 'Done';

      if (!byAssignee.has(assigneeName)) {
        byAssignee.set(assigneeName, {
          totalClosedSp: 0,
          sprints: new Set<string>()
        });
      }

      const agg = byAssignee.get(assigneeName)!;

      if (sp > 0) {
        agg.sprints.add(sprintName);
      }

      if (isClosed) {
        agg.totalClosedSp += sp;
      }
    }

    return Array.from(byAssignee.entries())
      .map(([assignee, agg]) => {
        const sprintsCount = agg.sprints.size || 1;
        const avgPerSprint = agg.totalClosedSp / sprintsCount;
        return {
          assignee,
          totalClosedSp: agg.totalClosedSp,
          sprintsCount,
          avgPerSprint
        };
      })
      .sort((a, b) => b.avgPerSprint - a.avgPerSprint);
  }

  private classifyAssigneeLoad(load: AssigneeLoadStat[]): {
    overloaded: AssigneeLoadStat[];
    underloaded: AssigneeLoadStat[];
  } {
    if (!load.length) {
      return { overloaded: [], underloaded: [] };
    }

    const avgTeamLoad =
      load.reduce((acc, item) => acc + item.avgPerSprint, 0) / Math.max(load.length, 1);

    const highThreshold = avgTeamLoad * 1.2;
    const lowThreshold = avgTeamLoad * 0.8;

    const overloaded = load.filter((item) => item.avgPerSprint > highThreshold);
    const underloaded = load.filter((item) => item.avgPerSprint < lowThreshold);

    return { overloaded, underloaded };
  }

  private buildAiForecastText(
    velocity: {
      average: number;
      stdDev: number;
      trend: 'up' | 'down' | 'flat';
      forecastNext: number;
      history: { sprintName: string; velocity: number }[];
    } | null,
    assigneeLoad: AssigneeLoadStat[]
  ): string | null {
    if (!velocity) {
      return null;
    }

    const avg = velocity.average;
    const std = velocity.stdDev || 0.1;

    const low = Math.max(0, Math.round(avg - std));
    const high = Math.max(low + 1, Math.round(avg + std));

    const variability = std / Math.max(avg, 1);
    let prob = 0.85 - variability * 0.3;
    prob = Math.min(Math.max(prob, 0.55), 0.95);
    const probPercent = Math.round(prob * 100);

    return `С вероятностью ${probPercent}% команда возьмёт ${low}–${high} SP`;
  }

  private calculateRecommendedNextSprintSp(
    velocity:
      | {
          average: number;
          stdDev: number;
          trend: 'up' | 'down' | 'flat';
          forecastNext: number;
          history: { sprintName: string; velocity: number }[];
        }
      | null,
    assigneeLoad: AssigneeLoadStat[],
    issues: JiraIssue[]
  ): number | null {
    if (!velocity || !assigneeLoad.length) {
      return null;
    }

    const baseVelocity = velocity.forecastNext || velocity.average;

    const teamSize = assigneeLoad.length;

    // Условные данные по отпускам и праздникам (в реальности сюда нужно подставлять реальные календари)
    const SPRINT_LENGTH_DAYS = 10;
    const totalVacationPersonDays = teamSize; // предположим, по 1 дню отпуска на человека
    const holidaysDays = 1; // один праздничный день в спринте

    const capacityFactorRaw =
      1 - (totalVacationPersonDays + holidaysDays * teamSize) / (SPRINT_LENGTH_DAYS * teamSize);
    const capacityFactor = Math.min(Math.max(capacityFactorRaw, 0.5), 1); // от 0.5 до 1

    const rawCapacity = baseVelocity * capacityFactor;

    const openSp = issues
      .filter((i) => i.fields.status?.name !== 'Done')
      .reduce((sum, i) => sum + (i.fields.storyPoints ?? 0), 0);

    // Считаем, что часть объёма «съедается» незакрытыми задачами
    const adjustedCapacity = Math.max(0, rawCapacity - openSp * 0.3);

    return Math.max(5, Math.round(adjustedCapacity));
  }

  private calculateExecutiveDashboard(
    stats: {
      sprintName: string;
      plannedSp: number;
      closedSp: number;
      addedMidSprintSp: number;
      carryOverPercent: number;
      addedVolumePercent: number;
    }[],
    issues: JiraIssue[],
    velocity:
      | {
          average: number;
          stdDev: number;
          trend: 'up' | 'down' | 'flat';
          forecastNext: number;
          history: { sprintName: string; velocity: number }[];
        }
      | null,
    assigneeLoad: AssigneeLoadStat[]
  ): ExecutiveDashboard | null {
    if (!stats.length || !velocity) {
      return null;
    }

    const plannedSprints = stats.filter((s) => s.plannedSp > 0);
    if (!plannedSprints.length) {
      return null;
    }

    const predictabilities = plannedSprints.map((s) =>
      Math.min(1, s.closedSp / Math.max(s.plannedSp, 1))
    );
    const avgPredictability =
      predictabilities.reduce((a, b) => a + b, 0) / predictabilities.length;

    let predictabilityTrend: 'up' | 'down' | 'flat' = 'flat';
    if (plannedSprints.length >= 2) {
      const first = plannedSprints[0];
      const last = plannedSprints[plannedSprints.length - 1];
      const firstP = first.closedSp / Math.max(first.plannedSp, 1);
      const lastP = last.closedSp / Math.max(last.plannedSp, 1);
      const diff = lastP - firstP;
      if (diff > 0.1) {
        predictabilityTrend = 'up';
      } else if (diff < -0.1) {
        predictabilityTrend = 'down';
      }
    }

    const throughputPerSprint = velocity.average;

    const SLA_TARGET_HOURS = 72;
    const cycleData = issues
      .map((i) => i.fields.cycleTimeHours ?? 0)
      .filter((v) => v > 0);
    let slaCompliancePct = 0;
    if (cycleData.length) {
      const ok = cycleData.filter((v) => v <= SLA_TARGET_HOURS).length;
      slaCompliancePct = (ok / cycleData.length) * 100;
    }

    const teamSize = Math.max(assigneeLoad.length, 1);
    const burnRatePerPerson = throughputPerSprint / teamSize;

    return {
      deliveryPredictabilityPct: avgPredictability * 100,
      predictabilityTrend,
      throughputPerSprint,
      slaCompliancePct,
      burnRatePerPerson
    };
  }

  private calculateReleaseForecast(
    issues: JiraIssue[],
    velocity:
      | {
          average: number;
          stdDev: number;
          trend: 'up' | 'down' | 'flat';
          forecastNext: number;
          history: { sprintName: string; velocity: number }[];
        }
      | null
  ): ReleaseForecast | null {
    const remainingSp = issues
      .filter((i) => i.fields.status?.name !== 'Done')
      .reduce((sum, i) => sum + (i.fields.storyPoints ?? 0), 0);

    if (!velocity || remainingSp <= 0 || velocity.average <= 0) {
      return null;
    }

    const SPRINT_LENGTH_DAYS = 10;

    const mu = velocity.average;
    const sigma = Math.max(velocity.stdDev, mu * 0.1);

    const p50Sprints = remainingSp / mu;
    const p80Velocity = Math.max(mu - 0.84 * sigma, mu * 0.3);
    const p80Sprints = remainingSp / p80Velocity;

    const today = new Date();

    const p50Date = new Date(
      today.getTime() + p50Sprints * SPRINT_LENGTH_DAYS * 24 * 60 * 60 * 1000
    );
    const p80Date = new Date(
      today.getTime() + p80Sprints * SPRINT_LENGTH_DAYS * 24 * 60 * 60 * 1000
    );

    return {
      remainingSp: Math.round(remainingSp),
      p50Sprints,
      p80Sprints,
      p50Date,
      p80Date
    };
  }

  private detectProcessAntipatterns(
    stats: {
      sprintName: string;
      plannedSp: number;
      closedSp: number;
      addedMidSprintSp: number;
      carryOverPercent: number;
      addedVolumePercent: number;
    }[],
    issues: JiraIssue[],
    velocity:
      | {
          average: number;
          stdDev: number;
          trend: 'up' | 'down' | 'flat';
          forecastNext: number;
          history: { sprintName: string; velocity: number }[];
        }
      | null,
    assigneeLoad: AssigneeLoadStat[]
  ): ProcessAntipattern[] {
    const patterns: ProcessAntipattern[] = [];

    // Спринты без планирования
    const sprintsWithoutPlanning = stats.filter(
      (s) => s.plannedSp === 0 && s.closedSp > 0
    );
    if (sprintsWithoutPlanning.length) {
      const names = sprintsWithoutPlanning.map((s) => s.sprintName).join(', ');
      patterns.push({
        title: 'Спринты без планирования',
        description: `Найдены спринты с выполненной работой, но без планового объёма: ${names}.`
      });
    }

    // Частые изменения scope (высокий добавленный объём)
    const highScopeSprints = stats.filter((s) => s.addedVolumePercent > 40);
    if (highScopeSprints.length >= Math.max(1, Math.floor(stats.length / 3))) {
      patterns.push({
        title: 'Частые изменения scope',
        description:
          'В значительной части спринтов больше 40% объёма добавляется в середине спринта — возможно, планирование нестабильно.'
      });
    }

    // Слишком большой WIP
    const teamSize = Math.max(assigneeLoad.length, 1);
    const wipCount = issues.filter((i) => {
      const status = i.fields.status?.name;
      return status === 'In Progress' || status === 'In Review';
    }).length;
    const wipPerPerson = wipCount / teamSize;
    if (wipPerPerson > 2.5) {
      patterns.push({
        title: 'Слишком большой WIP',
        description: `В среднем ~${wipPerPerson.toFixed(
          1
        )} задач в работе на человека — это может замедлять throughput и увеличивать context switching.`
      });
    }

    // Очень разная оценка задач (большой разброс SP)
    const allSp = issues
      .map((i) => i.fields.storyPoints ?? 0)
      .filter((v) => v > 0);
    if (allSp.length >= 3) {
      const avgSp = allSp.reduce((a, b) => a + b, 0) / allSp.length;
      const varSp =
        allSp.reduce((a, v) => a + Math.pow(v - avgSp, 2), 0) / allSp.length;
      const stdSp = Math.sqrt(varSp);
      const cv = stdSp / Math.max(avgSp, 1);
      if (cv > 0.8) {
        patterns.push({
          title: 'Очень разная оценка задач',
          description:
            'Большой разброс story points — возможно, команда по-разному интерпретирует шкалу оценок.'
        });
      }
    }

    // Постоянный переразгон velocity (берут больше, чем стабильно закрывают)
    if (stats.length >= 2) {
      const overcommittedSprints = stats.filter(
        (s) => s.plannedSp > 0 && s.closedSp / s.plannedSp < 0.7
      );
      if (
        overcommittedSprints.length >= Math.max(
          1,
          Math.floor(stats.length / 3)
        )
      ) {
        patterns.push({
          title: 'Постоянный переразгон velocity',
          description:
            'Во многих спринтах закрывается существенно меньше SP, чем планируется — стоит скорректировать планирование и ожидания.'
        });
      }
    }

    return patterns;
  }

  private calculateAgingMetrics(issues: JiraIssue[]): AgingMetrics | null {
    if (!issues.length) {
      return null;
    }

    let sumInProgress = 0;
    let sumInReview = 0;
    let sumCycle = 0;
    let sumFlow = 0;
    let countWithCycle = 0;

    for (const issue of issues) {
      const inProgress = issue.fields.timeInProgressHours ?? 0;
      const inReview = issue.fields.timeInReviewHours ?? 0;
      const cycle = issue.fields.cycleTimeHours ?? 0;
      const flow = issue.fields.flowEfficiency ?? 0;

      if (cycle > 0) {
        sumInProgress += inProgress;
        sumInReview += inReview;
        sumCycle += cycle;
        sumFlow += flow;
        countWithCycle++;
      }
    }

    if (!countWithCycle) {
      return null;
    }

    return {
      avgInProgressHours: sumInProgress / countWithCycle,
      avgInReviewHours: sumInReview / countWithCycle,
      avgCycleTimeHours: sumCycle / countWithCycle,
      avgFlowEfficiency: sumFlow / countWithCycle
    };
  }

  private detectRiskIssues(issues: JiraIssue[]): RiskIssue[] {
    const now = new Date();
    const riskList: RiskIssue[] = [];

    for (const issue of issues) {
      const reasons: string[] = [];

      // Долго без движения
      if (issue.fields.lastStatusChangeAt) {
        const lastChange = new Date(issue.fields.lastStatusChangeAt);
        const daysSince =
          (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 5) {
          reasons.push(`Без движения ~${Math.floor(daysSince)} дн.`);
        }
      }

      // Часто меняет статус
      const changes = issue.fields.statusChangeCount ?? 0;
      if (changes >= 8) {
        reasons.push(`Много смен статуса (${changes})`);
      }

      // Висит в ревью
      if (issue.fields.inReviewSince && issue.fields.status?.name === 'In Review') {
        const inReviewSince = new Date(issue.fields.inReviewSince);
        const daysInReview =
          (now.getTime() - inReviewSince.getTime()) / (1000 * 60 * 60 * 24);
        if (daysInReview > 3) {
          reasons.push(`Висит в review ~${Math.floor(daysInReview)} дн.`);
        }
      }

      if (reasons.length) {
        riskList.push({
          issue,
          reason: reasons.join(' · ')
        });
      }
    }

    return riskList;
  }

  private analyzeIssues(issues: JiraIssue[]): IssueAnalysis[] {
    const bugKeywords = ['bug', 'ошибк', 'defect', 'фикс', 'fix'];
    const techDebtKeywords = ['рефактор', 'refactor', 'долг', 'tech debt', 'оптимиз', 'cleanup'];
    const featureKeywords = ['реализовать', 'добавить', 'внедрить', 'feature', 'фича'];

    const analyses: IssueAnalysis[] = [];

    for (const issue of issues) {
      const summary = (issue.fields.summary || '').toLowerCase();
      const sp = issue.fields.storyPoints ?? 0;

      let kind: 'bug' | 'feature' | 'tech_debt' = 'feature';

      if (bugKeywords.some((k) => summary.includes(k))) {
        kind = 'bug';
      } else if (techDebtKeywords.some((k) => summary.includes(k))) {
        kind = 'tech_debt';
      } else if (featureKeywords.some((k) => summary.includes(k))) {
        kind = 'feature';
      }

      const isTooLarge = sp >= 13 || summary.length > 140;

      const isPoorlyDescribed =
        summary.length < 15 ||
        !(featureKeywords.concat(bugKeywords, techDebtKeywords).some((k) => summary.includes(k))) ||
        !issue.fields.storyPoints;

      const suggestions: string[] = [];

      if (isTooLarge) {
        suggestions.push(
          'Задача выглядит крупной. Рекомендуется разбить на подзадачи: анализ, реализация, тестирование.'
        );
      }

      if (isPoorlyDescribed) {
        suggestions.push(
          'Уточните описание: цель, ожидаемый результат, критерии готовности, ограничения.'
        );
      }

      analyses.push({
        issue,
        kind,
        isTooLarge,
        isPoorlyDescribed,
        suggestions
      });
    }

    return analyses;
  }

  private calculateRetroReport(
    stats: {
      sprintName: string;
      plannedSp: number;
      closedSp: number;
      addedMidSprintSp: number;
      carryOverPercent: number;
      addedVolumePercent: number;
    }[],
    issues: JiraIssue[],
    velocity:
      | {
          average: number;
          stdDev: number;
          trend: 'up' | 'down' | 'flat';
          forecastNext: number;
          history: { sprintName: string; velocity: number }[];
        }
      | null,
    assigneeLoad: AssigneeLoadStat[],
    analysis: IssueAnalysis[]
  ): RetroReport | null {
    if (!stats.length) {
      return null;
    }

    const wentWell: string[] = [];
    const wentBadly: string[] = [];

    const avgCarry =
      stats.reduce((acc, s) => acc + s.carryOverPercent, 0) / Math.max(stats.length, 1);
    const avgAddedVolume =
      stats.reduce((acc, s) => acc + s.addedVolumePercent, 0) / Math.max(stats.length, 1);

    if (velocity) {
      if (velocity.trend === 'up') {
        wentWell.push('Velocity растёт по сравнению с прошлыми спринтами.');
      } else if (velocity.trend === 'down') {
        wentBadly.push('Velocity падает — команда закрывает меньше SP.');
      } else {
        wentWell.push('Velocity стабильна на протяжении нескольких спринтов.');
      }
    }

    if (avgCarry < 20) {
      wentWell.push(`Низкий средний carry-over (~${Math.round(avgCarry)}%).`);
    }

    if (avgCarry > 40) {
      wentBadly.push(`Высокий средний carry-over (~${Math.round(avgCarry)}%).`);
    }

    if (avgAddedVolume < 20) {
      wentWell.push('Мало незапланированного объёма — scope creep под контролем.');
    } else if (avgAddedVolume > 40) {
      wentBadly.push('Много добавленных задач в середине спринта — планирование нестабильно.');
    }

    const blockedCount = this.findBlockedLongIssues(issues, this.blockedThresholdDays).length;
    if (blockedCount > 0) {
      wentBadly.push(`Есть задачи, долго висящие в Blocked (${blockedCount}).`);
    }

    const byKind = new Map<
      'bug' | 'feature' | 'tech_debt',
      { total: number; failed: number }
    >();

    for (const a of analysis) {
      const entry = byKind.get(a.kind) ?? { total: 0, failed: 0 };
      entry.total += 1;

      const status = a.issue.fields.status?.name as string | undefined;
      const isFailed =
        status !== 'Done' ||
        (a.issue.fields.reopenCount ?? 0) > 0 ||
        status === ('Blocked' as string);

      if (isFailed) {
        entry.failed += 1;
      }

      byKind.set(a.kind, entry);
    }

    const failingTypes: {
      kind: 'bug' | 'feature' | 'tech_debt';
      failureRate: number;
      total: number;
    }[] = [];

    for (const [kind, v] of byKind.entries()) {
      if (!v.total) continue;
      failingTypes.push({
        kind,
        total: v.total,
        failureRate: v.failed / v.total
      });
    }

    failingTypes.sort((a, b) => b.failureRate - a.failureRate);

    const carryMap = new Map<
      string,
      {
        sp: number;
        sprints: Set<string>;
      }
    >();

    for (const issue of issues) {
      const sp = issue.fields.storyPoints ?? 0;
      const planned = issue.fields.plannedInSprint ?? false;
      const done = issue.fields.status?.name === 'Done';
      if (!planned || done || sp <= 0) continue;

      const assignee = issue.fields.assignee?.displayName ?? 'Без исполнителя';
      const sprintName = issue.fields.sprintName ?? 'Без спринта';

      const entry =
        carryMap.get(assignee) ??
        {
          sp: 0,
          sprints: new Set<string>()
        };
      entry.sp += sp;
      entry.sprints.add(sprintName);
      carryMap.set(assignee, entry);
    }

    const carryOverByAssignee = Array.from(carryMap.entries())
      .map(([assignee, v]) => ({
        assignee,
        carryOverSp: v.sp,
        sprintsCount: v.sprints.size
      }))
      .sort((a, b) => b.carryOverSp - a.carryOverSp)
      .slice(0, 5);

    return {
      wentWell,
      wentBadly,
      failingTypes,
      carryOverByAssignee
    };
  }

  private buildWhySprintFailedAnswer(
    stats: {
      sprintName: string;
      plannedSp: number;
      closedSp: number;
      addedMidSprintSp: number;
      carryOverPercent: number;
      addedVolumePercent: number;
    }[],
    issues: JiraIssue[],
    velocity:
      | {
          average: number;
          stdDev: number;
          trend: 'up' | 'down' | 'flat';
          forecastNext: number;
          history: { sprintName: string; velocity: number }[];
        }
      | null,
    riskIssues: RiskIssue[],
    analysis: IssueAnalysis[]
  ): string | null {
    if (!stats.length) return null;
    const last = stats[stats.length - 1];

    const reasons: string[] = [];

    if (last.plannedSp > 0 && last.closedSp / last.plannedSp < 0.7) {
      reasons.push(
        `закрыто только ~${Math.round((last.closedSp / last.plannedSp) * 100)}% от плана`
      );
    }

    if (last.carryOverPercent > 40) {
      reasons.push(`высокий carry-over (~${last.carryOverPercent}%)`);
    }

    if (last.addedVolumePercent > 40) {
      reasons.push('много задач было добавлено в середине спринта');
    }

    const blockedInSprint = riskIssues.filter((r) =>
      r.reason.includes('Blocked')
    ).length;
    if (blockedInSprint > 0) {
      reasons.push(`часть задач долго висела в Blocked (${blockedInSprint})`);
    }

    const largeIssues = analysis.filter((a) => a.isTooLarge).length;
    if (largeIssues > 0) {
      reasons.push(`есть крупные задачи, которые сложно завершить за один спринт (${largeIssues})`);
    }

    if (!reasons.length) {
      return 'Спринт не выглядит проваленным по ключевым метрикам — план и фактический объём близки.';
    }

    return `Спринт просел из-за того, что ${reasons.join(
      ', '
    )}. Рекомендуется перерассмотреть планирование и разбивку задач.`;
  }

  private buildNextSprintRisksAnswer(
    patterns: ProcessAntipattern[],
    forecast: ReleaseForecast | null,
    riskIssues: RiskIssue[]
  ): string[] {
    const risks: string[] = [];

    for (const p of patterns) {
      risks.push(p.title + ': ' + p.description);
    }

    if (forecast && forecast.p80Sprints > forecast.p50Sprints * 1.3) {
      risks.push(
        'Высокая неопределённость по срокам релиза: P80 сильно позже P50, стоит уточнить объём и риски.'
      );
    }

    const blockedCount = riskIssues.filter((r) =>
      r.reason.includes('Blocked')
    ).length;
    if (blockedCount > 0) {
      risks.push(
        `Есть задачи с блокировками, которые могут переехать в следующий спринт (${blockedCount}).`
      );
    }

    return risks;
  }

  private buildOverloadedPeopleAnswer(
    assigneeLoad: AssigneeLoadStat[],
    overloaded: AssigneeLoadStat[]
  ): string[] {
    if (!overloaded.length) {
      return [];
    }

    const avgTeamLoad =
      assigneeLoad.reduce((acc, a) => acc + a.avgPerSprint, 0) /
      Math.max(assigneeLoad.length, 1);

    return overloaded.map(
      (a) =>
        `${a.assignee}: средняя загрузка ${a.avgPerSprint.toFixed(
          1
        )} SP/спринт (средняя по команде ~${avgTeamLoad.toFixed(1)} SP/спринт)`
    );
  }

  private detectLikelyMissedIssues(issues: JiraIssue[]): JiraIssue[] {
    const now = new Date();

    type Scored = { issue: JiraIssue; score: number };
    const scored: Scored[] = [];

    for (const issue of issues) {
      const status = issue.fields.status?.name;
      if (status === 'Done') continue;

      let score = 0;

      const sp = issue.fields.storyPoints ?? 0;
      if (sp >= 13) score += 3;
      else if (sp >= 8) score += 2;
      else if (sp >= 5) score += 1;

      if (status === 'Blocked') score += 3;
      if (status === 'In Review') score += 2;
      if (status === 'In Progress') score += 1;

      if (issue.fields.blockedSince) {
        const blockedSince = new Date(issue.fields.blockedSince);
        const daysBlocked =
          (now.getTime() - blockedSince.getTime()) / (1000 * 60 * 60 * 24);
        if (daysBlocked > 3) score += 2;
      }

      if (issue.fields.inReviewSince) {
        const inReviewSince = new Date(issue.fields.inReviewSince);
        const daysInReview =
          (now.getTime() - inReviewSince.getTime()) / (1000 * 60 * 60 * 24);
        if (daysInReview > 3) score += 1;
      }

      const reopenCount = issue.fields.reopenCount ?? 0;
      if (reopenCount >= 3) score += 2;
      else if (reopenCount >= 1) score += 1;

      if (issue.fields.timeInProgressHours && issue.fields.timeInProgressHours > 40) {
        score += 1;
      }

      if (score > 0) {
        scored.push({ issue, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10).map((s) => s.issue);
  }

  private findAddedAfterStartIssues(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => issue.fields.addedMidSprint);
  }

  private findBlockedLongIssues(issues: JiraIssue[], thresholdDays: number): JiraIssue[] {
    const now = new Date();

    return issues.filter((issue) => {
      if (issue.fields.status?.name !== 'Blocked' || !issue.fields.blockedSince) {
        return false;
      }

      const blockedSince = new Date(issue.fields.blockedSince);
      const diffMs = now.getTime() - blockedSince.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      return diffDays > thresholdDays;
    });
  }

  private findFrequentlyReopenedIssues(issues: JiraIssue[]): JiraIssue[] {
    const threshold = 2;
    return issues.filter((issue) => (issue.fields.reopenCount ?? 0) >= threshold);
  }

  daysBlocked(issue: JiraIssue): number {
    if (!issue.fields.blockedSince) {
      return 0;
    }

    const now = new Date();
    const blockedSince = new Date(issue.fields.blockedSince);
    const diffMs = now.getTime() - blockedSince.getTime();

    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}


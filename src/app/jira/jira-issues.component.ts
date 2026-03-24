import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpHeaders } from '@angular/common/http';
import { JiraIssue } from './jira.service';
import { MockJiraService } from './mock-jira.service';
import { JiraAnalyticsService } from './jira-analytics.service';
import type {
  AssigneeLoadStat,
  AgingMetrics,
  RiskIssue,
  ExecutiveDashboard,
  ReleaseForecast,
  RetroReport,
  ProcessAntipattern,
  BlockedIssueWithDays,
  IssueAnalysis
} from './jira.types';
import {
  SprintStatsBlockComponent,
  ExecutiveDashboardBlockComponent,
  VelocityBlockComponent,
  AssigneeLoadBlockComponent,
  ReleaseForecastBlockComponent,
  AddedAfterStartBlockComponent,
  AgingReportBlockComponent,
  RiskDetectionBlockComponent,
  RetroReportBlockComponent,
  AntipatternsBlockComponent,
  AiAnalysisBlockComponent,
  AiAnswersBlockComponent,
  BlockedIssuesBlockComponent,
  ReopenedIssuesBlockComponent,
  IssuesListBlockComponent
} from './blocks';

@Component({
  selector: 'app-jira-issues',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SprintStatsBlockComponent,
    ExecutiveDashboardBlockComponent,
    VelocityBlockComponent,
    AssigneeLoadBlockComponent,
    ReleaseForecastBlockComponent,
    AddedAfterStartBlockComponent,
    AgingReportBlockComponent,
    RiskDetectionBlockComponent,
    RetroReportBlockComponent,
    AntipatternsBlockComponent,
    AiAnalysisBlockComponent,
    AiAnswersBlockComponent,
    BlockedIssuesBlockComponent,
    ReopenedIssuesBlockComponent,
    IssuesListBlockComponent
  ],
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
        <div class="sprint-selector">
          <label for="sprint-select">Спринт</label>
          <select
            id="sprint-select"
            [ngModel]="selectedSprint()"
            (ngModelChange)="selectedSprint.set($event)"
          >
            <option [ngValue]="null">Все спринты</option>
            <option *ngFor="let s of sprintStats()" [ngValue]="s.sprintName">
              {{ s.sprintName }}
            </option>
          </select>
          <span class="sprint-selector-hint" *ngIf="selectedSprint()">
            Показаны данные по спринту «{{ selectedSprint() }}»
          </span>
        </div>

        <app-sprint-stats-block
          [stats]="sprintStatsToShow()"
          [selectedSprint]="selectedSprint()"
        />

        <div class="sprint-extra">
          <app-executive-dashboard-block [data]="executiveDashboard()" />

          <app-velocity-block
            [velocity]="velocityStats()"
            [aiForecast]="aiForecastText()"
            [recommendedSp]="recommendedNextSprintSp()"
          />

          <app-assignee-load-block
            [load]="assigneeLoad()"
            [overloaded]="overloadedAssignees()"
            [underloaded]="underloadedAssignees()"
          />

          <app-release-forecast-block [forecast]="releaseForecast()" />

          <app-added-after-start-block [issues]="addedAfterStartIssues()" />

          <app-aging-report-block [metrics]="agingMetrics()" />

          <app-risk-detection-block [issues]="riskIssues()" />

          <app-retro-report-block [report]="retroReport()" />

          <app-antipatterns-block [items]="processAntipatterns()" />

          <app-ai-analysis-block
            [analyzed]="analyzedIssues"
            [largeIssues]="largeIssues"
            [poorlyDescribed]="poorlyDescribedIssues"
          />

          @if (
            aiWhySprintFailed() ||
            aiNextSprintRisks().length ||
            aiOverloadedPeople().length ||
            aiLikelyMissedIssues().length
          ) {
            <app-ai-answers-block
              [whyFailed]="aiWhySprintFailed()"
              [risks]="aiNextSprintRisks()"
              [overloaded]="aiOverloadedPeople()"
              [likelyMissed]="aiLikelyMissedIssues()"
            />
          }

          <app-blocked-issues-block
            [items]="blockedIssuesWithDays()"
            [thresholdDays]="blockedThresholdDays"
          />

          <app-reopened-issues-block [issues]="frequentlyReopenedIssues()" />
        </div>
      </div>

      <app-issues-list-block

            *ngIf="!loading() && filteredIssues().length"
            [issues]="pagedIssues()"
            [selectedSprint]="selectedSprint()"
      />

      <div class="pagination">
        @for ( page of pages(); track page) {
          <button (click)="setPage(page)">
            {{page +1}}
          </button>        }

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

      .sprint-selector {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .sprint-selector select {
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #cbd5f5;
        font-size: 14px;
        min-width: 180px;
      }

      .sprint-selector-hint {
        font-size: 12px;
        color: #6b7280;
      }

      .selected-row {
        background: #dbeafe !important;
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
    `
  ]
})
export class JiraIssuesComponent {
  private readonly jiraService = inject(MockJiraService);
  private readonly analytics = inject(JiraAnalyticsService);

  setPage(page: number) {
    this.currentPage.set(page);
  }

  readonly currentPage = signal(0);
  readonly itemsPerPage = 10;


  readonly pagedIssues = computed(()=> {
    const all = this.filteredIssues();
    const page = this.currentPage();
    const startIndex = page * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;

    return all.slice(startIndex, endIndex);

  });
  readonly totalPages = computed (() => {
    return Math.ceil(this.filteredIssues().length / this.itemsPerPage);
  })
  readonly pages = computed (() => {
    return Array.from({length: this.totalPages()}, (_, i) => i);
  });

  readonly jql = signal<string>('project = YOURPROJECT ORDER BY created DESC');
  readonly issues = signal<JiraIssue[]>([]);
  readonly selectedSprint = signal<string | null>(null);
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
  readonly assigneeLoad = computed(() =>
    this.analytics.calculateAssigneeLoad(this.filteredIssues())
  );
  readonly overloadedAssignees = computed(() =>
    this.analytics.classifyAssigneeLoad(this.assigneeLoad()).overloaded
  );
  readonly underloadedAssignees = computed(() =>
    this.analytics.classifyAssigneeLoad(this.assigneeLoad()).underloaded
  );
  readonly agingMetrics = computed(() =>
    this.analytics.calculateAgingMetrics(this.filteredIssues())
  );
  readonly riskIssues = computed(() => this.analytics.detectRiskIssues(this.filteredIssues()));
  readonly issueAnalysis = computed(() => this.analytics.analyzeIssues(this.filteredIssues()));
  readonly retroReport = signal<RetroReport | null>(null);
  readonly releaseForecast = signal<ReleaseForecast | null>(null);
  readonly processAntipatterns = signal<ProcessAntipattern[]>([]);
  readonly executiveDashboard = signal<ExecutiveDashboard | null>(null);
  readonly aiWhySprintFailed = computed(() => {
    const stats = this.sprintStats();
    const sel = this.selectedSprint();
    const statsToUse = sel
      ? stats.filter((s) => s.sprintName === sel)
      : stats;
    if (!statsToUse.length) return null;
    return this.analytics.buildWhySprintFailedAnswer(
      statsToUse,
      this.filteredIssues(),
      this.velocityStats(),
      this.riskIssues(),
      this.issueAnalysis()
    );
  });
  readonly aiNextSprintRisks = signal<string[]>([]);
  readonly aiOverloadedPeople = computed(() =>
    this.analytics.buildOverloadedPeopleAnswer(
      this.assigneeLoad(),
      this.overloadedAssignees()
    )
  );
  readonly aiLikelyMissedIssues = computed(() =>
    this.analytics.detectLikelyMissedIssues(this.filteredIssues())
  );

  get analyzedIssues(): IssueAnalysis[] {
    return this.issueAnalysis();
  }

  get largeIssues(): IssueAnalysis[] {
    return this.issueAnalysis().filter((a) => a.isTooLarge);
  }

  get poorlyDescribedIssues(): IssueAnalysis[] {
    return this.issueAnalysis().filter((a) => a.isPoorlyDescribed);
  }

  readonly filteredIssues = computed(() => {
    const issues = this.issues();
    const sel = this.selectedSprint();
    if (!sel) return issues;
    return issues.filter((i) => (i.fields.sprintName ?? 'Без спринта') === sel);
  });

  readonly sprintStatsToShow = computed(() => {
    const stats = this.sprintStats();
    const sel = this.selectedSprint();
    if (!sel) return stats;
    return stats.filter((s) => s.sprintName === sel);
  });

  readonly addedAfterStartIssues = computed(() =>
    this.analytics.findAddedAfterStartIssues(this.filteredIssues())
  );
  readonly blockedLongIssues = computed(() =>
    this.analytics.findBlockedLongIssues(this.filteredIssues(), this.blockedThresholdDays)
  );
  readonly frequentlyReopenedIssues = computed(() =>
    this.analytics.findFrequentlyReopenedIssues(this.filteredIssues())
  );
  readonly blockedIssuesWithDays = computed(() =>
    this.blockedLongIssues().map((issue) => ({
      issue,
      daysBlocked: this.analytics.daysBlocked(issue)
    }))
  );
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
        const stats = this.analytics.calculateSprintStats(issues);
        this.sprintStats.set(stats);
        const velocity = this.analytics.calculateVelocityMetrics(stats);
        this.velocityStats.set(velocity);
        const assigneeLoad = this.analytics.calculateAssigneeLoad(issues);
        this.aiForecastText.set(this.analytics.buildAiForecastText(velocity, assigneeLoad));
        this.recommendedNextSprintSp.set(
          this.analytics.calculateRecommendedNextSprintSp(velocity, assigneeLoad, issues)
        );
        const analysis = this.analytics.analyzeIssues(issues);
        this.retroReport.set(
          this.analytics.calculateRetroReport(
            stats,
            issues,
            velocity,
            assigneeLoad,
            analysis,
            this.blockedThresholdDays
          )
        );
        this.releaseForecast.set(this.analytics.calculateReleaseForecast(issues, velocity));
        this.processAntipatterns.set(
          this.analytics.detectProcessAntipatterns(stats, issues, velocity, assigneeLoad)
        );
        this.executiveDashboard.set(
          this.analytics.calculateExecutiveDashboard(stats, issues, velocity, assigneeLoad)
        );
        this.aiNextSprintRisks.set(
          this.analytics.buildNextSprintRisksAnswer(
            this.processAntipatterns(),
            this.releaseForecast(),
            this.analytics.detectRiskIssues(issues)
          )
        );
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка при загрузке задач из Jira', err);
        this.error.set('Не удалось загрузить задачи из Jira. Проверьте авторизацию и доступность Jira.');
        this.loading.set(false);
      }
    });
  }

}


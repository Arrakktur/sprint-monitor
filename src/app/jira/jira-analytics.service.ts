import { Injectable } from '@angular/core';
import { JiraIssue } from './jira.service';
import type {
  AssigneeLoadStat,
  AgingMetrics,
  RiskIssue,
  IssueAnalysis,
  RetroReport,
  ReleaseForecast,
  ProcessAntipattern,
  ExecutiveDashboard,
  SprintStatRow,
  VelocityStats
} from './jira.types';

@Injectable({ providedIn: 'root' })
export class JiraAnalyticsService {
  calculateSprintStats(issues: JiraIssue[]): SprintStatRow[] {
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

  calculateVelocityMetrics(stats: SprintStatRow[]): VelocityStats | null {
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

  calculateAssigneeLoad(issues: JiraIssue[]): AssigneeLoadStat[] {
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

  classifyAssigneeLoad(load: AssigneeLoadStat[]): {
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

  buildAiForecastText(velocity: VelocityStats | null, assigneeLoad: AssigneeLoadStat[]): string | null {
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

  calculateRecommendedNextSprintSp(
    velocity: VelocityStats | null,
    assigneeLoad: AssigneeLoadStat[],
    issues: JiraIssue[]
  ): number | null {
    if (!velocity || !assigneeLoad.length) {
      return null;
    }

    const baseVelocity = velocity.forecastNext || velocity.average;

    const teamSize = assigneeLoad.length;

    const SPRINT_LENGTH_DAYS = 10;
    const totalVacationPersonDays = teamSize;
    const holidaysDays = 1;

    const capacityFactorRaw =
      1 - (totalVacationPersonDays + holidaysDays * teamSize) / (SPRINT_LENGTH_DAYS * teamSize);
    const capacityFactor = Math.min(Math.max(capacityFactorRaw, 0.5), 1);

    const rawCapacity = baseVelocity * capacityFactor;

    const openSp = issues
      .filter((i) => i.fields.status?.name !== 'Done')
      .reduce((sum, i) => sum + (i.fields.storyPoints ?? 0), 0);

    const adjustedCapacity = Math.max(0, rawCapacity - openSp * 0.3);

    return Math.max(5, Math.round(adjustedCapacity));
  }

  calculateExecutiveDashboard(
    stats: SprintStatRow[],
    issues: JiraIssue[],
    velocity: VelocityStats | null,
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

  calculateReleaseForecast(issues: JiraIssue[], velocity: VelocityStats | null): ReleaseForecast | null {
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

  detectProcessAntipatterns(
    stats: SprintStatRow[],
    issues: JiraIssue[],
    _velocity: VelocityStats | null,
    assigneeLoad: AssigneeLoadStat[]
  ): ProcessAntipattern[] {
    const patterns: ProcessAntipattern[] = [];

    const sprintsWithoutPlanning = stats.filter((s) => s.plannedSp === 0 && s.closedSp > 0);
    if (sprintsWithoutPlanning.length) {
      const names = sprintsWithoutPlanning.map((s) => s.sprintName).join(', ');
      patterns.push({
        title: 'Спринты без планирования',
        description: `Найдены спринты с выполненной работой, но без планового объёма: ${names}.`
      });
    }

    const highScopeSprints = stats.filter((s) => s.addedVolumePercent > 40);
    if (highScopeSprints.length >= Math.max(1, Math.floor(stats.length / 3))) {
      patterns.push({
        title: 'Частые изменения scope',
        description:
          'В значительной части спринтов больше 40% объёма добавляется в середине спринта — возможно, планирование нестабильно.'
      });
    }

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

    const allSp = issues
      .map((i) => i.fields.storyPoints ?? 0)
      .filter((v) => v > 0);
    if (allSp.length >= 3) {
      const avgSp = allSp.reduce((a, b) => a + b, 0) / allSp.length;
      const varSp = allSp.reduce((a, v) => a + Math.pow(v - avgSp, 2), 0) / allSp.length;
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

    if (stats.length >= 2) {
      const overcommittedSprints = stats.filter(
        (s) => s.plannedSp > 0 && s.closedSp / s.plannedSp < 0.7
      );
      if (overcommittedSprints.length >= Math.max(1, Math.floor(stats.length / 3))) {
        patterns.push({
          title: 'Постоянный переразгон velocity',
          description:
            'Во многих спринтах закрывается существенно меньше SP, чем планируется — стоит скорректировать планирование и ожидания.'
        });
      }
    }

    return patterns;
  }

  calculateAgingMetrics(issues: JiraIssue[]): AgingMetrics | null {
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

  detectRiskIssues(issues: JiraIssue[]): RiskIssue[] {
    const now = new Date();
    const riskList: RiskIssue[] = [];

    for (const issue of issues) {
      const reasons: string[] = [];

      if (issue.fields.lastStatusChangeAt) {
        const lastChange = new Date(issue.fields.lastStatusChangeAt);
        const daysSince = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 5) {
          reasons.push(`Без движения ~${Math.floor(daysSince)} дн.`);
        }
      }

      const changes = issue.fields.statusChangeCount ?? 0;
      if (changes >= 8) {
        reasons.push(`Много смен статуса (${changes})`);
      }

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

  analyzeIssues(issues: JiraIssue[]): IssueAnalysis[] {
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
        !featureKeywords.concat(bugKeywords, techDebtKeywords).some((k) => summary.includes(k)) ||
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

  calculateRetroReport(
    stats: SprintStatRow[],
    issues: JiraIssue[],
    velocity: VelocityStats | null,
    assigneeLoad: AssigneeLoadStat[],
    analysis: IssueAnalysis[],
    blockedThresholdDays: number
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

    const blockedCount = this.findBlockedLongIssues(issues, blockedThresholdDays).length;
    if (blockedCount > 0) {
      wentBadly.push(`Есть задачи, долго висящие в Blocked (${blockedCount}).`);
    }

    const byKind = new Map<'bug' | 'feature' | 'tech_debt', { total: number; failed: number }>();

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

      const entry = carryMap.get(assignee) ?? {
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

  buildWhySprintFailedAnswer(
    stats: SprintStatRow[],
    issues: JiraIssue[],
    velocity: VelocityStats | null,
    riskIssues: RiskIssue[],
    analysis: IssueAnalysis[]
  ): string | null {
    if (!stats.length) return null;
    const last = stats[stats.length - 1];

    const reasons: string[] = [];

    if (last.plannedSp > 0 && last.closedSp / last.plannedSp < 0.7) {
      reasons.push(`закрыто только ~${Math.round((last.closedSp / last.plannedSp) * 100)}% от плана`);
    }

    if (last.carryOverPercent > 40) {
      reasons.push(`высокий carry-over (~${last.carryOverPercent}%)`);
    }

    if (last.addedVolumePercent > 40) {
      reasons.push('много задач было добавлено в середине спринта');
    }

    const blockedInSprint = riskIssues.filter((r) => r.reason.includes('Blocked')).length;
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

  buildNextSprintRisksAnswer(
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

    const blockedCount = riskIssues.filter((r) => r.reason.includes('Blocked')).length;
    if (blockedCount > 0) {
      risks.push(
        `Есть задачи с блокировками, которые могут переехать в следующий спринт (${blockedCount}).`
      );
    }

    return risks;
  }

  buildOverloadedPeopleAnswer(
    assigneeLoad: AssigneeLoadStat[],
    overloaded: AssigneeLoadStat[]
  ): string[] {
    if (!overloaded.length) {
      return [];
    }

    const avgTeamLoad =
      assigneeLoad.reduce((acc, a) => acc + a.avgPerSprint, 0) / Math.max(assigneeLoad.length, 1);

    return overloaded.map(
      (a) =>
        `${a.assignee}: средняя загрузка ${a.avgPerSprint.toFixed(
          1
        )} SP/спринт (средняя по команде ~${avgTeamLoad.toFixed(1)} SP/спринт)`
    );
  }

  detectLikelyMissedIssues(issues: JiraIssue[]): JiraIssue[] {
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
        const daysBlocked = (now.getTime() - blockedSince.getTime()) / (1000 * 60 * 60 * 24);
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

  findAddedAfterStartIssues(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => issue.fields.addedMidSprint);
  }

  findBlockedLongIssues(issues: JiraIssue[], thresholdDays: number): JiraIssue[] {
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

  findFrequentlyReopenedIssues(issues: JiraIssue[]): JiraIssue[] {
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

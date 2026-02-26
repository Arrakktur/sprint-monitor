import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    // Имя спринта (как будто из Jira custom field Sprint)
    sprintName?: string;
    // Оценка в story points
    storyPoints?: number;
    // Была ли задача добавлена в середине спринта
    addedMidSprint?: boolean;
    // Была ли задача запланирована в начале спринта
    plannedInSprint?: boolean;
    // Дата создания задачи
    createdAt?: string;
    // Дата старта спринта
    sprintStartDate?: string;
    // Дата, с которой задача в статусе Blocked
    blockedSince?: string;
    // Количество переоткрытий задачи
    reopenCount?: number;
    // Часы в статусе In Progress
    timeInProgressHours?: number;
    // Часы в статусе In Review
    timeInReviewHours?: number;
    // Полный cycle time от начала работы до Done, в часах
    cycleTimeHours?: number;
    // Доля активной работы (progress + review) от всего цикла (0–1)
    flowEfficiency?: number;
    // Дата последнего изменения статуса
    lastStatusChangeAt?: string;
    // Общее количество смен статуса
    statusChangeCount?: number;
    // Дата, с которой задача в ревью
    inReviewSince?: string;
    status?: {
      name: string;
    };
    assignee?: {
      displayName: string;
    };
    [key: string]: unknown;
  };
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class JiraService {
  private readonly http = inject(HttpClient);

  /**
   * ВНИМАНИЕ ПО БЕЗОПАСНОСТИ:
   * - Не хардкодьте логин/пароль или API token в коде.
   * - Лучше всего: прокидывать авторизацию через backend или proxy.
   * - Здесь headers принимаются параметром, чтобы вы могли собрать их снаружи
   *   (например, через переменные окружения или backend-токен).
   */
  getIssues(jql: string, headers?: HttpHeaders): Observable<JiraSearchResponse> {
    // Запрос идёт на dev‑proxy Angular (`/jira-api`), который дальше прокидывает на https://jira.lenta.com
    const url = `/jira-api/rest/api/2/search`;

    let params = new HttpParams().set('jql', jql).set('maxResults', 50);

    return this.http.get<JiraSearchResponse>(url, {
      params,
      headers
    });
  }
}


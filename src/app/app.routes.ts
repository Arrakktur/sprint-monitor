import { Routes } from '@angular/router';
import { JiraIssuesComponent } from './jira/jira-issues.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'jira',
    pathMatch: 'full'
  },
  {
    path: 'jira',
    component: JiraIssuesComponent
  }
];


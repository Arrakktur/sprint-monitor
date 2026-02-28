import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-collapsible-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="collapsible-block" [class.block-card]="blockCard()">
      <div class="block-header" (click)="toggle()">
        <ng-content select="[header]"></ng-content>
        <span class="toggle-icon">{{ collapsed() ? '▶' : '▼' }}</span>
      </div>
      <div class="block-content" *ngIf="!collapsed()">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
      .collapsible-block {
        margin-bottom: 4px;
      }
      .block-card {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
      }
      .block-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
        padding: 4px 0;
        user-select: none;
      }
      .block-header:hover {
        opacity: 0.9;
      }
      .block-header :deep(h2),
      .block-header :deep(h3) {
        margin: 0;
      }
      .toggle-icon {
        flex-shrink: 0;
        font-size: 12px;
        color: #6b7280;
      }
      .block-content {
        margin-top: 4px;
      }
    `
  ]
})
export class CollapsibleBlockComponent {
  readonly blockCard = input<boolean>(true);
  readonly collapsed = signal(false);

  toggle(): void {
    this.collapsed.update((v) => !v);
  }
}

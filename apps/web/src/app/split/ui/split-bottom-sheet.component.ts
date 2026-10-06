import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
@Component({
  selector: 'nexus-split-bottom-sheet',
  standalone: true,
  template: `<div class="sheet-backdrop" (click)="backdrop()">
    <section
      #panel
      class="sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="label"
      tabindex="-1"
      (click)="$event.stopPropagation()"
    >
      <span class="sheet-handle"></span><ng-content></ng-content>
    </section>
  </div>`,
  styleUrls: ['./split-ui.scss'],
})
export class SplitBottomSheetComponent implements AfterViewInit, OnDestroy {
  @Input() label = 'Dialog';
  @Input() dismissible = true;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  private previous?: HTMLElement;
  private readonly document = inject(DOCUMENT);
  ngAfterViewInit() {
    this.previous = this.document.activeElement as HTMLElement;
    this.document.body.classList.add('split-sheet-open');
    this.panel?.nativeElement.focus();
  }
  ngOnDestroy() {
    this.document.body.classList.remove('split-sheet-open');
    this.previous?.focus();
  }
  @HostListener('document:keydown.escape') escape() {
    if (this.dismissible) this.closed.emit();
  }
  backdrop() {
    if (this.dismissible) this.closed.emit();
  }
}

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
      [class.sheet-expandable]="expandable"
      [class.sheet-expanded]="expanded"
      [class.sheet-dragging]="dragging"
      [style.height.px]="height"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="label"
      tabindex="-1"
      (click)="$event.stopPropagation()"
    >
      <span class="sheet-handle" [class.draggable]="expandable" (pointerdown)="dragStart($event)"></span><ng-content></ng-content>
    </section>
  </div>`,
  styleUrls: ['./split-ui.scss'],
})
export class SplitBottomSheetComponent implements AfterViewInit, OnDestroy {
  @Input() label = 'Dialog';
  @Input() dismissible = true;
  @Input() expandable = false;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  private previous?: HTMLElement;
  private readonly document = inject(DOCUMENT);
  height: number | null = null;
  expanded = false;
  dragging = false;
  private dragOriginY = 0;
  private dragOriginHeight = 0;
  private collapsedHeight = 0;
  private maximumHeight = 0;
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
  dragStart(event: PointerEvent) {
    if (!this.expandable || !this.panel) return;
    const panel = this.panel.nativeElement;
    this.dragging = true;
    this.dragOriginY = event.clientY;
    this.dragOriginHeight = panel.getBoundingClientRect().height;
    if (this.collapsedHeight === 0) this.collapsedHeight = this.dragOriginHeight;
    const viewportHeight = this.document.defaultView?.visualViewport?.height
      ?? this.document.defaultView?.innerHeight
      ?? this.dragOriginHeight;
    this.maximumHeight = Math.max(this.dragOriginHeight, viewportHeight - 8);
    panel.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  dragMove(event: PointerEvent) {
    if (!this.dragging) return;
    const minimum = this.collapsedHeight || this.dragOriginHeight;
    this.height = Math.min(
      this.maximumHeight,
      Math.max(minimum, this.dragOriginHeight + this.dragOriginY - event.clientY),
    );
  }
  dragEnd(event: PointerEvent) {
    if (!this.dragging) return;
    this.dragging = false;
    const panel = this.panel?.nativeElement;
    if (panel?.hasPointerCapture(event.pointerId)) panel.releasePointerCapture(event.pointerId);
    const minimum = this.collapsedHeight || this.dragOriginHeight;
    this.height = Math.max(minimum, Math.min(this.maximumHeight, this.height ?? this.dragOriginHeight));
    this.expanded = this.height > minimum + 1;
  }
  @HostListener('document:pointermove', ['$event']) documentDragMove(event: PointerEvent) {
    this.dragMove(event);
  }
  @HostListener('document:pointerup', ['$event']) documentDragEnd(event: PointerEvent) {
    this.dragEnd(event);
  }
  @HostListener('document:pointercancel', ['$event']) documentDragCancel(event: PointerEvent) {
    this.dragEnd(event);
  }
}

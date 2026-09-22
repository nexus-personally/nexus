import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideRotateCcw, LucideX } from '@lucide/angular';
import type { ResumeRecord, ResumeTypography } from '@nexus/shared';

@Component({
  selector: 'nexus-typography-panel',
  standalone: true,
  imports: [FormsModule, LucideRotateCcw, LucideX],
  template: `
    <section aria-label="Typography" class="typography-panel" [class.embedded]="embedded">
      <header>
        <div>
          <span>APPEARANCE</span>
          <h2>Typography</h2>
        </div>
        <button type="button" aria-label="Close typography" (click)="closed.emit()">
          <svg lucideX size="18"></svg>
        </button>
      </header>
      <div class="scope" role="group" aria-label="Formatting scope">
        <button
          type="button"
          [class.active]="!fieldScope"
          [attr.aria-pressed]="!fieldScope"
          (click)="fieldScope = false"
        >
          Whole resume
        </button>
        <button
          type="button"
          [class.active]="fieldScope"
          [attr.aria-pressed]="fieldScope"
          [disabled]="!selection"
          (click)="fieldScope = true"
        >
          Selected field
        </button>
      </div>
      <p class="scope-hint">
        {{
          fieldScope
            ? selection?.label + ' · entire field'
            : 'Set a consistent style across your resume.'
        }}
      </p>
      <label class="control-label" for="resume-font-family">Font family</label>
      <select
        id="resume-font-family"
        [ngModel]="value.fontFamily ?? ''"
        (ngModelChange)="set('fontFamily', $event || undefined)"
      >
        <option value="">{{ fieldScope ? 'Use document font' : 'Template default' }}</option>
        <option value="Roboto, 'Helvetica Neue', sans-serif">Roboto</option>
        <option value="Arial, sans-serif">Arial</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="'Times New Roman', serif">Times New Roman</option>
        <option value="Verdana, sans-serif">Verdana</option>
      </select>
      <div class="control-heading">
        <label class="control-label" for="resume-font-size">{{
          fieldScope ? 'Font size' : 'Text size'
        }}</label>
        <div class="number-input">
          <input
            id="resume-font-size"
            (ngModelChange)="setSize($event)"
            type="number"
            [min]="fieldScope ? 6 : 70"
            [max]="fieldScope ? 72 : 150"
            [step]="fieldScope ? 0.5 : 1"
            placeholder="Auto"
            [ngModel]="fieldScope ? (value.fontSize ?? null) : (value.fontScale ?? 1) * 100"
            (change)="setSize($any($event.target).value === '' ? null : +$any($event.target).value)"
          /><span>{{ fieldScope ? 'pt' : '%' }}</span>
        </div>
      </div>
      <input
        class="slider"
        type="range"
        [attr.aria-label]="fieldScope ? 'Font size slider' : 'Text size slider'"
        [min]="fieldScope ? 6 : 70"
        [max]="fieldScope ? 72 : 150"
        [step]="fieldScope ? 0.5 : 1"
        [ngModel]="fieldScope ? (value.fontSize ?? 12) : (value.fontScale ?? 1) * 100"
        (ngModelChange)="setSize($event)"
      />
      <div class="range-labels">
        <span>{{ fieldScope ? '6 pt' : 'Smaller' }}</span
        ><span>{{ fieldScope ? '72 pt' : 'Larger' }}</span>
      </div>
      <div class="control-heading">
        <label class="control-label" for="resume-letter-spacing">Letter spacing</label>
        <div class="number-input">
          <input
            id="resume-letter-spacing"
            (ngModelChange)="setSpacing($event)"
            type="number"
            min="-1"
            max="5"
            step="0.1"
            placeholder="Auto"
            [ngModel]="value.letterSpacing ?? null"
            (change)="
              setSpacing($any($event.target).value === '' ? null : +$any($event.target).value)
            "
          /><span>px</span>
        </div>
      </div>
      <input
        class="slider"
        type="range"
        aria-label="Letter spacing slider"
        min="-1"
        max="5"
        step="0.1"
        [ngModel]="effective.letterSpacing ?? 0"
        (ngModelChange)="setSpacing($event)"
      />
      <div class="range-labels"><span>Tighter</span><span>Wider</span></div>
      <div
        class="sample"
        [style.font-family]="effective.fontFamily"
        [style.font-weight]="effective.fontWeight"
        [style.font-style]="effective.fontStyle"
        [style.letter-spacing.px]="effective.letterSpacing"
      >
        <span>Aa</span>
        <p>Your next chapter.<small>Make every word count.</small></p>
      </div>
      <p class="help">
        {{
          fieldScope
            ? 'Formats this entire field. Reset to inherit document settings.'
            : 'Text size keeps headings and body text in proportion. Click text in the resume to format one field.'
        }}
      </p>
      <button type="button" class="reset" (click)="reset()">
        <svg lucideRotateCcw size="14"></svg
        >{{ fieldScope ? 'Reset selected field' : 'Reset document typography' }}
      </button>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        color: #243436;
        font-family: Roboto, 'Helvetica Neue', sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      .typography-panel {
        padding: 22px;
        background: #fff;
        border: 1px solid #dce6e5;
        border-radius: 16px;
        box-shadow: 0 16px 48px #183b3b24;
      }
      .typography-panel.embedded {
        padding: 18px 16px 24px;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      .typography-panel.embedded header {
        margin-bottom: 16px;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      header span {
        color: #71817f;
        font-size: 10px;
        letter-spacing: 1.4px;
        font-weight: 600;
      }
      h2 {
        font-size: 20px;
        margin: 5px 0 0;
        letter-spacing: -0.4px;
      }
      button,
      select,
      input {
        font: inherit;
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid transparent;
        cursor: pointer;
        color: inherit;
        background: transparent;
        min-height: 36px;
        border-radius: 8px;
      }
      button:hover {
        background: #f0f6f5;
      }
      button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      button:focus-visible,
      input:focus-visible,
      select:focus-visible {
        outline: 2px solid #267e83;
        outline-offset: 3px;
      }
      .scope {
        display: flex;
        background: #f1f5f4;
        padding: 4px;
        border-radius: 10px;
      }
      .scope button {
        flex: 1;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      .scope .active {
        background: #fff;
        box-shadow: 0 1px 4px #183b3b18;
        color: #246f73;
      }
      .scope-hint {
        font-size: 12px;
        color: #6b7b78;
        margin: 12px 0 22px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
      .control-label {
        display: block;
        font-size: 12px;
        font-weight: 600;
      }
      select {
        width: 100%;
        min-height: 40px;
        border: 1px solid #dbe4e2;
        border-radius: 8px;
        padding: 0 10px;
        background: #fff;
        color: #243436;
        font-size: 13px;
        margin-top: 8px;
      }
      .control-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 22px 0 10px;
      }
      .number-input {
        display: flex;
        align-items: center;
        border: 1px solid #dbe4e2;
        border-radius: 8px;
        padding-right: 9px;
        width: 92px;
        height: 34px;
      }
      .number-input input {
        width: 64px;
        min-width: 0;
        border: 0;
        background: transparent;
        padding: 6px 4px 6px 10px;
        font-size: 12px;
        color: inherit;
      }
      .number-input span,
      .range-labels {
        color: #73817f;
        font-size: 10px;
      }
      .slider {
        width: 100%;
        height: 20px;
        accent-color: #267e83;
        cursor: pointer;
        margin: 0;
      }
      .range-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 2px;
      }
      .sample {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        margin-top: 22px;
        background: #f4f8f7;
        border-radius: 10px;
        overflow-wrap: anywhere;
      }
      .sample > span {
        font-size: 34px;
      }
      .sample p {
        font-size: 13px;
        margin: 0;
      }
      .sample small {
        display: block;
        font-size: 10px;
        margin-top: 6px;
        color: #6d7c79;
      }
      .help {
        font-size: 11px;
        line-height: 1.6;
        color: #73817f;
        margin: 14px 0;
      }
      .reset {
        border-top: 1px solid #e8eeec;
        border-radius: 0;
        width: 100%;
        padding-top: 12px;
        color: #4f6e6b;
        font-size: 12px;
      }
    `,
  ],
})
export class TypographyPanelComponent {
  @Input() embedded = false;
  @Input({ required: true }) resume!: ResumeRecord;
  @Input() selection?: { key: string; label: string; textSelected?: boolean };
  @Output() changed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  protected fieldScope = false;

  protected get value(): ResumeTypography {
    return this.fieldScope && this.selection
      ? (this.resume.fieldTypography?.[this.selection.key] ?? {})
      : (this.resume.typography ?? {});
  }

  protected get effective(): ResumeTypography {
    return { ...this.resume.typography, ...this.value };
  }

  protected set<K extends keyof ResumeTypography>(key: K, value: ResumeTypography[K]) {
    const next = { ...this.value };
    if (value === undefined) delete next[key];
    else next[key] = value;
    this.apply(next);
  }

  protected setSize(value: number | null) {
    if (value == null) {
      this.set(this.fieldScope ? 'fontSize' : 'fontScale', undefined);
    } else if (Number.isFinite(+value)) {
      if (+value < (this.fieldScope ? 6 : 70) || +value > (this.fieldScope ? 72 : 150)) return;
      this.fieldScope
        ? this.set('fontSize', Math.round(Math.min(72, Math.max(6, +value)) * 2) / 2)
        : this.set('fontScale', Math.min(150, Math.max(70, +value)) / 100);
    }
  }

  protected setSpacing(value: number | null) {
    if (value == null) this.set('letterSpacing', undefined);
    else if (Number.isFinite(+value))
      this.set('letterSpacing', Math.round(Math.min(5, Math.max(-1, +value)) * 10) / 10);
  }

  protected reset() {
    this.apply({});
  }

  private apply(value: ResumeTypography) {
    if (this.fieldScope && this.selection) {
      this.resume.fieldTypography = { ...this.resume.fieldTypography, [this.selection.key]: value };
    } else this.resume.typography = value;
    this.changed.emit();
  }
}

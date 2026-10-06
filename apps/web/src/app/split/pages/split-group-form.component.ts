import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideChevronRight } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { SplitApiService } from '../data-access/split-api.service';
import { SplitAuthService } from '../auth/data-access/split-auth.service';
import { SplitGroupsStore } from '../data-access/split-groups.store';
import {
  splitCurrencies,
  splitTypes,
  validateGroupDraft,
  type SplitCurrency,
  type SplitGroupInput,
  type SplitGroupType,
} from '../data-access/split.models';
import { SplitBottomSheetComponent } from '../ui/split-bottom-sheet.component';
@Component({
  selector: 'nexus-split-group-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideArrowLeft,
    LucideChevronRight,
    SplitBottomSheetComponent,
  ],
  template: `<main class="split-page">
      <div class="split-wrap">
        <header class="split-top">
          <a class="back" [routerLink]="back"><svg lucideArrowLeft></svg></a
          ><strong>{{ editing ? 'Group Settings' : 'Create Group' }}</strong
          ><span></span>
        </header>
        <form class="form" (ngSubmit)="submit()">
          <label class="field"
            >Group name<input
              name="name"
              [(ngModel)]="draft.name"
              maxlength="100"
              (blur)="validate()"
            />
            @if (errors['name']) {
              <small class="error-text">{{ errors['name'] }}</small>
            }</label
          ><label class="field"
            >Group type<button type="button" class="field-button" (click)="sheet = 'type'">
              {{ typeLabel }}<svg lucideChevronRight></svg></button></label
          ><label class="field"
            >Base currency<button type="button" class="field-button" (click)="sheet = 'currency'">
              {{ draft.baseCurrency }} — {{ currencyLabel
              }}<svg lucideChevronRight></svg></button></label
          ><label class="field"
            >Start date <small>Optional</small
            ><input
              name="start"
              type="date"
              [(ngModel)]="draft.startDate"
              (change)="validate()" /></label
          ><label class="field"
            >End date <small>Optional</small
            ><input name="end" type="date" [(ngModel)]="draft.endDate" (change)="validate()" />
            @if (errors['endDate']) {
              <small class="error-text">{{ errors['endDate'] }}</small>
            }
          </label>
          @if (editing) {
            <label class="switch"
              ><input type="checkbox" name="simplify" [(ngModel)]="draft.simplifyDebts" /> Simplify
              debts</label
            >
          }
          @if (error) {
            <p class="error-text" role="alert">{{ error }}</p>
          }
          <div class="sticky-action">
            <button class="primary full" [disabled]="busy">
              {{ busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Group' }}
            </button>
          </div>
        </form>
      </div>
    </main>
    @if (sheet) {
      <nexus-split-bottom-sheet
        [label]="sheet === 'type' ? 'Choose group type' : 'Choose currency'"
        (closed)="sheet = null"
        ><h2>{{ sheet === 'type' ? 'Group type' : 'Base currency' }}</h2>
        @if (sheet === 'type') {
          @for (item of types; track item[0]) {
            <button class="sheet-option" (click)="chooseType(item[0])">{{ item[1] }}</button>
          }
        } @else {
          @for (item of currencies; track item[0]) {
            <button class="sheet-option" (click)="chooseCurrency(item[0])">
              <b>{{ item[0] }}</b> — {{ item[1] }}
            </button>
          }
        }
      </nexus-split-bottom-sheet>
    }`,
  styleUrls: ['../ui/split-ui.scss'],
})
export class SplitGroupFormComponent implements OnInit {
  private api = inject(SplitApiService);
  private auth = inject(SplitAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private store = inject(SplitGroupsStore);
  readonly types = splitTypes;
  readonly currencies = splitCurrencies;
  editing = false;
  groupId = '';
  back = '/split/groups';
  sheet: null | 'type' | 'currency' = null;
  busy = false;
  error = '';
  errors: Record<string, string> = {};
  draft: SplitGroupInput = {
    name: '',
    type: 'travel',
    baseCurrency: 'MYR',
    startDate: null,
    endDate: null,
    simplifyDebts: true,
  };
  get typeLabel() {
    return this.types.find((x) => x[0] === this.draft.type)?.[1];
  }
  get currencyLabel() {
    return this.currencies.find((x) => x[0] === this.draft.baseCurrency)?.[1];
  }
  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    this.editing = !!this.groupId;
    this.back = this.editing ? `/split/groups/${this.groupId}` : '/split/groups';
    if (this.editing)
      try {
        const [g, members] = await Promise.all([
          firstValueFrom(this.api.group(this.groupId)),
          firstValueFrom(this.api.members(this.groupId)),
        ]);
        const role = members.find((member) => member.userId === this.auth.currentUser()?.id)?.role;
        if (role !== 'owner') {
          await this.router.navigateByUrl(`/split/groups/${this.groupId}`);
          return;
        }
        this.draft = {
          name: g.name,
          type: g.type,
          baseCurrency: g.baseCurrency,
          startDate: g.startDate,
          endDate: g.endDate,
          simplifyDebts: g.simplifyDebts,
        };
      } catch {
        this.error = 'Unable to load group settings.';
      }
  }
  validate() {
    this.errors = validateGroupDraft(this.draft);
    return !Object.keys(this.errors).length;
  }
  chooseType(v: SplitGroupType) {
    this.draft.type = v;
    this.sheet = null;
  }
  chooseCurrency(v: SplitCurrency) {
    this.draft.baseCurrency = v;
    this.sheet = null;
  }
  async submit() {
    if (this.busy || !this.validate()) return;
    this.busy = true;
    this.error = '';
    try {
      const g = await firstValueFrom(
        this.editing
          ? this.api.updateGroup(this.groupId, this.draft)
          : this.api.createGroup({ ...this.draft, name: this.draft.name.trim() }),
      );
      this.store.invalidate();
      await this.router.navigateByUrl(`/split/groups/${g.id}`);
    } catch (e) {
      this.error =
        e instanceof HttpErrorResponse
          ? (e.error?.error?.message ?? 'Unable to save group.')
          : 'Unable to save group.';
    } finally {
      this.busy = false;
    }
  }
}

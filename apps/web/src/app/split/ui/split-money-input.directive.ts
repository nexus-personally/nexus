import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

@Directive({
  selector: 'input[splitMoneyInput]',
  standalone: true,
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
  },
})
export class SplitMoneyInputDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private redispatching = false;

  @Input() splitMoneyInput: number | string = 2;

  @HostListener('input')
  sanitize() {
    if (this.redispatching) return;
    const input = this.element.nativeElement;
    const decimals =
      this.splitMoneyInput === '' ? 2 : Math.max(0, Number(this.splitMoneyInput) || 0);
    const original = input.value;
    let cleaned = original.replace(/[^\d.]/g, '');

    if (decimals === 0) {
      cleaned = cleaned.replace(/\./g, '');
    } else {
      const dot = cleaned.indexOf('.');
      if (dot >= 0) {
        cleaned =
          cleaned.slice(0, dot + 1) +
          cleaned
            .slice(dot + 1)
            .replace(/\./g, '')
            .slice(0, decimals);
      }
    }

    if (cleaned === original) return;
    input.value = cleaned;
    this.redispatching = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this.redispatching = false;
  }
}

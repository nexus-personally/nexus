import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'splitDate', standalone: true })
export class SplitDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: 'date' | 'datetime' = 'date') {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(
      'zh-CN',
      format === 'datetime'
        ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'long', day: 'numeric' },
    ).format(date);
  }
}

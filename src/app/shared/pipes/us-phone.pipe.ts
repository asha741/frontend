import { Pipe, PipeTransform } from '@angular/core';

/** Formats a 10-digit value as a US phone number: `(123) 456-7890`. */
@Pipe({ name: 'usPhone', standalone: true })
export class UsPhonePipe implements PipeTransform {
  /**
   * @param value phone value in any format (or nullish)
   * @returns `(123) 456-7890` formatted string; falls back to the original
   *   value unmodified if it doesn't contain exactly 10 digits
   */
  transform(value: string | number | null | undefined): string {
    if (!value) return '';
    // Strip everything but digits so callers can pass in dashes/parens/spaces already.
    const digits = value.toString().replace(/\D/g, '');
    if (digits.length !== 10) return value.toString();
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
  }
}

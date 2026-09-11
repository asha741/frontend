import { Injectable } from '@angular/core';
import { NgbDateParserFormatter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

/** App-wide: displays/parses every ngbDatepicker input as MM-DD-YYYY instead of the default ISO format. */
@Injectable()
export class NgbDateMMDDYYYYParserFormatter extends NgbDateParserFormatter {
  /**
   * Parses a "MM-DD-YYYY" string typed into a datepicker input into an
   * `NgbDateStruct`.
   * @returns `null` if the value is empty, malformed, or missing a segment.
   */
  parse(value: string): NgbDateStruct | null {
    if (!value) return null;
    const parts = value.trim().split('-');
    if (parts.length !== 3) return null;
    const [month, day, year] = parts.map((p) => parseInt(p, 10));
    if (!month || !day || !year) return null;
    return { year, month, day };
  }

  /** Formats an `NgbDateStruct` as "MM-DD-YYYY" for display in the datepicker input. */
  format(date: NgbDateStruct | null): string {
    if (!date) return '';
    const mm = String(date.month).padStart(2, '0');
    const dd = String(date.day).padStart(2, '0');
    return `${mm}-${dd}-${date.year}`;
  }
}

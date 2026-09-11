import { Injectable } from '@angular/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { mapOperatorToEnum } from '../utils/filter.enum';

dayjs.extend(utc);

export interface SortDescriptor {
  Field: string;
  /** 0 = ascending, 1 = descending (matches backend). */
  Direction: number;
}

export interface FilterDescriptor {
  Field: string;
  OperatorType: number | undefined;
  Value: unknown;
}

export interface RequestPayload {
  Sorts: SortDescriptor[] | null;
  Filters?: FilterDescriptor[] | null;
  [key: string]: unknown;
}

/**
 * Translates a Kendo Grid `DataStateChangeEvent` state (sort + composite filter)
 * into the backend's PascalCase `{ Sorts, Filters }` request payload.
 * Ported from the reference app's FilterAndSortingService.
 */
@Injectable({ providedIn: 'root' })
export class FilterAndSortingService {
  /** Fields that should be serialized as `MM/DD/YYYY` UTC dates. Extend as needed. */
  private readonly dateFields = ['OrderDate', 'CreatedDate'];

  /**
   * Converts a Kendo `DataStateChangeEvent`-like `state` (grid sort + filter)
   * into the PascalCase payload the backend list endpoints expect.
   *
   * @param state Kendo grid state; only `sort` and `filter.filters` are read.
   * @returns `{ Sorts, Filters }`, ready to send as the request body.
   */
  prepareRequestPayload(state: any): RequestPayload {
    const payload: RequestPayload = { Sorts: null };

    if (state?.sort) {
      // Kendo emits a sort entry with `dir` undefined when a column's sort is
      // cleared — drop those rather than sending a directionless sort.
      payload.Sorts = state.sort
        .filter((s: any) => s?.dir)
        .map((s: any) => ({ Field: s.field, Direction: s.dir === 'asc' ? 0 : 1 }));
    }

    const rawFilters: any[] = state?.filter?.filters ?? [];
    if (rawFilters.length) {
      // Kendo's composite filter nests each condition inside its own
      // single-item group ({ filters: [...] } of { filters: [cond] }); this
      // grid setup only ever produces one condition per group, so flatten to it.
      const flat = rawFilters.map((item: any) => item?.filters?.[0]).filter(Boolean);
      payload.Filters = flat.map((el: any) => {
        let value = el.value;
        if (this.dateFields.includes(el.field)) {
          // Backend expects date filters as UTC MM/DD/YYYY strings.
          value = dayjs(el.value).utc().format('MM/DD/YYYY');
        } else if (el.field === 'Status' && typeof el.value === 'boolean') {
          // Status is stored as 0/1 server-side but filtered as a boolean in the UI.
          value = el.value ? 1 : 0;
        }
        return { Field: el.field, OperatorType: mapOperatorToEnum(el.operator), Value: value };
      });
    }

    return payload;
  }
}

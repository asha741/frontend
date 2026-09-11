// import { DatePipe } from '@angular/common';
import { Injectable } from '@angular/core';
import { CompositeFilterDescriptor, FilterDescriptor, State } from '@progress/kendo-data-query';
import { mapOperatorToEnum } from '../utils/filter.enum';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

/** Options for {@link FilterAndSortingService.buildQueryParams}. */
export interface BuildQueryParamsOptions {
  /**
   * Extra params merged in last — top-bar search box, date pickers, standalone
   * dropdowns. These WIN over anything derived from the grid state (and an
   * empty value here deletes a derived key).
   */
  extra?: Record<string, any>;
  /**
   * Per-field value transform applied to a column filter's raw value before it
   * is emitted, e.g. `{ status: v => (v ? 'Active' : 'Inactive') }`.
   */
  valueMap?: Record<string, (value: any) => any>;
  /**
   * Rename a Kendo column `field` to a different backend param name,
   * e.g. `{ created_at: 'created_date' }` → emits `created_date_from/_to`.
   */
  fieldMap?: Record<string, string>;
  /**
   * Emit the active sort as `sort_by` + `order`. Default `true`; endpoints
   * without sort support simply ignore the extra params.
   */
  includeSort?: boolean;
}

/**
 * Translates Kendo Grid state (paging/sorting/filtering) into the request
 * shape each backend expects — flat query params for the FastAPI-style
 * endpoints ({@link buildQueryParams}/{@link buildQueryString}), or a legacy
 * `{ Sorts, Filters }` POST body for older endpoints ({@link prepareRequestPayload}).
 */
@Injectable({
  providedIn: 'root',
})
export class FilterAndSortingService {
  // Enum mapping for operators
  mapOperatorToEnum: any = mapOperatorToEnum;

  // constructor(private datePipe: DatePipe) {}

  /**
   * ONE global, reusable translator between a Kendo Grid `State` and the flat
   * query-param object every FastAPI list endpoint expects (users,
   * organizations, roles, …). Feed it the grid state plus any top-bar controls
   * and hand the result to {@link toQueryString} for a GET request.
   *
   *   { page, limit, search?, <select filters>, <field>_from / <field>_to, sort_by?, order? }
   *
   * - Pagination: `skip`/`take` → `page` (1-based) + `limit`.
   * - Sorting:    first active sort → `sort_by` + `order` (`'asc' | 'desc'`).
   * - Filters:    the Kendo composite tree is flattened; range operators become
   *               `<field>_from` (gt/gte/after) / `<field>_to` (lt/lte/before),
   *               everything else maps to `<field>` directly.
   * - Dates:      `Date` values are serialised to ISO 8601.
   * - `extra`:    merged last and wins (search box, date pickers, dropdowns).
   * - Empty values (`null` / `undefined` / `''`) are dropped so only meaningful
   *   params are sent (`false` and `0` are kept).
   *
   * @example
   *   const qs = filterSort.buildQueryString(state, {
   *     extra: { search: term, created_date_from, created_date_to },
   *     valueMap: { status: v => (v ? 'Active' : 'Inactive') },
   *     fieldMap: { created_at: 'created_date' },
   *   });
   *   await api.request('GET', API_ROUTES.GET_USERS + qs);
   */
  buildQueryParams(state?: State | null, options: BuildQueryParamsOptions = {}): Record<string, any> {
    const { extra = {}, valueMap = {}, fieldMap = {}, includeSort = true } = options;
    const params: Record<string, any> = {};

    // ── Pagination ─────────────────────────────────────────────
    const take = state?.take && state.take > 0 ? state.take : 10;
    const skip = state?.skip ?? 0;
    params['page'] = Math.floor(skip / take) + 1;
    params['limit'] = take;

    // ── Sorting → sort_by / order ──────────────────────────────
    if (includeSort) {
      const active = (state?.sort ?? []).find((s) => s.dir);
      if (active) {
        params['sort_by'] = fieldMap[active.field] ?? active.field;
        params['order'] = active.dir; // 'asc' | 'desc'
      }
    }

    // ── Column filters → select / date-range params ────────────
    for (const leaf of this.flattenFilters(state?.filter)) {
      const rawField = leaf.field as string;
      if (!rawField) continue;

      const transform = valueMap[rawField];
      const value = this.normalizeValue(transform ? transform(leaf.value) : leaf.value);
      if (this.isEmpty(value)) continue;

      const field = fieldMap[rawField] ?? rawField;
      const op = String(leaf.operator ?? '').toLowerCase();

      if (this.isLowerBoundOperator(op)) {
        params[`${field}_from`] = value;
      } else if (this.isUpperBoundOperator(op)) {
        params[`${field}_to`] = value;
      } else {
        params[field] = value;
      }
    }

    // ── Extras win over everything derived above ───────────────
    for (const [key, value] of Object.entries(extra)) {
      if (this.isEmpty(value)) {
        delete params[key];
        continue;
      }
      params[key] = this.normalizeValue(value);
    }

    return params;
  }

  /** Serialise a flat params object into a `?a=1&b=2` query string (`''` when empty). */
  toQueryString(params: Record<string, any>): string {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (this.isEmpty(value)) continue;
      usp.append(key, String(value));
    }
    const qs = usp.toString();
    return qs ? `?${qs}` : '';
  }

  /** Convenience: Kendo state (+ options) straight to a `?…` query string. */
  buildQueryString(state?: State | null, options: BuildQueryParamsOptions = {}): string {
    return this.toQueryString(this.buildQueryParams(state, options));
  }

    /**
   * Same flat, backend-ready params as {@link buildQueryParams}, returned as a
   * plain **object** so it can be sent as a JSON request **body** (POST) instead
   * of a `?query` string. Shape:
   *
   *   { page, limit, search?, <select filters>, <field>_from / <field>_to, sort_by?, order? }
   *
   * @example
   *   const body = filterSort.buildRequestBody(state, {
   *     extra: { search: term, created_date_from, created_date_to },
   *     valueMap: { status: v => (v ? 'Active' : 'Inactive') },
   *   });
   *   await api.request('POST', API_ROUTES.GET_USERS, body);
   */
  buildRequestBody(state?: State | null, options: BuildQueryParamsOptions = {}): Record<string, any> {
    return this.buildQueryParams(state, options);
  }

  /** Recursively flatten a Kendo composite filter tree into its leaf descriptors. */
  flattenFilters(filter?: CompositeFilterDescriptor): FilterDescriptor[] {
    if (!filter?.filters?.length) return [];
    const leaves: FilterDescriptor[] = [];
    for (const entry of filter.filters) {
      if ((entry as CompositeFilterDescriptor).filters) {
        leaves.push(...this.flattenFilters(entry as CompositeFilterDescriptor));
      } else {
        leaves.push(entry as FilterDescriptor);
      }
    }
    return leaves;
  }

  /** Operators that should be emitted as a `<field>_from` range bound. */
  private isLowerBoundOperator(op: string): boolean {
    return ['gt', 'gte', 'after', 'aftereq', 'isgreaterthan', 'isgreaterthanorequalto'].includes(op);
  }

  /** Operators that should be emitted as a `<field>_to` range bound. */
  private isUpperBoundOperator(op: string): boolean {
    return ['lt', 'lte', 'before', 'beforeeq', 'islessthan', 'islessthanorequalto'].includes(op);
  }

  private normalizeValue(value: any): any {
    return value instanceof Date ? value.toISOString() : value;
  }

  private isEmpty(value: any): boolean {
    return value === null || value === undefined || value === '';
  }

  /**
   * Legacy counterpart to {@link buildQueryParams}: converts Kendo grid
   * `state` into the older `{ Sorts, Filters }` POST-body shape (PascalCase
   * fields, numeric sort direction, numeric operator enum) some endpoints
   * still expect.
   */
  prepareRequestPayload(state: any): any {
    // Initialize an empty request payload object
    const requestPayload: any = {};

    // Check if sorting information is provided in the state
    if (state.sort) {
      // Map the sorting information to the request payload
      requestPayload.Sorts = state.sort
        ? state.sort
            .filter((sortElement: any) => sortElement.dir)
            .map((sortElement: any) => ({
              Field: sortElement.field,
              Direction: sortElement.dir === 'asc' ? 0 : 1,
            }))
        : null;
    } else {
      // If no sorting information is present, set Sorts to null
      requestPayload.Sorts = null;
    }

    // Check if filtering information is provided in the state
    if (state.filter) {
      // Extract the filters from the state
      const filters = state.filter.filters.map((items: any) => items.filters[0]);

      // Check if there are filters to include in the request payload
      if (filters.length > 0) {
        // Map the filters to the request payload
        var filterArr: any = [];
        filters.forEach((element: any) => {
          if (element.field == 'OrderDate' || element.field == 'CreatedDate') {
            // Date fields: normalize to UTC and format as MM/DD/YYYY for the legacy API.
            dayjs.extend(utc);
            filterArr.push({
              Field: element.field,
              OperatorType: this.mapOperatorToEnum(element.operator),
              Value: dayjs(element.value).utc().format('MM/DD/YYYY'),
            });
          } else if (element.field == 'Status') {
            // Status may arrive as a boolean toggle (map to 1/0) or an already-resolved value.
            if (typeof element.value === 'boolean') {
              filterArr.push({
                Field: element.field,
                OperatorType: this.mapOperatorToEnum(element.operator),
                Value: element.value ? 1 : 0,
              });
            } else {
              filterArr.push({
                Field: element.field,
                OperatorType: this.mapOperatorToEnum(element.operator),
                Value: element.value,
              });
            }
          } else {
            filterArr.push({
              Field: element.field,
              OperatorType: this.mapOperatorToEnum(element.operator),
              Value: element.value,
            });
          }
        });
        requestPayload.Filters = filterArr;
      } else {
        // If no filters are present, set Filters to null
        requestPayload.Filters = null;
      }
    }

    // Return the final request payload
    return requestPayload;
  }
}

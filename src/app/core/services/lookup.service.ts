import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

/** Normalised option shape every lookup endpoint is mapped onto. */
export interface LookupOption {
  value: string;
  label: string;
}

/** Wait this long after the last keystroke before hitting the server. */
export const LOOKUP_DEBOUNCE_MS = 300;

/** Nothing is requested until the user has typed at least this many characters. */
export const LOOKUP_MIN_CHARS = 3;

/** Per-field wiring for endpoints that serve more than one list. */
export interface LookupSearchOptions {
  /** Body key the term is sent under. Default `search`. */
  searchKey?: string;
  /** Response key holding this field's array. Default: auto-detect. */
  resultKey?: string;
  /** Extra fields merged into the request body. */
  extra?: Record<string, unknown>;
}

/**
 * Server-side searchable dropdowns.
 *
 * The lookup/dropdown endpoints are POST-reads that take the typed term in the
 * body (`{ search }`) and return only the matching rows — they are never called
 * with an empty term, so no list is preloaded on page init.
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  constructor(public api: ApiService) {}

  /**
   * POSTs `{ [searchKey]: search, ...extra }` to a lookup endpoint and
   * normalises the response onto `{ value, label }`. Silent: no toaster, no
   * global loader — the field renders its own spinner.
   *
   * `searchKey` / `resultKey` cover endpoints that serve more than one list.
   * The audit-log filters endpoint, for example, takes
   * `{ module_search, action_search, user_search }` and answers with
   * `{ modules, actions, users }`, so each field names its own pair.
   */
  async search(endpoint: string, search: string, options: LookupSearchOptions = {}): Promise<LookupOption[]> {
    const { searchKey = 'search', resultKey = '', extra = {} } = options;
    const res = await this.api.request(
      'POST',
      endpoint,
      { [searchKey]: search, ...extra },
      { showToaster: false, showLoader: false },
    );
    if (!res?.status) return [];
    return this.toOptions(this.extractList(res.data, resultKey));
  }

  /**
   * Pulls the array out of a lookup response. `resultKey` names it outright for
   * multi-list endpoints; otherwise the usual wrappers are tried in turn.
   */
  private extractList(data: any, resultKey = ''): any[] {
    if (resultKey) return Array.isArray(data?.[resultKey]) ? data[resultKey] : [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.options)) return data.options;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  /**
   * Normalise a list of strings / objects into `{ value, label }` options.
   * Rows the endpoint explicitly marks inactive are dropped — a lookup feeds a
   * picker, and picking a disabled record is never valid.
   */
  private toOptions(arr: any[]): LookupOption[] {
    return arr
      .filter(
        (o) =>
          !(o !== null && typeof o === 'object') ||
          (o.is_active !== false && String(o.status ?? '').toLowerCase() !== 'inactive'),
      )
      .map((o) => {
        if (o !== null && typeof o === 'object') {
          const value = o.id ?? o.org_id ?? o.value ?? o.key ?? o.uuid ?? '';
          const label =
            o.name ??
            o.full_name ??
            o.label ??
            o.text ??
            [o.first_name, o.last_name].filter(Boolean).join(' ') ??
            String(value);
          return { value: String(value), label: String(label || value) };
        }
        return { value: String(o), label: String(o) };
      });
  }
}

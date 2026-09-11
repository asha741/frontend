import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { KENDO_AUTOCOMPLETE, KENDO_DROPDOWNLIST } from '@progress/kendo-angular-dropdowns';
import { FormsModule } from '@angular/forms';

import { FilterService } from '@progress/kendo-angular-grid';
import { FilterDescriptor } from '@progress/kendo-data-query';
import {
  LOOKUP_DEBOUNCE_MS,
  LOOKUP_MIN_CHARS,
  LookupOption,
  LookupService,
} from './lookup.service';

@Component({
  selector: 'dropdownlist-filter',
  imports: [KENDO_DROPDOWNLIST, KENDO_AUTOCOMPLETE, FormsModule],
  template: `
    @if (endpoint) {
      <!-- Server-searched: type-ahead against a POST lookup, nothing preloaded. -->
      <kendo-autocomplete
        [data]="serverData()"
        valueField="label"
        [value]="text"
        [placeholder]="placeholder"
        [filterable]="true"
        [loading]="loading()"
        [clearButton]="true"
        [suggest]="false"
        (filterChange)="onFilterChange($event)"
        (valueChange)="onTextChange($event)"
      >
        <ng-template kendoAutoCompleteNoDataTemplate>
          <div class="ma-lookup-hint">{{ emptyMessage }}</div>
        </ng-template>
      </kendo-autocomplete>
    } @else {
      <kendo-dropdownlist
        [data]="data"
        [textField]="textField"
        [valueField]="valueField"
        [valuePrimitive]="isPrimitive"
        [(ngModel)]="value"
        (ngModelChange)="onValueChange($event)"
      >
      </kendo-dropdownlist>
    }
  `,
  styles: [
    `
      .ma-lookup-hint {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        color: #64748b;
        text-align: center;
      }
    `,
  ],
})
/**
 * Kendo Grid column filter cell for dropdown-style columns.
 *
 * Renders either a plain dropdown over a static `data` array, or (when an
 * `endpoint` is supplied) a server-searched autocomplete backed by
 * {@link LookupService}, so large/dynamic option sets don't need to be
 * preloaded into every grid.
 */
export class CustomDropDownListFilterComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(public lookup: LookupService) {}

  @Input() public isPrimitive!: boolean;
  @Input() public currentFilter: any;
  @Input() public data: any;
  @Input() public textField: any;
  @Input() public valueField: any;
  @Input() public filterService!: FilterService;
  @Input() public field!: string;

  /**
   * Server-side mode. With an `endpoint` the cell renders an autocomplete that
   * searches that POST lookup as the user types (debounced, min-characters
   * gated); without one it stays the plain dropdown over the static `data`.
   */
  @Input() public endpoint = '';
  @Input() public placeholder = 'Search';
  /**
   * What the column is filtered by: the option's id (default) or its label —
   * some grids filter by name (e.g. the users grid's `role` column).
   */
  @Input() public valueAs: 'value' | 'label' = 'value';
  @Input() public minChars = LOOKUP_MIN_CHARS;
  @Input() public debounceMs = LOOKUP_DEBOUNCE_MS;
  /**
   * The option currently applied to this column. Kept by the parent so the
   * chosen label still shows after the grid re-creates this filter cell.
   */
  @Input() public selectedOption: LookupOption | null = null;

  @Output() public valueChange = new EventEmitter<number[]>();
  @Output() public optionSelected = new EventEmitter<LookupOption | null>();

  readonly serverData = signal<LookupOption[]>([]);
  readonly loading = signal(false);
  readonly term = signal('');

  /** Text shown in the autocomplete input (server mode). */
  public text = '';
  public currentData: any;
  public showFilter = true;
  public value!: number;

  private timer: any = null;
  private requestId = 0;

  /** What the popup says while it has nothing to list. */
  get emptyMessage(): string {
    if (this.loading()) return 'Searching…';
    if (this.term().trim().length < this.minChars) {
      return `Type at least ${this.minChars} characters to search.`;
    }
    return 'No results found.';
  }

  public ngOnInit(): void {
    // Re-opening the filter menu shows the option that is currently applied.
    if (this.endpoint && this.selectedOption) {
      this.serverData.set([this.selectedOption]);
      this.text = this.selectedOption.label;
    }
  }

  /** Every keystroke: debounce, then search once past the character threshold. */
  public onFilterChange(term: string): void {
    const text = (term ?? '').trim();
    this.term.set(text);
    if (this.timer) clearTimeout(this.timer);

    if (text.length < this.minChars) {
      this.loading.set(false);
      this.serverData.set([]);
      return;
    }

    this.loading.set(true);
    this.timer = setTimeout(async () => {
      const id = ++this.requestId;
      const options = await this.lookup.search(this.endpoint, text);
      if (id !== this.requestId) return; // a newer keystroke already won
      this.serverData.set(options);
      this.loading.set(false);
    }, this.debounceMs);
  }

  /**
   * Autocomplete text changed. The column filter is applied only for a real
   * suggestion; clearing the box clears the filter.
   */
  public onTextChange(text: string): void {
    this.text = text ?? '';
    const typed = this.text.trim().toLowerCase();
    const match = this.serverData().find((o) => o.label.toLowerCase() === typed) ?? null;

    if (!typed) {
      this.selectedOption = null;
      this.optionSelected.emit(null);
      this.filterService.filter({ filters: [], logic: 'and' });
      return;
    }
    if (!match) return; // still typing — don't filter on partial text

    this.selectedOption = match;
    this.optionSelected.emit(match);
    this.filterService.filter({
      filters: [
        {
          field: this.field,
          operator: 'eq',
          value: this.valueAs === 'label' ? match.label : match.value,
        },
      ],
      logic: 'and',
    });
  }

  /** Static-data mode (unchanged behaviour). */
  public onValueChange(value: number): void {
    this.filterService.filter({
      filters: [{ field: this.field, operator: 'eq', value: value }],
      logic: 'and',
    });
  }

  public ngAfterViewInit(): void {
    this.currentData = this.data;
    const currentColumnFilter: FilterDescriptor =
      this.currentFilter.filters.find(
        (filter: FilterDescriptor) => filter.field === this.field,
      );
    if (currentColumnFilter) {
      this.value = currentColumnFilter.value;
    }
  }

  public ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}

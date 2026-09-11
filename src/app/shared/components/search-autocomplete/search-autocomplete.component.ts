import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { KENDO_AUTOCOMPLETE } from '@progress/kendo-angular-dropdowns';
import { Subject, Subscription, debounceTime, distinctUntilChanged, from, map, of, switchMap } from 'rxjs';

import {
  LOOKUP_DEBOUNCE_MS,
  LOOKUP_MIN_CHARS,
  LookupOption,
  LookupService,
} from '../../../core/services/lookup.service';

/**
 * Server-side search autocomplete for reactive forms.
 *
 * The user types straight into the field; the term is debounced (300ms) and
 * only searched once it reaches `minChars` (3) — nothing is loaded on init.
 * The form control holds the picked option's **id**, while the input shows its
 * label; typing free text that matches no option clears the control, so a
 * `Validators.required` field stays invalid until a real suggestion is chosen.
 * Also acts as an `NG_VALIDATORS` — if the discarded text was non-empty (e.g.
 * a browser/extension autofilled the box with something that isn't a real
 * option), the control additionally gets an `invalidSelection` error so the
 * parent form can show a message distinct from "nothing chosen yet".
 */
@Component({
  selector: 'app-search-autocomplete',
  standalone: true,
  imports: [KENDO_AUTOCOMPLETE],
  templateUrl: './search-autocomplete.component.html',
  styleUrl: './search-autocomplete.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchAutocompleteComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SearchAutocompleteComponent),
      multi: true,
    },
  ],
})
export class SearchAutocompleteComponent implements ControlValueAccessor, Validator, OnInit, OnDestroy {
  constructor(public lookup: LookupService) {}

  /** POST lookup endpoint from `API_ROUTES` (e.g. `GET_PROVIDER_LOOKUP`). */
  @Input() endpoint = '';
  @Input() placeholder = 'Search';
  @Input() minChars = LOOKUP_MIN_CHARS;
  @Input() debounceMs = LOOKUP_DEBOUNCE_MS;
  @Input() maxlength = 100;
  /** Extra fields merged into the request body alongside the search term. */
  @Input() extraBody: Record<string, unknown> = {};
  /**
   * For endpoints that serve several lists: the body key the term is sent
   * under, and the response key holding this field's array (e.g. the audit-log
   * filters endpoint takes `user_search` and answers with `users`).
   */
  @Input() searchKey = 'search';
  @Input() resultKey = '';
  /** Draws the red invalid border — pass the form's own validation state. */
  @Input() invalid = false;
  /**
   * What the form control receives: the option's id (default) or its label —
   * some endpoints are keyed by name (e.g. the user form's `role_name`).
   */
  @Input() valueAs: 'value' | 'label' = 'value';

  /**
   * Seeds the text of an already-selected value (edit screens), so the field
   * shows the name without the user having to search for it first.
   */
  @Input() set selected(option: LookupOption | null) {
    this.selectedOption = option;
    this.text = option?.label ?? '';
  }

  @Output() optionSelected = new EventEmitter<LookupOption | null>();

  readonly options = signal<LookupOption[]>([]);
  readonly loading = signal(false);
  readonly term = signal('');

  /** Text shown in the input (the option's label). */
  text = '';
  isDisabled = false;
  selectedOption: LookupOption | null = null;
  /**
   * Set when typed/autofilled text got discarded at blur because it matched
   * no option (see `onBlur`) — lets the parent form show a message distinct
   * from "nothing chosen yet" via the `invalidSelection` validation error.
   */
  private invalidEntry = false;

  private readonly search$ = new Subject<string>();
  private sub?: Subscription;
  /** Last value handed to the control — guards against duplicate emissions. */
  private lastEmitted = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  /**
   * Caps what can be typed, like every other free-text input. Built once in
   * `ngOnInit` — a getter would hand Kendo a new object on every change
   * detection run and make it re-apply the attributes each time.
   */
  inputAttributes: Record<string, string> = {};

  /** What the popup says while it has nothing to list. */
  get emptyMessage(): string {
    if (this.loading()) return 'Searching…';
    if (this.term().trim().length < this.minChars) {
      return `Type at least ${this.minChars} characters to search.`;
    }
    return 'No results found.';
  }

  ngOnInit(): void {
    this.inputAttributes = { maxlength: String(this.maxlength) };

    this.sub = this.search$
      .pipe(
        map((term) => (term ?? '').trim()),
        debounceTime(this.debounceMs),
        distinctUntilChanged(),
        switchMap((term) => {
          // Under the threshold nothing is requested — the list stays empty.
          if (term.length < this.minChars) {
            this.loading.set(false);
            return of<LookupOption[]>([]);
          }
          this.loading.set(true);
          return from(
            this.lookup.search(this.endpoint, term, {
              searchKey: this.searchKey,
              resultKey: this.resultKey,
              extra: this.extraBody,
            }),
          );
        }),
      )
      .subscribe((options) => {
        this.options.set(options);
        this.loading.set(false);
        // The typed text may already be an exact hit (someone typed the whole
        // name), in which case it counts as a selection without a click.
        this.resolveTypedMatch();
      });
  }

  /** Adopts an exact text↔option hit that only became known once results landed. */
  private resolveTypedMatch(): void {
    if (this.selectedOption) return;
    const typed = this.text.trim().toLowerCase();
    if (!typed) return;
    const match = this.options().find((o) => o.label.toLowerCase() === typed);
    if (!match) return;
    this.selectedOption = match;
    this.emit(match);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Fires on every keystroke — feeds the debounced server search. */
  onFilterChange(term: string): void {
    this.invalidEntry = false;
    this.term.set(term ?? '');
    this.search$.next(term ?? '');
  }

  /**
   * Fires on typing and on picking a suggestion. The control only takes a value
   * when the text matches one of the returned options.
   */
  onValueChange(text: string): void {
    this.text = text ?? '';
    const match =
      this.options().find((o) => o.label.toLowerCase() === this.text.trim().toLowerCase()) ?? null;

    this.selectedOption = match;
    this.emit(match);
  }

  /**
   * Pushes a selection to the control — but only when it actually changed, so
   * typing through non-matching text doesn't fire a change per keystroke.
   */
  private emit(option: LookupOption | null): void {
    if (option) this.invalidEntry = false;
    const next = option ? (this.valueAs === 'label' ? option.label : option.value) : '';
    if (next === this.lastEmitted) return;
    this.lastEmitted = next;
    this.onChange(next);
    this.optionSelected.emit(option);
    this.onValidatorChange();
  }

  onBlur(): void {
    this.onTouched();
    // Free text that matched nothing is discarded so the field never shows a
    // name that isn't actually selected. Flag it as a rejected entry (rather
    // than just "empty") so the parent form can tell the user *why* — this is
    // also what happens when a browser/extension autofills the field with a
    // value that isn't a real role.
    if (!this.selectedOption && this.text) {
      this.invalidEntry = true;
      this.text = '';
      this.emit(null);
      // `emit` no-ops when the control's value hasn't actually changed (e.g.
      // it was already ''), which would otherwise skip re-validation and
      // leave the new `invalidSelection` error unreported.
      this.onValidatorChange();
    }
  }

  // ── Validator ───────────────────────────────────────────────────────
  validate(_control: AbstractControl): ValidationErrors | null {
    return this.invalidEntry ? { invalidSelection: true } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  // ── ControlValueAccessor ───────────────────────────────────────────
  writeValue(value: string | null): void {
    this.invalidEntry = false;
    this.lastEmitted = value ?? '';
    if (!value) {
      this.selectedOption = null;
      this.text = '';
      return;
    }
    if (this.valueAs === 'label') {
      // Name-keyed endpoints: the control already holds the display text.
      this.selectedOption = { value, label: value };
      this.text = value;
      return;
    }
    // Id-keyed: the label can only come from `selected` (edit screens).
    if (this.selectedOption?.value !== value) {
      this.selectedOption = null;
      this.text = '';
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }
}

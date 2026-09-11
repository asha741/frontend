import { Component, Input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbDatepickerModule, NgbDateStruct, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../../core/services/api.service';
import { API_ROUTES } from '../../../../core/constants/api-routes';
import { FilterAndSortingService } from '../../../../core/services/common-filter-sort.service';
import { toISOStartOfDay, toISOEndOfDay } from '../../../../core/utils/date.util';
import { TrimWhitespaceDirective } from '../../../../shared/directives/trim-whitespace.directive';
import { CustomDropDownListFilterComponent } from '../../../../core/services/dropdownfilter.component';

/**
 * Patient Documents tab.
 *
 * GET  /organization/patients/document-types → [{ label, value }]
 * POST /organization/patients/documents
 *   { id, page, limit, search, doc_type, upload_date_from, upload_date_to, sort_by, order }
 * → { items: [{ sr_no, doc_type, document_name, upload_date, storage_url }], pagination }
 */
@Component({
  selector: 'app-patient-documents',
  standalone: true,
  imports: [
    GridModule,
    FormsModule,
    DatePipe,
    NgbDatepickerModule,
    NgbTooltipModule,
    TrimWhitespaceDirective,
    CustomDropDownListFilterComponent,
  ],
  templateUrl: './patient-documents.component.html',
  styleUrl: './patient-documents.component.scss',
})
export class PatientDocumentsComponent implements OnInit {
  @Input({ required: true }) patientId!: string;

  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
  ) {}

  readonly documentsData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  documentTypeOptions: { label: string; value: string }[] = [];

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';
  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadDocumentTypes();
    await this.loadDocuments();
  }

  /** Loads the document-type filter dropdown options. */
  async loadDocumentTypes(): Promise<void> {
    // GET the list of available document types, used to populate the type filter.
    const res = await this.api.request('GET', API_ROUTES.GET_PATIENT_DOCUMENT_TYPES, undefined, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      this.documentTypeOptions = res.data;
    }
  }

  /** Fetches the current page of this patient's documents using the grid's state plus search/date-range filters. */
  async loadDocuments(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        id: this.patientId,
        search: this.search?.trim(),
        upload_date_from: this.fromDate ? toISOStartOfDay(this.toDateStr(this.fromDate)) : null,
        upload_date_to: this.toDate ? toISOEndOfDay(this.toDateStr(this.toDate)) : null,
      },
    });

    // POST /organization/patients/documents — returns paginated document list (see class doc above).
    const res = await this.api.request('POST', API_ROUTES.GET_PATIENT_DOCUMENTS, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data ?? {};
      const items = d.items ?? [];
      const total = d.pagination?.total_records ?? items.length;
      this.documentsData.set({ data: items, total });
    }
  }

  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.loadDocuments();
  }

  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.loadDocuments();
  }

  async clearSearch(): Promise<void> {
    this.search = '';
    this.fromDate = null;
    this.toDate = null;
    this.state = { ...this.state, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.loadDocuments();
  }

  /** Opens the document in view-only mode via its storage URL. */
  viewDocument(dataItem: { storage_url?: string }): void {
    if (!dataItem?.storage_url) return;
    window.open(dataItem.storage_url, '_blank', 'noopener');
  }

  private toDateStr(d: NgbDateStruct): string {
    const mm = String(d.month).padStart(2, '0');
    const dd = String(d.day).padStart(2, '0');
    return `${d.year}-${mm}-${dd}`;
  }
}

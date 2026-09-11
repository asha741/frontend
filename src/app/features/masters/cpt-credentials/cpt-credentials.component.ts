import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../../core/services/api.service';
import { API_ROUTES } from '../../../core/constants/api-routes';
import { FilterAndSortingService } from '../../../core/services/common-filter-sort.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../../core/constants/permissions';
import { TrimWhitespaceDirective } from '../../../shared/directives/trim-whitespace.directive';
import { DeleteConfirmationComponent } from '../../../shared/components/delete-confirmation/delete-confirmation.component';
import { CustomDropDownListFilterComponent } from '../../../core/services/dropdownfilter.component';

/**
 * CPT-to-Credential mapping master list screen: Kendo grid with server-side
 * paging/sorting/filtering, search, and row edit/delete against the
 * `/organization/masters/cpt-credentials` endpoints. Also loads the License
 * dropdown options used to filter/display each mapping's license.
 */
@Component({
  selector: 'app-cpt-credentials',
  standalone: true,
  imports: [GridModule, NgbTooltipModule, FormsModule, RouterLink, TrimWhitespaceDirective, CustomDropDownListFilterComponent],
  templateUrl: './cpt-credentials.component.html',
  styleUrl: './cpt-credentials.component.scss',
})
export class CptCredentialsComponent implements OnInit {
  constructor(
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public router: Router,
    public crypto: CryptoService,
    public perms: PermissionService,
    public modal: NgbModal,
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;


  readonly cptData = signal<GridDataResult>({ data: [], total: 0 });
  readonly pageSizes = [10, 25, 50];

  cptState: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  cptSearch = '';

  licenseOptions: { label: string; value: string }[] = [];

  /** Loads the License filter options, then the first page of the CPT mapping list. */
  async ngOnInit(): Promise<void> {
    await this.loadOptions();
    await this.getCptList();
  }

  /**
   * Loads the dropdown/filter options for "License". `typeIds: [7]` is the
   * master-data type id for License; the response bundles options for
   * multiple lookup types, so the License entry is picked out by that id.
   */
  async loadOptions(): Promise<void> {
    // Shared master-list lookup endpoint, filtered to license-type options.
    const res = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [7] }, {
      showToaster: false,
    });
    if (res?.status && Array.isArray(res.data)) {
      const licenseType = res.data.find((d: any) => d.typeId === 7);
      if (licenseType && Array.isArray(licenseType.options)) {
        this.licenseOptions = licenseType.options.map((opt: any) => ({
          label: opt.label,
          value: opt.value
        }));
      }
    }
  }

  /**
   * Fetches the current page of CPT-to-Credential mappings from the backend
   * using the current grid state (paging/sort/filter) and search term, then
   * normalizes the various possible response shapes into `GridDataResult`.
   */
  async getCptList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.cptState, {
      extra: { search: this.cptSearch?.trim() },
    });

    // Server-side paged/sorted/filtered list of CPT-to-Credential mappings.
    const res = await this.api.request('POST', API_ROUTES.GET_CPT_MASTERS_LIST, body, {
      showToaster: false,
    });

    if (res?.status) {
      const d = res.data;
      // Response shape varies by endpoint version — fall back across the
      // possible keys rather than assuming one contract.
      const items = d?.items ?? d?.data ?? [];
      const total =
        d?.pagination?.total_records ?? d?.pagination?.totalItems ?? d?.total ?? items.length;
      this.cptData.set({ data: items, total });
    }
  }

  /** Kendo grid paging/sorting/filtering callback — persists the new state and refetches. */
  async cptDataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.cptState = state;
    await this.getCptList();
  }

  /** Trims the search box, resets to the first page, and refetches. */
  async onCptSearch(): Promise<void> {
    this.cptSearch = this.cptSearch?.trim() ?? '';
    this.cptState = { ...this.cptState, skip: 0 };
    await this.getCptList();
  }

  /** Clears the search term and any active grid filters, resets to the first page, and refetches. */
  async clearCptSearch(): Promise<void> {
    this.cptSearch = '';
    this.cptState = { ...this.cptState, skip: 0, filter: { logic: 'and', filters: [] } };
    await this.getCptList();
  }

  /** Navigates to the edit form for the given row, using an encrypted id in the URL. */
  async editCpt(cptCredential: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(cptCredential.id));
    this.router.navigate(['/masters/cpt-form', encId]);
  }

  /** Opens a confirmation modal, then deletes the row and refetches the list if confirmed. */
  deleteCpt(cptCredential: any): void {
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = `Are you sure you want to delete this CPT to Credential mapping?`;
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // Deletes a single CPT-to-Credential mapping by id.
        const res = await this.api.request('DELETE', API_ROUTES.DELETE_CPT_MASTERS, {
          id: cptCredential.id,
        });
        if (res?.status) await this.getCptList();
      },
      () => {},
    );
  }


}

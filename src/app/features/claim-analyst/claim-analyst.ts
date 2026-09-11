import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataStateChangeEvent, GridDataResult, GridModule } from '@progress/kendo-angular-grid';
import { State } from '@progress/kendo-data-query';
import { Router, RouterLink } from '@angular/router';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { CustomDropDownListFilterComponent } from '../../core/services/dropdownfilter.component';
import { ApiService } from '../../core/services/api.service';
import { API_ROUTES } from '../../core/constants/api-routes';
import { FilterAndSortingService } from '../../core/services/common-filter-sort.service';
import { CryptoService } from '../../core/services/crypto.service';
import { SearchAutocompleteComponent } from '../../shared/components/search-autocomplete/search-autocomplete.component';
import { DeleteConfirmationComponent } from '../../shared/components/delete-confirmation/delete-confirmation.component';
import { TrimWhitespaceDirective } from '../../shared/directives/trim-whitespace.directive';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { BadgeClassPipe } from '../../shared/pipes/badge-class.pipe';

@Component({
  selector: 'app-claim-analyst',
  standalone: true,
  imports: [
    BadgeClassPipe,
    GridModule,
    NgbTooltipModule,
    FormsModule,
    DatePipe,
    RouterLink,
    CustomDropDownListFilterComponent,
    TrimWhitespaceDirective,
    SearchAutocompleteComponent,
  ],
  templateUrl: './claim-analyst.html',
  styleUrl: './claim-analyst.scss',
})
/**
 * Claims list / grid page for the Claim Analyst feature. Loads review-status
 * and AI-status enum options, fetches the paginated claim list from the
 * backend (with search/provider/column filtering and sorting), and lets the
 * analyst navigate to a claim's detail view or delete a claim.
 */
export class ClaimAnalyst implements OnInit {
  constructor(
    public router: Router,
    public api: ApiService,
    public filterSort: FilterAndSortingService,
    public crypto: CryptoService,
    public perms: PermissionService,
    public modal: NgbModal
  ) {}

  /** Exposed so the template can gate on the constants instead of raw strings. */
  readonly PERMISSION_MODULE = PERMISSION_MODULE;
  readonly PERMISSION_ACTION = PERMISSION_ACTION;

  /** Exposed so the provider column filter can name its lookup endpoint. */
  readonly API_ROUTES = API_ROUTES;

  readonly claimsData = signal<GridDataResult>({ data: [], total: 0 });

  readonly pageSizes = [10, 25, 50];

  state: State = {
    skip: 0,
    take: 10,
    sort: [],
    filter: { logic: 'and', filters: [] },
  };

  search = '';

  /** Top-bar provider filter (id) — sent as `provider_id`. */
  providerId = '';

  reviewStatusOptions: { label: string; value: string }[] = [];

  aiStatusOptions: { label: string; value: string }[] = [];

  /**
   * Loads the review-status (typeId 3) and AI-status (typeId 4) dropdown
   * options, then loads the first page of claims.
   */
  async ngOnInit(): Promise<void> {
    // Shared "master list" enum endpoint — one call returns option lists for
    // multiple typeIds at once, so both dropdowns are fetched together.
    const enumsResp = await this.api.request('POST', API_ROUTES.GET_MASTER_LIST, { typeIds: [3, 4] }, {
      showToaster: false,
    });
    if (enumsResp?.status && Array.isArray(enumsResp.data)) {
      const data = enumsResp.data;
      
      const reviewStatusType = data.find((d: any) => d.typeId === 3);
      if (reviewStatusType && Array.isArray(reviewStatusType.options)) {
        this.reviewStatusOptions = [...reviewStatusType.options];
      }

      const aiStatusType = data.find((d: any) => d.typeId === 4);
      if (aiStatusType && Array.isArray(aiStatusType.options)) {
        this.aiStatusOptions = [...aiStatusType.options];
      }
    }

    // The provider lookup is NOT preloaded — the top-bar Provider field
    // searches it as the user types. Picking one only stores the id; the list
    // is re-fetched when Search is clicked.
    await this.getClaimList();
  }

  /**
   * Builds the grid request body (search/filter/sort/pagination) and fetches
   * the current page of claims, updating `claimsData` for the Kendo grid.
   */
  async getClaimList(): Promise<void> {
    const body = this.filterSort.buildRequestBody(this.state, {
      extra: {
        search: this.search?.trim(),
        // Provider now comes from the top bar, not a column filter.
        provider_id: this.providerId,
      },
      // The Provider column is still sortable, and the backend's `sort_by`
      // takes `provider_id` — not the column's own field name.
      fieldMap: {
        provider_name: 'provider_id',
      },
    });

    // Paginated/filtered/sorted claim list for the grid.
    const res = await this.api.request('POST', API_ROUTES.GET_CLAIMS, body, {
      showToaster: false,
    });
    
    if (res?.status) {
      const d = res.data;
      this.claimsData.set({
        data: d?.items ?? [],
        total: d?.pagination?.total_records ?? 0,
      });
    }
  }

  /** Kendo grid callback for paging/sorting/filtering changes. */
  async dataStateChange(state: DataStateChangeEvent): Promise<void> {
    this.state = state;
    await this.getClaimList();
  }

  /** Runs the top-bar search, resetting back to the first page. */
  async onSearch(): Promise<void> {
    this.search = this.search?.trim() ?? '';
    this.state = { ...this.state, skip: 0 };
    await this.getClaimList();
  }

  /** Clears the search text and provider filter, then reloads page 1. */
  async clearSearch(): Promise<void> {
    this.search = '';
    this.providerId = '';
    this.state = { ...this.state, skip: 0 };
    await this.getClaimList();
  }

  /** Navigates to the claim detail view, encrypting the id for the URL. */
  async viewClaim(claim: any): Promise<void> {
    const encId = await this.crypto.encryptId(String(claim.id));
    this.router.navigate(['/claim-analyst/view', encId]);
  }

  /** Confirms via modal, then deletes the claim and refreshes the list. */
  deleteClaim(claim: any): void {
    const ref = this.modal.open(DeleteConfirmationComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
    });
    ref.componentInstance.message = 'Are you sure you want to delete this claim?';
    ref.result.then(
      async (result) => {
        if (result !== 'confirmed') return;
        // Deletes the claim by id.
        const resp = await this.api.request('DELETE', API_ROUTES.DELETE_CLAIM, {
          claim_id: claim.id ?? claim.claim_id,
        });
        if (resp?.status) await this.getClaimList();
      },
      () => {},
    );
  }

}


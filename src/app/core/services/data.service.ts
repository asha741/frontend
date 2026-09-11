import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
import { API_ROUTES } from '../constants/api-routes';
import { ApiService } from './api.service';
import { ConfigService } from '../config/config.service';

/** Shape of the combined lookup-list payload cached by {@link DataService.commonList$}. */
export interface ICommonList {
  statusList: any[];
  adminRoleList: any[];
  agencyRoleList: any[];
  genderList: any[];
  agencyLeadStausList: any[];
  approvalStatusList: any[];
  meetingStatusList: any[];
  ageGroupList: any[];
  countryList: any[];
  caregiverDocTypeList: any[];
  communicationStyleList: any[];
  adaptiveEquipmentList: any[];
  meetingRequestTypeList: any[];
  supportTicketStatusList: any[];
  profileTypeList: any[];
  checkrStatusForAdminList: any[];
  leadSourceTypeList: any[];
}

/**
 * Fetches and caches the app-wide "common lists" (statuses, roles, countries,
 * etc.) used to populate dropdowns across the app, so each list is fetched
 * once per session rather than re-requested by every consuming component.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  // TypeIds = { StatusList = 0, AdminRoleList = 1,AgencyRoleList = 2, GenderList = 3,AgencyLeadList = 4, ApprovalStatusList = 5, MeetingStatusList = 6, AgeGroupList = 7, CountryList = 8}
  private commonListSubject = new BehaviorSubject<any>(null);
  /** Emits the latest combined lookup-list payload; `null` until {@link getCommonList} resolves. */
  commonList$ = this.commonListSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private config: ConfigService,
  ) {}

  /**
   * Fetch every known lookup list (by TypeId, see comment above) in a single
   * request and publish the result on {@link commonList$}. Silent on failure —
   * callers fall back to an empty/`null` list rather than seeing a toast.
   */
  async getCommonList(): Promise<void> {
    // Batched lookup-list endpoint: requests all TypeIds at once instead of
    // one call per dropdown.
    const resp = await this.apiService.request(
      'POST',
      API_ROUTES.GET_COMMON_LIST,
      {
        typeIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      },
      { showToaster: false },
    );

    if (resp?.status) {
      this.commonListSubject.next(resp.data);
    }
  }

  /** The configured "USA" country id, used to default/compare country pickers. */
  getUSACountId() {
    return this.config.usaCountryId ?? 0;
  }
}

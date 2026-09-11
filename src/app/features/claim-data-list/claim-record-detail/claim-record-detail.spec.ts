import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimRecordDetail } from './claim-record-detail';

describe('ClaimRecordDetail', () => {
  let component: ClaimRecordDetail;
  let fixture: ComponentFixture<ClaimRecordDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimRecordDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimRecordDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

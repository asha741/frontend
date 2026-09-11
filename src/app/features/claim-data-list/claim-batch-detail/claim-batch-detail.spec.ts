import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimBatchDetail } from './claim-batch-detail';

describe('ClaimBatchDetail', () => {
  let component: ClaimBatchDetail;
  let fixture: ComponentFixture<ClaimBatchDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimBatchDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimBatchDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

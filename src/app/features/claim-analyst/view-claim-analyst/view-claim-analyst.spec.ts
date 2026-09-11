import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewClaimAnalyst } from './view-claim-analyst';

describe('ViewClaimAnalyst', () => {
  let component: ViewClaimAnalyst;
  let fixture: ComponentFixture<ViewClaimAnalyst>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewClaimAnalyst],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewClaimAnalyst);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

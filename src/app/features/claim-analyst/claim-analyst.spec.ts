import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimAnalyst } from './claim-analyst';

describe('ClaimAnalyst', () => {
  let component: ClaimAnalyst;
  let fixture: ComponentFixture<ClaimAnalyst>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimAnalyst],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimAnalyst);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

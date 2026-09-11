import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ValidateClaim } from './validate-claim';

describe('ValidateClaim', () => {
  let component: ValidateClaim;
  let fixture: ComponentFixture<ValidateClaim>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidateClaim],
    }).compileComponents();

    fixture = TestBed.createComponent(ValidateClaim);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { OrgAnalytic } from './org-analytic';

describe('OrgAnalytic', () => {
  let component: OrgAnalytic;
  let fixture: ComponentFixture<OrgAnalytic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgAnalytic],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAnalytic);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

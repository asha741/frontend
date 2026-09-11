import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportsAnalytics } from './reports-analytics';

describe('ReportsAnalytics', () => {
  let component: ReportsAnalytics;
  let fixture: ComponentFixture<ReportsAnalytics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsAnalytics],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsAnalytics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AnalyticWorkload } from './analytic-workload';

describe('AnalyticWorkload', () => {
  let component: AnalyticWorkload;
  let fixture: ComponentFixture<AnalyticWorkload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalyticWorkload],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticWorkload);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AnalyticRules } from './analytic-rules';

describe('AnalyticRules', () => {
  let component: AnalyticRules;
  let fixture: ComponentFixture<AnalyticRules>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalyticRules],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticRules);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

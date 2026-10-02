import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AnalyticUpload } from './analytic-upload';

describe('AnalyticUpload', () => {
  let component: AnalyticUpload;
  let fixture: ComponentFixture<AnalyticUpload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalyticUpload],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticUpload);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

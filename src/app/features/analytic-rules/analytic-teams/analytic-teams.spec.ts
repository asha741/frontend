import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AnalyticTeams } from './analytic-teams';

describe('AnalyticTeams', () => {
  let component: AnalyticTeams;
  let fixture: ComponentFixture<AnalyticTeams>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalyticTeams],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticTeams);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

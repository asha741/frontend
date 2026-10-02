import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { TeamDetail } from './team-detail';

describe('TeamDetail', () => {
  let component: TeamDetail;
  let fixture: ComponentFixture<TeamDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamDetail],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

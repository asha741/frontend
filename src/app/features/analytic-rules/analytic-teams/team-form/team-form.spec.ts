import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { TeamForm } from './team-form';

describe('TeamForm', () => {
  let component: TeamForm;
  let fixture: ComponentFixture<TeamForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamForm],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

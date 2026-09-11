import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PatientForm } from './patient-form';

describe('PatientForm', () => {
  let component: PatientForm;
  let fixture: ComponentFixture<PatientForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientForm],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

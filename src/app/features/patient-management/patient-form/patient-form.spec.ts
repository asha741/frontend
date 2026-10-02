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

  it('should allow empty optional patient fields while requiring core identity fields', () => {
    component.form.patchValue({
      patient_id: 'PAT-001',
      first_name: 'John',
      last_name: 'Doe',
      gender: 'Male',
      email: '',
      contact_number: '',
      date_of_birth: null,
      state: '',
      city: '',
      pin_code: '',
      address_1: '',
    });

    expect(component.form.get('patient_id')?.hasError('required')).toBeFalsy();
    expect(component.form.get('first_name')?.hasError('required')).toBeFalsy();
    expect(component.form.get('last_name')?.hasError('required')).toBeFalsy();
    expect(component.form.get('gender')?.hasError('required')).toBeFalsy();
    expect(component.form.get('email')?.hasError('required')).toBeFalsy();
    expect(component.form.get('contact_number')?.hasError('required')).toBeFalsy();
    expect(component.form.valid).toBeTruthy();
  });
});

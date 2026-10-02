import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProviderForm } from './provider-form';

describe('ProviderForm', () => {
  let component: ProviderForm;
  let fixture: ComponentFixture<ProviderForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderForm],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should allow empty optional provider fields while requiring provider identity fields', () => {
    component.form.patchValue({
      provider_id: 'PRV-100',
      first_name: 'Jane',
      last_name: 'Smith',
      email: '',
      contact_number: '',
      designation: '',
      license: [],
    });

    expect(component.form.get('provider_id')?.hasError('required')).toBeFalsy();
    expect(component.form.get('first_name')?.hasError('required')).toBeFalsy();
    expect(component.form.get('last_name')?.hasError('required')).toBeFalsy();
    expect(component.form.get('email')?.hasError('required')).toBeFalsy();
    expect(component.form.get('contact_number')?.hasError('required')).toBeFalsy();
    expect(component.form.get('designation')?.hasError('required')).toBeFalsy();
    expect(component.form.valid).toBeTruthy();
  });
});

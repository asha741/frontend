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
});

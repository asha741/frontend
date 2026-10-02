import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloneNotesForm } from './clone-notes-form';

describe('CloneNotesForm', () => {
  let component: CloneNotesForm;
  let fixture: ComponentFixture<CloneNotesForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloneNotesForm],
    }).compileComponents();

    fixture = TestBed.createComponent(CloneNotesForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

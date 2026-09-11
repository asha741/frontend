import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FailedNotes } from './failed-notes';

describe('FailedNotes', () => {
  let component: FailedNotes;
  let fixture: ComponentFixture<FailedNotes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FailedNotes],
    }).compileComponents();

    fixture = TestBed.createComponent(FailedNotes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

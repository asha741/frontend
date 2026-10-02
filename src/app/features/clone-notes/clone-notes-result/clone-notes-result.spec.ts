import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloneNotesResult } from './clone-notes-result';

describe('CloneNotesResult', () => {
  let component: CloneNotesResult;
  let fixture: ComponentFixture<CloneNotesResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloneNotesResult],
    }).compileComponents();

    fixture = TestBed.createComponent(CloneNotesResult);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

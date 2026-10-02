import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloneNotes } from './clone-notes';

describe('CloneNotes', () => {
  let component: CloneNotes;
  let fixture: ComponentFixture<CloneNotes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloneNotes],
    }).compileComponents();

    fixture = TestBed.createComponent(CloneNotes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

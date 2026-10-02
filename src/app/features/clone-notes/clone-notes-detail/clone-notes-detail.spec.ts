import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloneNotesDetail } from './clone-notes-detail';

describe('CloneNotesDetail', () => {
  let component: CloneNotesDetail;
  let fixture: ComponentFixture<CloneNotesDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloneNotesDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(CloneNotesDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FailedPages } from './failed-pages';

describe('FailedPages', () => {
  let component: FailedPages;
  let fixture: ComponentFixture<FailedPages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FailedPages],
    }).compileComponents();

    fixture = TestBed.createComponent(FailedPages);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

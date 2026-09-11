import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimImport } from './claim-import';

describe('ClaimImport', () => {
  let component: ClaimImport;
  let fixture: ComponentFixture<ClaimImport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimImport],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimImport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

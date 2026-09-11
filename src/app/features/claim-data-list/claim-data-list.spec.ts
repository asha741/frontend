import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimDataList } from './claim-data-list';

describe('ClaimDataList', () => {
  let component: ClaimDataList;
  let fixture: ComponentFixture<ClaimDataList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimDataList],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimDataList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

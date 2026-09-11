import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BhsMatrixFormComponent } from './bhs-matrix-form.component';

describe('BhsMatrixFormComponent', () => {
  let component: BhsMatrixFormComponent;
  let fixture: ComponentFixture<BhsMatrixFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BhsMatrixFormComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BhsMatrixFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

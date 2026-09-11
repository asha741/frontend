import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BhsMatrixComponent } from './bhs-matrix.component';

describe('BhsMatrixComponent', () => {
  let component: BhsMatrixComponent;
  let fixture: ComponentFixture<BhsMatrixComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BhsMatrixComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BhsMatrixComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

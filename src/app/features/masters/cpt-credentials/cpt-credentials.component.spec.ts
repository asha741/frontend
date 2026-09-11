import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CptCredentialsComponent } from './cpt-credentials.component';

describe('CptCredentialsComponent', () => {
  let component: CptCredentialsComponent;
  let fixture: ComponentFixture<CptCredentialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CptCredentialsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CptCredentialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { WorkloadThresholdModal } from './workload-threshold-modal';

describe('WorkloadThresholdModal', () => {
  let component: WorkloadThresholdModal;
  let fixture: ComponentFixture<WorkloadThresholdModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkloadThresholdModal],
      providers: [provideHttpClient(), NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkloadThresholdModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

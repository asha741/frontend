import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { ApiService } from '../../core/services/api.service';
import { PermissionService } from '../../core/services/permission.service';
import { PERMISSION_ACTION, PERMISSION_MODULE } from '../../core/constants/permissions';
import { API_ROUTES } from '../../core/constants/api-routes';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let apiRequest: ReturnType<typeof vi.fn>;
  let permsCan: ReturnType<typeof vi.fn>;

  /**
   * `Settings: Update` is granted by default so the happy-path form behaviour
   * (load/validate/save) can be exercised without permission gating getting
   * in the way. The dedicated "permission gating" suite below overrides this.
   */
  const setUpdatePermission = (granted: boolean) => {
    permsCan.mockImplementation(
      (module: string, action: string) =>
        module === PERMISSION_MODULE.Settings && action === PERMISSION_ACTION.Update && granted,
    );
  };

  beforeEach(async () => {
    apiRequest = vi.fn().mockResolvedValue({ status: true, data: { consecutive_day_threshold: 7 }, message: '' });
    permsCan = vi.fn().mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: ApiService, useValue: { request: apiRequest } },
        { provide: PermissionService, useValue: { can: permsCan } },
      ],
    }).compileComponents();

    setUpdatePermission(true);

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('loading the threshold', () => {
    it('fetches the threshold on init via GET and patches the form', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(apiRequest).toHaveBeenCalledWith(
        'GET',
        API_ROUTES.GET_CONSECUTIVE_DAYS_THRESHOLD,
        null,
        { showToaster: false },
      );
      expect(component.form.value.consecutiveDaysThreshold).toBe(7);
    });

    it('leaves the form empty when the GET call fails', async () => {
      apiRequest.mockResolvedValue({ status: false, data: null, message: 'Request failed' });

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.form.value.consecutiveDaysThreshold).toBeNull();
    });
  });

  describe('validation', () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('rejects a blank value as required', () => {
      component.form.get('consecutiveDaysThreshold')?.setValue(null);
      expect(component.f['consecutiveDaysThreshold'].hasError('required')).toBe(true);
    });

    it('rejects non-numeric values via the pattern validator', () => {
      component.form.get('consecutiveDaysThreshold')?.setValue('abc');
      expect(component.f['consecutiveDaysThreshold'].hasError('pattern')).toBe(true);
    });

    it('rejects a value below the minimum of 1', () => {
      component.form.get('consecutiveDaysThreshold')?.setValue(0);
      expect(component.f['consecutiveDaysThreshold'].hasError('min')).toBe(true);
    });

    it('rejects a value above the maximum of 31', () => {
      component.form.get('consecutiveDaysThreshold')?.setValue(32);
      expect(component.f['consecutiveDaysThreshold'].hasError('max')).toBe(true);
    });

    it('accepts an in-range integer', () => {
      component.form.get('consecutiveDaysThreshold')?.setValue(15);
      expect(component.form.get('consecutiveDaysThreshold')?.valid).toBe(true);
    });
  });

  describe('saving', () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      apiRequest.mockClear();
    });

    it('does not call the API and flags the form when the value is invalid', async () => {
      component.form.get('consecutiveDaysThreshold')?.setValue(null);

      await component.saveSettings();

      expect(component.isSubmitted()).toBe(true);
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('sends the threshold via PUT and reloads it on success', async () => {
      component.form.get('consecutiveDaysThreshold')?.setValue(12);
      apiRequest.mockResolvedValue({ status: true, data: { consecutive_day_threshold: 12 }, message: 'Saved' });

      await component.saveSettings();

      expect(apiRequest).toHaveBeenNthCalledWith(
        1,
        'PUT',
        API_ROUTES.UPDATE_CONSECUTIVE_DAYS_THRESHOLD,
        { consecutive_day_threshold: 12 },
        { showToaster: true },
      );
      // Re-fetches the saved value so the field reflects the server's copy of record.
      expect(apiRequest).toHaveBeenNthCalledWith(
        2,
        'GET',
        API_ROUTES.GET_CONSECUTIVE_DAYS_THRESHOLD,
        null,
        { showToaster: false },
      );
    });

    it('does not reload when the PUT call fails', async () => {
      component.form.get('consecutiveDaysThreshold')?.setValue(12);
      apiRequest.mockResolvedValue({ status: false, data: null, message: 'Request failed' });

      await component.saveSettings();

      expect(apiRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('permission gating', () => {
    it('blocks saveSettings() when Settings: Update is not granted', async () => {
      setUpdatePermission(false);
      fixture.detectChanges();
      await fixture.whenStable();
      apiRequest.mockClear();

      component.form.get('consecutiveDaysThreshold')?.setValue(10);
      await component.saveSettings();

      expect(apiRequest).not.toHaveBeenCalled();
      expect(component.isSubmitted()).toBe(false);
    });

    it('marks the input read-only and hides the Save button without Settings: Update', async () => {
      setUpdatePermission(false);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('#maConsecutiveDaysThreshold') as HTMLInputElement;
      const saveButton = fixture.nativeElement.querySelector('button[type="submit"]');

      expect(input.readOnly).toBe(true);
      expect(saveButton).toBeNull();
    });

    it('allows editing and shows the Save button with Settings: Update', async () => {
      setUpdatePermission(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('#maConsecutiveDaysThreshold') as HTMLInputElement;
      const saveButton = fixture.nativeElement.querySelector('button[type="submit"]');

      expect(input.readOnly).toBe(false);
      expect(saveButton).not.toBeNull();
    });
  });

  describe('numeric-only input guarding', () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('blocks a non-digit keystroke', () => {
      const event = { key: 'e', ctrlKey: false, metaKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      component.onThresholdKeydown(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('allows a digit keystroke through', () => {
      const event = { key: '5', ctrlKey: false, metaKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      component.onThresholdKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('allows navigation/edit keys through', () => {
      const event = { key: 'Backspace', ctrlKey: false, metaKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      component.onThresholdKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('allows Ctrl/Cmd combos through (copy/paste/select-all)', () => {
      const event = { key: 'v', ctrlKey: true, metaKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      component.onThresholdKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('strips non-digit characters from pasted text', () => {
      const event = {
        preventDefault: vi.fn(),
        clipboardData: { getData: () => 'a1b2c3d' },
      } as unknown as ClipboardEvent;

      component.onThresholdPaste(event);

      expect(event.preventDefault).toHaveBeenCalled();
      // Digits only, capped at 2 characters by the field's maxlength.
      expect(component.form.value.consecutiveDaysThreshold).toBe(12);
    });

    it('clears the field when the pasted text has no digits', () => {
      const event = {
        preventDefault: vi.fn(),
        clipboardData: { getData: () => 'abc' },
      } as unknown as ClipboardEvent;

      component.onThresholdPaste(event);

      expect(component.form.value.consecutiveDaysThreshold).toBeNull();
    });
  });
});

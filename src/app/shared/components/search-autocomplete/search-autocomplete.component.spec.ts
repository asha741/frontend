import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { SearchAutocompleteComponent } from './search-autocomplete.component';

describe('SearchAutocompleteComponent', () => {
  let component: SearchAutocompleteComponent;
  let fixture: ComponentFixture<SearchAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchAutocompleteComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prompts for more characters before any search runs', () => {
    component.onFilterChange('ab');
    expect(component.emptyMessage).toContain('3 characters');
    expect(component.options().length).toBe(0);
  });
});

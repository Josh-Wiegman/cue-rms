import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClashesComponent } from './clashes-component';

describe('ClashesComponent', () => {
  let component: ClashesComponent;
  let fixture: ComponentFixture<ClashesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClashesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClashesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

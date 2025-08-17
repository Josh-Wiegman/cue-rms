import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UiShell } from './ui-shell-component';

describe('UiShell', () => {
  let component: UiShell;
  let fixture: ComponentFixture<UiShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiShell],
    }).compileComponents();

    fixture = TestBed.createComponent(UiShell);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

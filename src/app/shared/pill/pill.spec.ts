import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pill } from './pill';

describe('Pill', () => {
  let component: Pill;
  let fixture: ComponentFixture<Pill>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pill]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Pill);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

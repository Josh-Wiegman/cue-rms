import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleButton } from './simple-button';

describe('SimpleButton', () => {
  let component: SimpleButton;
  let fixture: ComponentFixture<SimpleButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleButton]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimpleButton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrewScheduler as CrewSchedulerComponent } from './crew-scheduler';

describe('CrewScheduler', () => {
  let component: CrewSchedulerComponent;
  let fixture: ComponentFixture<CrewSchedulerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrewSchedulerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CrewSchedulerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

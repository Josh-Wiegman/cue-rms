import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiShellComponent } from '../shared/ui-shell/ui-shell-component';

interface CrewMember {
  id: string;
  name: string;
  role: string;
}

interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  warrantExpiry: string; // ISO date
}

interface CrewAssignment {
  crewId: string;
  responsibility?: string;
}

type SlotKey = 'packIn' | 'show' | 'packOut' | 'rehearsal';

interface PlannerSlot {
  key: SlotKey;
  label: string;
  start: string; // HH:mm
  durationMinutes: number;
  crew: CrewAssignment[];
}

interface PlannerEvent {
  id: string;
  salesOrder: string;
  title: string;
  location: string;
  type: 'Production' | 'Dry Hire';
  dateOffset: number; // days from week start (Mon = 0)
  notes?: string;
  vehicles: string[]; // vehicle IDs
  slots: PlannerSlot[];
}

interface EventWarnings {
  crewConflicts: string[];
  vehicleAlerts: string[];
}

interface WeekDay {
  label: string;
  date: Date;
}

interface PlannerDraft {
  salesOrder: string;
  title: string;
  location: string;
  type: PlannerEvent['type'];
  date: string; // yyyy-MM-dd
  notes: string;
  vehicles: string[];
  packInStart: string;
  packInDuration: number;
  showStart: string;
  showDuration: number;
  packOutStart: string;
  packOutDuration: number;
  packInCrew: string[];
  showCrew: string[];
  packOutCrew: string[];
}

@Component({
  selector: 'crew-planner',
  imports: [CommonModule, FormsModule, UiShellComponent],
  templateUrl: './crew-planner.component.html',
  styleUrl: './crew-planner.component.scss',
})
export class CrewPlannerComponent {
  protected readonly crewMembers = signal<CrewMember[]>([
    { id: 'crew-1', name: 'Abby', role: 'Prod. Manager' },
    { id: 'crew-2', name: 'Tobin', role: 'Lighting' },
    { id: 'crew-3', name: 'Pita', role: 'Audio' },
    { id: 'crew-4', name: 'Liam', role: 'Rigger' },
    { id: 'crew-5', name: 'Clem', role: 'Driver' },
    { id: 'crew-6', name: 'Amie', role: 'LX Tech' },
  ]);

  protected readonly vehicles = signal<Vehicle[]>([
    {
      id: 'vehicle-1',
      name: '26’ Box Truck',
      licensePlate: 'FTL 327',
      warrantExpiry: this.addDays(new Date(), 10).toISOString(),
    },
    {
      id: 'vehicle-2',
      name: 'Sprinter Van',
      licensePlate: 'HTM 221',
      warrantExpiry: this.addDays(new Date(), 40).toISOString(),
    },
    {
      id: 'vehicle-3',
      name: 'Transit',
      licensePlate: 'HRA 910',
      warrantExpiry: this.addDays(new Date(), -2).toISOString(),
    },
  ]);

  protected readonly events = signal<PlannerEvent[]>([
    {
      id: 'event-1',
      salesOrder: 'SO-3102',
      title: 'Taco Joy x New World Week',
      location: 'Auckland CBD',
      type: 'Production',
      dateOffset: 0,
      notes: 'Stair run to stage area — allow extra hands for pack in.',
      vehicles: ['vehicle-1'],
      slots: [
        {
          key: 'packIn',
          label: 'Pack in',
          start: '08:00',
          durationMinutes: 120,
          crew: [
            { crewId: 'crew-1', responsibility: 'Lead' },
            { crewId: 'crew-4', responsibility: 'Rigging' },
            { crewId: 'crew-5', responsibility: 'Driver' },
          ],
        },
        {
          key: 'show',
          label: 'Show',
          start: '13:00',
          durationMinutes: 180,
          crew: [
            { crewId: 'crew-1', responsibility: 'Show caller' },
            { crewId: 'crew-3', responsibility: 'Audio' },
            { crewId: 'crew-2', responsibility: 'LX' },
          ],
        },
        {
          key: 'packOut',
          label: 'Pack out',
          start: '17:00',
          durationMinutes: 120,
          crew: [
            { crewId: 'crew-2' },
            { crewId: 'crew-3' },
            { crewId: 'crew-4' },
          ],
        },
      ],
    },
    {
      id: 'event-2',
      salesOrder: 'SO-3108',
      title: 'Podcasts on Stage',
      location: 'The Civic',
      type: 'Production',
      dateOffset: 1,
      notes: 'Mics need AA batteries supplied.',
      vehicles: ['vehicle-2'],
      slots: [
        {
          key: 'packIn',
          label: 'Pack in',
          start: '09:30',
          durationMinutes: 90,
          crew: [
            { crewId: 'crew-1' },
            { crewId: 'crew-2' },
          ],
        },
        {
          key: 'show',
          label: 'Show',
          start: '11:00',
          durationMinutes: 120,
          crew: [
            { crewId: 'crew-3', responsibility: 'Mix' },
            { crewId: 'crew-2', responsibility: 'Lighting' },
          ],
        },
        {
          key: 'packOut',
          label: 'Pack out',
          start: '14:00',
          durationMinutes: 60,
          crew: [
            { crewId: 'crew-1' },
            { crewId: 'crew-3' },
          ],
        },
      ],
    },
    {
      id: 'event-3',
      salesOrder: 'SO-3115',
      title: 'University Open Day',
      location: 'Kelburn Campus',
      type: 'Dry Hire',
      dateOffset: 3,
      vehicles: ['vehicle-3'],
      notes: 'Dry hire — crew on pack in only.',
      slots: [
        {
          key: 'packIn',
          label: 'Pack in',
          start: '07:00',
          durationMinutes: 60,
          crew: [
            { crewId: 'crew-5', responsibility: 'Driver' },
            { crewId: 'crew-6', responsibility: 'Check gear' },
          ],
        },
        {
          key: 'packOut',
          label: 'Pack out',
          start: '18:00',
          durationMinutes: 60,
          crew: [{ crewId: 'crew-6' }],
        },
      ],
    },
    {
      id: 'event-4',
      salesOrder: 'SO-3119',
      title: 'Annual Awards Dinner',
      location: 'SkyCity Ballroom',
      type: 'Production',
      dateOffset: 5,
      notes: 'Client bringing MC console.',
      vehicles: ['vehicle-1', 'vehicle-2'],
      slots: [
        {
          key: 'packIn',
          label: 'Pack in',
          start: '10:00',
          durationMinutes: 120,
          crew: [
            { crewId: 'crew-1', responsibility: 'Client lead' },
            { crewId: 'crew-4', responsibility: 'Rigging' },
            { crewId: 'crew-2', responsibility: 'LX' },
          ],
        },
        {
          key: 'show',
          label: 'Show',
          start: '19:00',
          durationMinutes: 180,
          crew: [
            { crewId: 'crew-1' },
            { crewId: 'crew-2' },
            { crewId: 'crew-3', responsibility: 'Audio' },
          ],
        },
        {
          key: 'packOut',
          label: 'Pack out',
          start: '23:00',
          durationMinutes: 120,
          crew: [
            { crewId: 'crew-4' },
            { crewId: 'crew-5' },
          ],
        },
      ],
    },
    {
      id: 'event-5',
      salesOrder: 'SO-3123',
      title: 'Town Hall Wedding',
      location: 'Lower Hutt',
      type: 'Production',
      dateOffset: 5,
      vehicles: ['vehicle-2'],
      notes: 'Band to arrive 2pm — coordinate with planner.',
      slots: [
        {
          key: 'packIn',
          label: 'Pack in',
          start: '12:00',
          durationMinutes: 120,
          crew: [
            { crewId: 'crew-3', responsibility: 'Lead' },
            { crewId: 'crew-6' },
          ],
        },
        {
          key: 'show',
          label: 'Show',
          start: '16:30',
          durationMinutes: 180,
          crew: [
            { crewId: 'crew-3' },
            { crewId: 'crew-2' },
          ],
        },
        {
          key: 'packOut',
          label: 'Pack out',
          start: '22:30',
          durationMinutes: 90,
          crew: [
            { crewId: 'crew-3' },
            { crewId: 'crew-2' },
          ],
        },
      ],
    },
  ]);

  protected readonly viewMode = signal<'byTask' | 'byTime'>('byTask');
  protected readonly selectedWeekStart = signal<Date>(
    this.getStartOfWeek(new Date()),
  );

  protected newEventDraft: PlannerDraft = this.createEmptyDraft();

  protected readonly weekDays = computed<WeekDay[]>(() => {
    const start = this.selectedWeekStart();
    return Array.from({ length: 7 }).map((_, index) => ({
      date: this.addDays(start, index),
      label: this.addDays(start, index).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    }));
  });

  protected readonly plannerEvents = computed<(PlannerEvent & { date: Date })[]>(
    () =>
      this.events().map((event) => ({
        ...event,
        date: this.addDays(this.selectedWeekStart(), event.dateOffset),
      })),
  );

  protected readonly eventWarnings = computed<Map<string, EventWarnings>>(() => {
    const warnings = new Map<string, EventWarnings>();
    const events = this.plannerEvents();
    events.forEach((event) =>
      warnings.set(event.id, { crewConflicts: [], vehicleAlerts: [] }),
    );

    const eventsByDate = new Map<string, PlannerEvent[]>();
    for (const event of events) {
      const key = this.formatDateKey(event.date as Date);
      const collection = eventsByDate.get(key) ?? [];
      collection.push(event);
      eventsByDate.set(key, collection);
    }

    for (const dayEvents of eventsByDate.values()) {
      this.detectCrewConflicts(dayEvents, warnings);
    }

    events.forEach((event) => {
      const vehicleAlerts = warnings.get(event.id)?.vehicleAlerts ?? [];
      for (const vehicleId of event.vehicles) {
        const vehicle = this.getVehicle(vehicleId);
        if (!vehicle) continue;
        const expiry = new Date(vehicle.warrantExpiry);
        const eventDate = event.date as Date;
        if (expiry < eventDate) {
          vehicleAlerts.push(
            `${vehicle.name} (${vehicle.licensePlate}) WOF is expired before this event`,
          );
        } else {
          const daysUntilExpiry = Math.round(
            (expiry.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntilExpiry <= 30) {
            vehicleAlerts.push(
              `${vehicle.name} (${vehicle.licensePlate}) WOF expires in ${daysUntilExpiry} day${
                daysUntilExpiry === 1 ? '' : 's'
              }`,
            );
          }
        }
      }
    });

    return warnings;
  });

  protected eventsForDay(day: Date): (PlannerEvent & { date: Date })[] {
    const key = this.formatDateKey(day);
    return this.plannerEvents()
      .filter((event) => this.formatDateKey(event.date as Date) === key)
      .map((event) => ({ ...event, date: event.date as Date }))
      .sort((a, b) => {
        if (this.viewMode() === 'byTask') {
          return this.slotOrderScore(a) - this.slotOrderScore(b);
        }

        const firstSlotA = this.earliestSlot(a);
        const firstSlotB = this.earliestSlot(b);
        return firstSlotA.getTime() - firstSlotB.getTime();
      });
  }

  protected formattedTime(date: Date, time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const copy = new Date(date);
    copy.setHours(hours, minutes, 0, 0);
    return copy.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  protected crewName(crewId: string): string {
    return this.crewMembers().find((member) => member.id === crewId)?.name ??
      'Unknown crew';
  }

  protected getVehicle(vehicleId: string): Vehicle | undefined {
    return this.vehicles().find((vehicle) => vehicle.id === vehicleId);
  }

  protected toggleView(mode: 'byTask' | 'byTime'): void {
    this.viewMode.set(mode);
  }

  protected adjustWeek(by: number): void {
    const updated = this.addDays(this.selectedWeekStart(), by * 7);
    this.selectedWeekStart.set(updated);
    this.newEventDraft.date = this.formatInputDate(updated);
  }

  protected addEvent(): void {
    if (!this.newEventDraft.salesOrder || !this.newEventDraft.title) {
      return;
    }

    const eventDate =
      this.parseLocalDate(this.newEventDraft.date) ?? this.selectedWeekStart();
    const offset = Math.round(
      (eventDate.getTime() - this.selectedWeekStart().getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const slots: PlannerSlot[] = [
      {
        key: 'packIn',
        label: 'Pack in',
        start: this.newEventDraft.packInStart,
        durationMinutes: Number(this.newEventDraft.packInDuration) || 0,
        crew: this.newEventDraft.packInCrew.map((crewId) => ({ crewId })),
      },
    ];

    if (this.newEventDraft.showStart) {
      slots.push({
        key: 'show',
        label: 'Show',
        start: this.newEventDraft.showStart,
        durationMinutes: Number(this.newEventDraft.showDuration) || 0,
        crew: this.newEventDraft.showCrew.map((crewId) => ({ crewId })),
      });
    }

    if (this.newEventDraft.packOutStart) {
      slots.push({
        key: 'packOut',
        label: 'Pack out',
        start: this.newEventDraft.packOutStart,
        durationMinutes: Number(this.newEventDraft.packOutDuration) || 0,
        crew: this.newEventDraft.packOutCrew.map((crewId) => ({ crewId })),
      });
    }

    const newEvent: PlannerEvent = {
      id: `event-${Date.now()}`,
      salesOrder: this.newEventDraft.salesOrder,
      title: this.newEventDraft.title,
      location: this.newEventDraft.location,
      type: this.newEventDraft.type,
      dateOffset: offset,
      notes: this.newEventDraft.notes,
      vehicles: [...this.newEventDraft.vehicles],
      slots,
    };

    this.events.update((list) => [...list, newEvent]);
    this.newEventDraft = this.createEmptyDraft();
  }

  protected slotOrder(slots: PlannerSlot[]): PlannerSlot[] {
    const orderedKeys: PlannerSlot['key'][] = ['packIn', 'rehearsal', 'show', 'packOut'];
    if (this.viewMode() === 'byTask') {
      return [...slots].sort(
        (a, b) => orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key),
      );
    }

    return [...slots].sort((a, b) => this.timeToMinutes(a.start) - this.timeToMinutes(b.start));
  }

  protected warningForEvent(eventId: string): EventWarnings {
    return (
      this.eventWarnings().get(eventId) ?? { crewConflicts: [], vehicleAlerts: [] }
    );
  }

  private slotOrderScore(event: PlannerEvent & { date: Date }): number {
    const priority = ['packIn', 'rehearsal', 'show', 'packOut'];
    const firstSlot = this.slotOrder(event.slots)[0];
    return priority.indexOf(firstSlot?.key ?? 'packIn');
  }

  private earliestSlot(event: PlannerEvent & { date: Date }): Date {
    const [hours, minutes] = (this.slotOrder(event.slots)[0]?.start ?? '00:00')
      .split(':')
      .map(Number);
    const when = new Date(event.date);
    when.setHours(hours, minutes, 0, 0);
    return when;
  }

  private detectCrewConflicts(
    events: (PlannerEvent & { date?: Date })[],
    warnings: Map<string, EventWarnings>,
  ): void {
    const crewSchedule = new Map<
      string,
      { eventId: string; slotLabel: string; start: Date; end: Date }
    >();

    for (const event of events) {
      for (const slot of event.slots) {
        for (const assignment of slot.crew) {
          const start = this.combineDateAndTime(event.date as Date, slot.start);
          const end = this.addMinutes(start, slot.durationMinutes);
          const key = `${assignment.crewId}-${start.toISOString()}`;
          crewSchedule.set(key, {
            eventId: event.id,
            slotLabel: slot.label,
            start,
            end,
          });
        }
      }
    }

    const groupedByCrew = new Map<string, typeof crewSchedule>();
    for (const [key, entry] of crewSchedule.entries()) {
      const crewId = key.split('-')[0];
      const group = groupedByCrew.get(crewId) ?? new Map();
      group.set(key, entry);
      groupedByCrew.set(crewId, group);
    }

    const eventsById = new Map(events.map((event) => [event.id, event]));

    for (const [crewId, assignments] of groupedByCrew) {
      const sorted = Array.from(assignments.values()).sort(
        (a, b) => a.start.getTime() - b.start.getTime(),
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (current.end > next.start) {
          if (current.eventId === next.eventId) continue;
          const crewName = this.crewName(crewId);
          const currentEvent = eventsById.get(current.eventId);
          const nextEvent = eventsById.get(next.eventId);

          const description = `${crewName} overlaps ${currentEvent?.title} (${current.slotLabel}) and ${nextEvent?.title} (${next.slotLabel}) at ${current.start.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}`;

          warnings.get(current.eventId)?.crewConflicts.push(description);
          warnings.get(next.eventId)?.crewConflicts.push(description);
        }
      }
    }
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private getStartOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    return this.addDays(date, diff);
  }

  private combineDateAndTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const copy = new Date(date);
    copy.setHours(hours, minutes, 0, 0);
    return copy;
  }

  private createEmptyDraft(): PlannerDraft {
    return {
      salesOrder: '',
      title: '',
      location: '',
      type: 'Production',
      date: this.formatInputDate(this.selectedWeekStart()),
      notes: '',
      vehicles: [],
      packInStart: '08:00',
      packInDuration: 120,
      showStart: '',
      showDuration: 120,
      packOutStart: '17:00',
      packOutDuration: 90,
      packInCrew: [],
      showCrew: [],
      packOutCrew: [],
    };
  }

  private formatInputDate(date: Date): string {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString().slice(0, 10);
  }

  private parseLocalDate(value: string | undefined): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
}

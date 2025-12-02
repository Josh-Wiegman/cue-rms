import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';

interface CrewMember {
  id: string;
  name: string;
  role: string;
}

interface Vehicle {
  id: string;
  name: string;
  wofExpiry: string; // ISO date
}

interface CrewBlock {
  id: string;
  type: 'pack_in' | 'pack_out' | 'show';
  label: string;
  start: string; // ISO date-time
  end: string; // ISO date-time
  crewIds: string[];
  notes?: string;
}

interface CrewEvent {
  id: string;
  salesOrder: string;
  title: string;
  isProduction: boolean;
  assignedVehicleIds: string[];
  notes?: string;
  blocks: CrewBlock[];
}

interface DayBlock {
  event: CrewEvent;
  block: CrewBlock;
}

@Component({
  selector: 'crew-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, UiShellComponent],
  templateUrl: './crew-planner.html',
  styleUrl: './crew-planner.scss',
})
export class CrewPlannerComponent {
  viewMode: 'packInFirst' | 'chronological' = 'packInFirst';
  weekOffset = 0;
  weekRange!: { start: Date; end: Date };
  private readonly anchorDate: Date;

  readonly crew: CrewMember[] = [
    { id: 'crew-alex', name: 'Alex McKay', role: 'Production Manager' },
    { id: 'crew-sam', name: 'Samira Lee', role: 'Lighting Tech' },
    { id: 'crew-jo', name: 'Jordan Phelps', role: 'Audio Tech' },
    { id: 'crew-ty', name: 'Tyla Chen', role: 'Truck Driver' },
    { id: 'crew-ani', name: 'Anika Roy', role: 'Stagehand' },
    { id: 'crew-cam', name: 'Cam Hensley', role: 'Rigger' },
  ];

  readonly vehicles: Vehicle[] = [
    { id: 'veh-van', name: 'Cue-Go Van', wofExpiry: '2026-04-02' },
    { id: 'veh-truck', name: '20m3 Truck', wofExpiry: '2026-03-18' },
    { id: 'veh-hiace', name: 'Hiace', wofExpiry: '2026-03-30' },
    { id: 'veh-regius', name: 'Regius', wofExpiry: '2026-05-12' },
  ];

  readonly events: CrewEvent[] = [
    {
      id: 'evt-civic-centre',
      salesOrder: 'SO-4821',
      title: 'Pack-in for Civic Centre',
      isProduction: false,
      assignedVehicleIds: ['veh-van', 'veh-truck'],
      notes: 'Meet client at loading dock; access via Gate 2.',
      blocks: [
        {
          id: 'evt-civic-centre-packin',
          type: 'pack_in',
          label: 'Pack in',
          start: '2026-03-16T09:00',
          end: '2026-03-16T13:00',
          crewIds: ['crew-alex', 'crew-sam', 'crew-ani'],
        },
        {
          id: 'evt-civic-centre-packout',
          type: 'pack_out',
          label: 'Pack out',
          start: '2026-03-20T18:00',
          end: '2026-03-20T22:00',
          crewIds: ['crew-sam', 'crew-ani'],
        },
      ],
    },
    {
      id: 'evt-production-awards',
      salesOrder: 'SO-4819',
      title: 'Production: Regional Awards',
      isProduction: true,
      assignedVehicleIds: ['veh-van', 'veh-hiace'],
      notes: 'Show time locked; client wants extra RF scan.',
      blocks: [
        {
          id: 'evt-production-awards-packin',
          type: 'pack_in',
          label: 'Pack in',
          start: '2026-03-17T07:00',
          end: '2026-03-17T12:00',
          crewIds: ['crew-ty', 'crew-ani'],
        },
        {
          id: 'evt-production-awards-show',
          type: 'show',
          label: 'Show call',
          start: '2026-03-19T18:30',
          end: '2026-03-19T22:30',
          crewIds: ['crew-alex', 'crew-jo', 'crew-sam'],
        },
        {
          id: 'evt-production-awards-packout',
          type: 'pack_out',
          label: 'Pack out',
          start: '2026-03-20T23:00',
          end: '2026-03-21T02:00',
          crewIds: ['crew-ty', 'crew-ani'],
        },
      ],
    },
    {
      id: 'evt-arena-rehearsal',
      salesOrder: 'SO-4824',
      title: 'Arena Rehearsal & Pack out',
      isProduction: true,
      assignedVehicleIds: ['veh-truck'],
      notes: 'Lighting console swap available in truck.',
      blocks: [
        {
          id: 'evt-arena-rehearsal-packin',
          type: 'pack_in',
          label: 'Pack in',
          start: '2026-03-18T11:00',
          end: '2026-03-18T15:00',
          crewIds: ['crew-jo', 'crew-cam'],
        },
        {
          id: 'evt-arena-rehearsal-show',
          type: 'show',
          label: 'Show call',
          start: '2026-03-18T19:00',
          end: '2026-03-18T22:00',
          crewIds: ['crew-jo', 'crew-sam'],
        },
        {
          id: 'evt-arena-rehearsal-packout',
          type: 'pack_out',
          label: 'Pack out',
          start: '2026-03-19T08:00',
          end: '2026-03-19T11:00',
          crewIds: ['crew-cam', 'crew-ani'],
        },
      ],
    },
    {
      id: 'evt-campus-gala',
      salesOrder: 'SO-4827',
      title: 'Campus Gala Reception',
      isProduction: false,
      assignedVehicleIds: ['veh-regius'],
      notes: 'Dinner service in ballroom; quiet pack in.',
      blocks: [
        {
          id: 'evt-campus-gala-packin',
          type: 'pack_in',
          label: 'Pack in',
          start: '2026-03-21T09:30',
          end: '2026-03-21T12:30',
          crewIds: ['crew-alex', 'crew-ani'],
        },
        {
          id: 'evt-campus-gala-packout',
          type: 'pack_out',
          label: 'Pack out',
          start: '2026-03-22T08:00',
          end: '2026-03-22T10:30',
          crewIds: ['crew-ty', 'crew-ani'],
        },
      ],
    },
  ];

  readonly typeLabels: Record<CrewBlock['type'], string> = {
    pack_in: 'Pack in',
    pack_out: 'Pack out',
    show: 'Show time',
  };

  constructor() {
    this.anchorDate = this.computeAnchorDate();
    this.calculateWeek();
  }

  getWeekRange(baseDate: Date) {
    const start = new Date(baseDate);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // align to Monday
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  calculateWeek() {
    const baseDate = new Date(this.anchorDate);
    baseDate.setDate(this.anchorDate.getDate() + this.weekOffset * 7);
    this.weekRange = this.getWeekRange(baseDate);
  }

  prevWeek() {
    this.weekOffset -= 1;
    this.calculateWeek();
  }

  nextWeek() {
    this.weekOffset += 1;
    this.calculateWeek();
  }

  get weekDays(): Date[] {
    const days: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(this.weekRange.start);
      day.setDate(this.weekRange.start.getDate() + i);
      days.push(day);
    }
    return days;
  }

  private isWithinWeek(date: Date) {
    return date >= this.weekRange.start && date <= this.weekRange.end;
  }

  private computeAnchorDate() {
    const allDates = this.events
      .flatMap((event) => event.blocks)
      .map((block) => new Date(block.start).getTime());

    if (!allDates.length) return new Date();

    const earliest = Math.min(...allDates);
    return new Date(earliest);
  }

  private flattenBlocks(): DayBlock[] {
    return this.events
      .flatMap((event) =>
        event.blocks.map((block) => ({
          event,
          block,
        })),
      )
      .filter(({ block }) => this.isWithinWeek(new Date(block.start)));
  }

  getDayBlocks(date: Date): DayBlock[] {
    const target = date.toDateString();
    const dayBlocks = this.flattenBlocks().filter(
      ({ block }) => new Date(block.start).toDateString() === target,
    );

    return this.sortBlocks(dayBlocks);
  }

  private sortBlocks(blocks: DayBlock[]): DayBlock[] {
    if (this.viewMode === 'chronological') {
      return blocks.sort(
        (a, b) =>
          new Date(a.block.start).getTime() - new Date(b.block.start).getTime(),
      );
    }

    // Pack-in first, then everything else by time
    const packIns = blocks
      .filter(({ block }) => block.type === 'pack_in')
      .sort(
        (a, b) =>
          new Date(a.block.start).getTime() - new Date(b.block.start).getTime(),
      );
    const others = blocks
      .filter(({ block }) => block.type !== 'pack_in')
      .sort(
        (a, b) =>
          new Date(a.block.start).getTime() - new Date(b.block.start).getTime(),
      );

    return [...packIns, ...others];
  }

  crewConflicts(target: DayBlock): string[] {
    const conflicts = new Set<string>();
    const targetStart = new Date(target.block.start).getTime();
    const targetEnd = new Date(target.block.end).getTime();

    this.flattenBlocks().forEach(({ block, event }) => {
      if (block.id === target.block.id) return;
      const start = new Date(block.start).getTime();
      const end = new Date(block.end).getTime();
      const overlaps = targetStart < end && start < targetEnd;
      if (!overlaps) return;

      target.block.crewIds.forEach((crewId) => {
        if (block.crewIds.includes(crewId) && event.id !== target.event.id) {
          const name = this.crew.find((c) => c.id === crewId)?.name;
          if (name) conflicts.add(name);
        }
      });
    });

    return Array.from(conflicts);
  }

  vehicleStatus(event: CrewEvent, referenceDate: Date) {
    const statuses = event.assignedVehicleIds.map((vehicleId) => {
      const vehicle = this.vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) return null;

      const wofDate = new Date(vehicle.wofExpiry);
      const daysUntilExpiry = Math.floor(
        (wofDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry < 0) {
        return `${vehicle.name}: WOF expired`;
      }
      if (daysUntilExpiry <= 14) {
        return `${vehicle.name}: WOF expiring in ${daysUntilExpiry} day(s)`;
      }
      return null;
    });

    return statuses.filter((status) => !!status) as string[];
  }

  toggleVehicle(event: CrewEvent, vehicleId: string) {
    if (event.assignedVehicleIds.includes(vehicleId)) {
      event.assignedVehicleIds = event.assignedVehicleIds.filter(
        (id) => id !== vehicleId,
      );
    } else {
      event.assignedVehicleIds = [...event.assignedVehicleIds, vehicleId];
    }
  }
}

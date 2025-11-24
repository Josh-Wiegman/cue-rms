import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { Panel } from '../../shared/panel/panel';

type TrendDirection = 'up' | 'down';

interface DashboardStat {
  label: string;
  value: string;
  helper: string;
  trend?: {
    direction: TrendDirection;
    value: string;
  };
}

interface ProductionBooking {
  production: string;
  client: string;
  location: string;
  schedule: string;
  status: {
    key: 'confirmed' | 'hold' | 'draft';
    label: string;
  };
  focus: string[];
}

interface PrepQueueItem {
  picklist: string;
  owner: string;
  due: string;
  stage: {
    key: 'pulling' | 'staged' | 'qa';
    label: string;
  };
  progress: number;
}

interface LogisticsEvent {
  route: string;
  vehicle: string;
  driver: string;
  depart: string;
  status: {
    key: 'on-dock' | 'en-route' | 'returned';
    label: string;
  };
}

interface UtilizationRow {
  category: string;
  allocated: number;
  available: number;
  conflicts: number;
}

interface ServiceTicket {
  item: string;
  issue: string;
  technician: string;
  status: {
    key: 'in-repair' | 'awaiting-parts' | 'cleared';
    label: string;
  };
  eta: string;
}

interface CrewNote {
  title: string;
  author: string;
  timestamp: string;
  description: string;
}

@Component({
  selector: 'home-component',
  imports: [CommonModule, UiShellComponent, Panel],
  templateUrl: './home-component.html',
  styleUrl: './home-component.scss',
})
export class HomeComponent {
  readonly today = new Date();

  readonly headlineStats: DashboardStat[] = [
    {
      label: 'Jobs scheduled this week',
      value: '18 projects',
      helper: '6 loading today across two warehouses',
      trend: { direction: 'up', value: '+3 vs last week' },
    },
    {
      label: 'Gear prepped & staged',
      value: '74 kits',
      helper: 'Across 12 production picklists',
      trend: { direction: 'up', value: '92% warehouse readiness' },
    },
    {
      label: 'Late returns to chase',
      value: '5 orders',
      helper: 'Three with penalty risk',
      trend: { direction: 'down', value: '−2 overnight' },
    },
    {
      label: 'Revenue forecast (30d)',
      value: '$486k',
      helper: 'Confirmed and provisional bookings',
    },
  ];

  readonly productionBookings: ProductionBooking[] = [
    {
      production: 'Aurora Awards 2024',
      client: 'Brightline Agency',
      location: 'Pier 27 • San Francisco',
      schedule: 'Load-in Wed 07:00 • Strike Fri 01:00',
      status: { key: 'confirmed', label: 'Confirmed' },
      focus: ['LED wall', 'Broadcast audio', 'Wireless comms'],
    },
    {
      production: 'Summer Beats Festival',
      client: 'Live Nation',
      location: 'Shoreline Amphitheatre',
      schedule: 'Load-in Thu 06:00 • Show Sat 18:00',
      status: { key: 'hold', label: 'On hold' },
      focus: ['Line array', 'Backline', 'Generators'],
    },
    {
      production: 'Product Launch XR Stage',
      client: 'Northwind Labs',
      location: 'Cue Studios • Stage B',
      schedule: 'Tech rehearsal Tue 13:00 • Stream Wed 10:00',
      status: { key: 'confirmed', label: 'Confirmed' },
      focus: ['Cameras', 'Media servers', 'Lighting control'],
    },
    {
      production: 'City Council Hybrid Meeting',
      client: 'City of Redwood',
      location: 'Civic Center Chambers',
      schedule: 'Install Mon 05:30 • Pickup Tue 20:00',
      status: { key: 'draft', label: 'Draft' },
      focus: ['Streaming kits', 'Wireless mics'],
    },
  ];

  readonly prepQueue: PrepQueueItem[] = [
    {
      picklist: 'PL-4821 • Aurora Awards main show',
      owner: 'Lead tech · Morgan Rivers',
      due: 'Staging due 3:00 PM',
      stage: { key: 'pulling', label: 'Pulling gear' },
      progress: 48,
    },
    {
      picklist: 'PL-4814 • XR stage camera package',
      owner: 'Lead tech · Daria Patel',
      due: 'QA scan due 5:30 PM',
      stage: { key: 'qa', label: 'Awaiting QA' },
      progress: 76,
    },
    {
      picklist: 'PL-4802 • City council hybrid',
      owner: 'Lead tech · Colin Wu',
      due: 'Load-out call 6:00 AM',
      stage: { key: 'staged', label: 'Staged & wrapped' },
      progress: 100,
    },
  ];

  readonly logisticsBoard: LogisticsEvent[] = [
    {
      route: 'Route 12 • Pier 27 dock',
      vehicle: '53’ trailer · Fleet 4',
      driver: 'Driver: K. Thompson',
      depart: 'Departing 04:30 AM',
      status: { key: 'on-dock', label: 'On dock' },
    },
    {
      route: 'Route 6 • Shoreline Amphitheatre',
      vehicle: '26’ box truck · Fleet 9',
      driver: 'Driver: J. Sanchez',
      depart: 'Rolling 09:15 AM',
      status: { key: 'en-route', label: 'En route' },
    },
    {
      route: 'Route 3 • Cue Studios return',
      vehicle: 'Sprinter • Fleet 12',
      driver: 'Driver: R. Patel',
      depart: 'Arrived 11:40 PM',
      status: { key: 'returned', label: 'Returned' },
    },
  ];

  readonly utilization: UtilizationRow[] = [
    { category: 'Audio consoles', allocated: 14, available: 18, conflicts: 1 },
    { category: 'LED tiles', allocated: 920, available: 1100, conflicts: 0 },
    { category: 'Moving lights', allocated: 86, available: 120, conflicts: 3 },
    { category: 'Camera chains', allocated: 9, available: 12, conflicts: 1 },
  ];

  readonly serviceTickets: ServiceTicket[] = [
    {
      item: 'MA3 light console',
      issue: 'Encoder wheel intermittent',
      technician: 'Tech: J. Malone',
      status: { key: 'in-repair', label: 'In repair' },
      eta: 'Bench checkout Thu',
    },
    {
      item: 'Shure ADX2 transmitter',
      issue: 'RF board replacement',
      technician: 'Tech: S. Yu',
      status: { key: 'awaiting-parts', label: 'Awaiting parts' },
      eta: 'Parts ETA Friday',
    },
    {
      item: 'Panasonic UE160 PTZ',
      issue: 'Optics recalibration',
      technician: 'Tech: A. Romero',
      status: { key: 'cleared', label: 'Ready for pickup' },
      eta: 'Ready 2:30 PM',
    },
  ];

  readonly crewNotes: CrewNote[] = [
    {
      title: 'RF coordination locked for Summer Beats',
      author: 'Posted by Avery · RF',
      timestamp: 'Today 09:15',
      description:
        'Final coordination sheet uploaded to the project files. Double-check spare packs before cases close.',
    },
    {
      title: 'Generator load test complete',
      author: 'Posted by Malik · Facilities',
      timestamp: 'Today 08:20',
      description:
        'Both 125kVA units passed load test. Fuel logs updated and staged for Route 6 dispatch.',
    },
    {
      title: 'Need extra fiber jumpers',
      author: 'Posted by Erin · Video',
      timestamp: 'Yesterday 16:45',
      description:
        'XR stage now requires four additional single-mode 100’ jumpers. Please add to PL-4814 before QA.',
    },
  ];
}

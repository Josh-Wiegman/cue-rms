import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
} from '@angular/core';

type PresentConfig = {
  id: number;
  x: number; // %
  y: number; // % (converted from original y/5)
  side: 'left' | 'right';
  message: string;
  opened: boolean;
  ornaments: { leftPct: number; bottomPx: number; color: string }[];
  garlands: { widthPx: number; bottomPx: number }[];
  lights: {
    leftPct: number;
    bottomPx: number;
    color: string;
    delayS: number;
  }[];
};

type Snowflake = {
  id: number;
  leftPct: number;
  fontSizeEm: number;
  durationS: number;
  delayS: number;
};

type Confetti = {
  id: number;
  leftPct: number;
  delayS: number;
  color: string;
};

type Star = {
  id: number;
  leftPct: number;
  topPct: number;
  delayS: number;
};

@Component({
  selector: 'app-christmas-present-hunt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './xmas.component.html',
  styleUrls: ['./xmas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChristmasPresentHuntComponent implements AfterViewInit, OnDestroy {
  titleText = 'Click the presents for a surprise!';

  // Same messages + coords as original
  private baseMessages = [
    {
      message: 'Haha you thought this had a present, try another one.',
      x: 3,
      y: 15,
    },
    {
      message: 'Nope, just more tinsel in this one. Keep hunting!',
      x: 13,
      y: 40,
    },
    {
      message: 'Rudolph ate the gift in here. Maybe the next box?',
      x: 25,
      y: 65,
    },
    {
      message: 'Santa said this one is only filled with giggles.',
      x: 38,
      y: 25,
    },
    { message: "Plot twist: it's empty wrapping paper. Next!", x: 51, y: 80 },
    { message: 'Elves are on break, so this box is a decoy.', x: 63, y: 35 },
    {
      message: 'This one contains... dramatic suspense. Keep going!',
      x: 75,
      y: 55,
    },
    { message: 'Almost there! But this gift took a holiday.', x: 85, y: 20 },
    { message: 'Close! This present is just jingling bells.', x: 92, y: 70 },
    {
      message: "Whoops, this one's stuffed with candy wrappers.",
      x: 45,
      y: 45,
    },
  ];

  finalMessage =
    "Merry Christmas Mum & Dad, TeAna and I have booked you in for a nice meal at the Central Fire Station Bistro in Napier, we hope you enjoy (it's got good reviews lol). Love you guys!";

  presents: PresentConfig[] = [];

  snowmen = [{ x: 20 }, { x: 55 }, { x: 80 }];

  festoonBulbs: { leftPct: number; color: string; delayS: number }[] = [];

  // Snow is rendered as items inside the snow container
  snowflakes: Snowflake[] = [];

  // Overlays / celebration
  activeMessage: { text: string; isFinal: boolean } | null = null;
  confetti: Confetti[] = [];
  stars: Star[] = [];

  private clickedCount = 0;

  private snowInterval: number | null = null;
  private snowId = 0;
  private confettiId = 0;
  private starId = 0;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.initScene();
    this.startSnow();
  }

  ngOnDestroy(): void {
    if (this.snowInterval !== null) {
      window.clearInterval(this.snowInterval);
    }
  }

  onPresentClick(p: PresentConfig, ev: MouseEvent): void {
    ev.stopPropagation();
    if (p.opened) return;

    p.opened = true;
    this.clickedCount++;

    if (this.clickedCount === this.presents.length) {
      this.showFinalMessage();
    } else {
      this.showMessage(p.message);
    }

    this.cdr.markForCheck();
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  // -----------------------------
  // Init / Build
  // -----------------------------
  private initScene(): void {
    const shuffled = this.shuffle([...this.baseMessages]);

    const leftSide = new Set([0, 3, 7]);

    const ornamentColors = [
      '#ff0000',
      '#ffd700',
      '#0000ff',
      '#ff69b4',
      '#9370db',
    ];
    const lightColors = [
      '#ff0000',
      '#ffd700',
      '#00ff00',
      '#0000ff',
      '#ff69b4',
      '#ffff00',
    ];

    this.presents = shuffled.map((m, i) => {
      // ornaments
      const ornaments = Array.from({ length: 6 }).map(() => ({
        color:
          ornamentColors[Math.floor(Math.random() * ornamentColors.length)],
        leftPct: 20 + Math.random() * 60,
        bottomPx: 15 + Math.random() * 100,
      }));

      // garlands (same logic: 3 lines)
      const garlands = [1, 2, 3].map((k) => ({
        widthPx: 90 - k * 20,
        bottomPx: 30 + k * 30,
      }));

      // lights
      const numLights = 6 + Math.floor(Math.random() * 4);
      const lights = Array.from({ length: numLights }).map(() => ({
        color: lightColors[Math.floor(Math.random() * lightColors.length)],
        leftPct: 20 + Math.random() * 60,
        bottomPx: 10 + Math.random() * 110,
        delayS: Math.random() * 1.5,
      }));

      return {
        id: i,
        x: m.x,
        y: m.y / 5,
        side: leftSide.has(i) ? 'left' : 'right',
        message: m.message,
        opened: false,
        ornaments,
        garlands,
        lights,
      };
    });

    // Festoon
    const colors = ['#c41e3a', '#ffd700', '#228b22', '#4169e1', '#ff69b4'];
    this.festoonBulbs = Array.from({ length: 20 }).map((_, i) => ({
      leftPct: i * 5 + 2,
      color: colors[i % colors.length],
      delayS: i * 0.1,
    }));

    // initial snow burst (50 like original)
    for (let i = 0; i < 50; i++) this.addSnowflake();

    this.cdr.markForCheck();
  }

  // -----------------------------
  // Messages
  // -----------------------------
  private showMessage(text: string): void {
    this.activeMessage = { text, isFinal: false };
    this.cdr.markForCheck();

    window.setTimeout(() => {
      // only clear if it's still the same "non-final" type message
      if (this.activeMessage && !this.activeMessage.isFinal) {
        this.activeMessage = null;
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  private showFinalMessage(): void {
    this.activeMessage = { text: this.finalMessage, isFinal: true };
    this.cdr.markForCheck();

    this.createConfetti();
    this.intensifySnow();
    this.addStars();
  }

  // -----------------------------
  // Snow
  // -----------------------------
  private startSnow(): void {
    this.snowInterval = window.setInterval(() => this.addSnowflake(), 200);
  }

  private addSnowflake(): void {
    const flake: Snowflake = {
      id: ++this.snowId,
      leftPct: Math.random() * 100,
      fontSizeEm: Math.random() * 1.5 + 0.5,
      durationS: Math.random() * 3 + 2,
      delayS: Math.random() * 2,
    };

    this.snowflakes.push(flake);
    this.cdr.markForCheck();

    window.setTimeout(() => {
      this.snowflakes = this.snowflakes.filter((s) => s.id !== flake.id);
      this.cdr.markForCheck();
    }, 5000);
  }

  private intensifySnow(): void {
    for (let i = 0; i < 50; i++) this.addSnowflake();
  }

  // -----------------------------
  // Celebration
  // -----------------------------
  private createConfetti(): void {
    const colors = ['#c41e3a', '#ffd700', '#228b22', '#ffffff', '#4169e1'];

    for (let i = 0; i < 100; i++) {
      window.setTimeout(() => {
        const c: Confetti = {
          id: ++this.confettiId,
          leftPct: Math.random() * 100,
          delayS: Math.random() * 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
        };

        this.confetti.push(c);
        this.cdr.markForCheck();

        window.setTimeout(() => {
          this.confetti = this.confetti.filter((x) => x.id !== c.id);
          this.cdr.markForCheck();
        }, 3000);
      }, i * 30);
    }
  }

  private addStars(): void {
    const next: Star[] = [];
    for (let i = 0; i < 20; i++) {
      next.push({
        id: ++this.starId,
        leftPct: Math.random() * 100,
        topPct: Math.random() * 50,
        delayS: Math.random() * 2,
      });
    }
    this.stars = [...this.stars, ...next];
    this.cdr.markForCheck();
  }

  // -----------------------------
  // Utils
  // -----------------------------
  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

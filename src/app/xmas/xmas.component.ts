import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Present {
  message: string;
  special?: boolean;
  opened?: boolean;
  offset?: number;
  lift?: number;
  rotation?: number;
  x?: number;
  y?: number;
}

@Component({
  selector: 'app-xmas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './xmas.component.html',
  styleUrls: ['./xmas.component.scss'],
})
export class XmasComponent {
  snowflakes = Array.from({ length: 120 }, (_, index) => index);

  presents: Present[] = [
    { message: "Haha you thought this had a present, try another one.", offset: -44, lift: -10, rotation: -8, x: 18, y: 18 },
    { message: "Nope, just more tinsel in this one. Keep hunting!", offset: 32, lift: -6, rotation: 5, x: 36, y: 24 },
    { message: "Rudolph ate the gift in here. Maybe the next box?", offset: -16, lift: -4, rotation: -3, x: 58, y: 20 },
    { message: "Santa said this one is only filled with giggles.", offset: 46, lift: -14, rotation: 7, x: 72, y: 32 },
    { message: "Plot twist: it's empty wrapping paper. Next!", offset: -52, lift: -12, rotation: -6, x: 14, y: 38 },
    { message: "Elves are on break, so this box is a decoy.", offset: 22, lift: -8, rotation: 4, x: 34, y: 46 },
    { message: "This one contains... dramatic suspense. Keep going!", offset: -28, lift: -10, rotation: -5, x: 52, y: 40 },
    { message: "Almost there! But this gift took a holiday.", offset: 40, lift: -10, rotation: 6, x: 68, y: 48 },
    { message: "Close! This present is just jingling bells.", offset: -18, lift: -8, rotation: -4, x: 44, y: 58 },
    {
      message:
        "Merry Christmas Mum & Dad, TeAna and I have booked you in for a nice meal at the Central Fire Station Bistro in Napier, we hope you enjoy (it's got good reviews lol). Love you guys!",
      special: true,
      offset: 28,
      lift: -6,
      rotation: 5,
      x: 62,
      y: 62,
    },
  ];

  activeMessage = '';
  isGrandReveal = false;

  openPresent(index: number): void {
    const present = this.presents[index];
    present.opened = true;
    this.activeMessage = present.message;
    this.isGrandReveal = !!present.special;
  }
}

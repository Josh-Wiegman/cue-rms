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
    { message: "Haha you thought this had a present, try another one.", offset: -44, lift: -10, rotation: -8, x: 12, y: 14 },
    { message: "Nope, just more tinsel in this one. Keep hunting!", offset: 32, lift: -6, rotation: 5, x: 30, y: 20 },
    { message: "Rudolph ate the gift in here. Maybe the next box?", offset: -16, lift: -4, rotation: -3, x: 55, y: 16 },
    { message: "Santa said this one is only filled with giggles.", offset: 46, lift: -14, rotation: 7, x: 76, y: 22 },
    { message: "Plot twist: it's empty wrapping paper. Next!", offset: -52, lift: -12, rotation: -6, x: 18, y: 38 },
    { message: "Elves are on break, so this box is a decoy.", offset: 22, lift: -8, rotation: 4, x: 42, y: 34 },
    { message: "This one contains... dramatic suspense. Keep going!", offset: -28, lift: -10, rotation: -5, x: 64, y: 36 },
    { message: "Almost there! But this gift took a holiday.", offset: 40, lift: -10, rotation: 6, x: 86, y: 34 },
    { message: "Close! This present is just jingling bells.", offset: -18, lift: -8, rotation: -4, x: 34, y: 56 },
    {
      message:
        "Merry Christmas Mum & Dad, TeAna and I have booked you in for a nice meal at the Central Fire Station Bistro in Napier, we hope you enjoy (it's got good reviews lol). Love you guys!",
      special: true,
      offset: 28,
      lift: -6,
      rotation: 5,
      x: 64,
      y: 58,
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

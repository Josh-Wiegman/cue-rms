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
    { message: "Haha you thought this had a present, try another one.", offset: -52, lift: -10, rotation: -8, x: 10, y: 12 },
    { message: "Nope, just more tinsel in this one. Keep hunting!", offset: 30, lift: -6, rotation: 5, x: 26, y: 30 },
    { message: "Rudolph ate the gift in here. Maybe the next box?", offset: -18, lift: -4, rotation: -3, x: 46, y: 52 },
    { message: "Santa said this one is only filled with giggles.", offset: 52, lift: -14, rotation: 7, x: 70, y: 70 },
    { message: "Plot twist: it's empty wrapping paper. Next!", offset: -44, lift: -12, rotation: -6, x: 16, y: 88 },
    { message: "Elves are on break, so this box is a decoy.", offset: 26, lift: -8, rotation: 4, x: 38, y: 22 },
    { message: "This one contains... dramatic suspense. Keep going!", offset: -32, lift: -10, rotation: -5, x: 58, y: 44 },
    { message: "Almost there! But this gift took a holiday.", offset: 42, lift: -10, rotation: 6, x: 82, y: 60 },
    { message: "Close! This present is just jingling bells.", offset: -24, lift: -8, rotation: -4, x: 32, y: 76 },
    { message: "Whoops, this one's stuffed with candy wrappers.", offset: 36, lift: -6, rotation: 5, x: 62, y: 94 },
  ];

  activeMessage = '';
  isGrandReveal = false;

  private grandMessage =
    "Merry Christmas Mum & Dad, TeAna and I have booked you in for a nice meal at the Central Fire Station Bistro in Napier, we hope you enjoy (it's got good reviews lol). Love you guys!";

  constructor() {
    const specialIndex = Math.floor(Math.random() * this.presents.length);
    this.presents = this.presents.map((present, index) =>
      index === specialIndex ? { ...present, special: true, message: this.grandMessage } : present,
    );
  }

  openPresent(index: number): void {
    const present = this.presents[index];
    present.opened = true;
    this.activeMessage = present.message;
    this.isGrandReveal = !!present.special;
  }
}

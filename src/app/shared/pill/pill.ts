import { booleanAttribute, Component, Input } from '@angular/core';

export type PillState = 'warning' | 'success' | 'error' | 'accent' | 'default';

@Component({
  selector: 'cg-pill',
  imports: [],
  templateUrl: './pill.html',
  styleUrl: './pill.scss',
})
export class Pill {
  @Input({ required: true })
  label!: string;

  @Input()
  state: PillState = 'default';

  @Input({ transform: booleanAttribute })
  hero?: boolean;
}

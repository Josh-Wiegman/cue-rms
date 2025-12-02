import { booleanAttribute, Component, Input } from '@angular/core';

@Component({
  selector: 'cg-panel',
  imports: [],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  protected borderRadii = {
    none: '0',
    more: '1.25rem',
    less: '0.75rem',
    normal: '1rem',
  };
  @Input()
  borderRadius: keyof typeof this.borderRadii = 'normal';

  @Input({ transform: booleanAttribute })
  hero?: boolean;

  @Input({ transform: booleanAttribute })
  selected?: boolean;

  @Input({ transform: booleanAttribute })
  hoverable?: boolean;

  @Input({ transform: booleanAttribute })
  sticky?: boolean;

  @Input({ transform: booleanAttribute })
  noPadding?: boolean;
}

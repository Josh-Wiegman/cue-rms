import { booleanAttribute, Component, Input } from '@angular/core';

@Component({
  selector: 'dropdown-menu',
  imports: [],
  templateUrl: './dropdown-menu.html',
  styleUrl: './dropdown-menu.scss',
})
export class DropdownMenu {
  @Input({ transform: booleanAttribute })
  iconOnly: boolean = false;

  @Input({ transform: booleanAttribute })
  horizontal: boolean = false;

  @Input()
  iconPath?: string;

  @Input({ required: true })
  menuLabel!: string;
}

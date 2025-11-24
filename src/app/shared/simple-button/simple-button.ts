import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'cg-simple-button',
  imports: [],
  templateUrl: './simple-button.html',
  styleUrl: './simple-button.scss',
})
export class SimpleButton {
  @Input()
  buttonStyle: 'primary' | 'secondary' | 'tertiary' | 'ghost' = 'ghost';

  @Input({ required: true })
  buttonLabel!: string;

  @Output()
  onClick = new EventEmitter<void>();

  @Input()
  disabled?: boolean;

  handleClick() {
    if (this.disabled) return;

    this.onClick.emit();
  }
}

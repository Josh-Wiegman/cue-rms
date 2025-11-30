import { PillState } from '../../shared/pill/pill';
import { StageTimerStatus } from '../stage-timer.models';

export function mapStatusToPillState(status: StageTimerStatus): PillState {
  const states = {
    idle: 'default',
    running: 'success',
    paused: 'warning',
    completed: 'default',
  };

  return (states[status] ?? 'default') as PillState;
}

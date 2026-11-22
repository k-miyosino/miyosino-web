import { OpsCadence, OpsTask } from '@/types/ops';

export interface Badge {
  label: string;
  className: string;
}

/** タスクの状態の表示（期限付きで余裕があるものは、まだ対応していないので「まだ先」） */
export function taskBadge(task: OpsTask): Badge {
  switch (task.status) {
    case 'overdue':
      return { label: '期限切れ', className: 'bg-red-100 text-red-800' };
    case 'soon':
      return { label: 'もうすぐ', className: 'bg-yellow-100 text-yellow-800' };
    case 'done':
      return { label: '完了', className: 'bg-gray-100 text-gray-700' };
    case 'event':
      return { label: 'そのときに', className: 'bg-blue-100 text-blue-800' };
    default:
      return task.cadence.type === 'deadline'
        ? { label: 'まだ先', className: 'bg-green-100 text-green-800' }
        : { label: '対応済み', className: 'bg-green-100 text-green-800' };
  }
}

export function cadenceLabel(cadence: OpsCadence): string {
  switch (cadence.type) {
    case 'monthly':
      return '月に1回';
    case 'yearly':
      return '年に1回';
    case 'deadline':
      return `${cadence.date} までに`;
    case 'event':
      return cadence.when;
  }
}

/** 次の期限の表示（期限付きは周期の欄に日付が出るので、ここでは出さない） */
export function dueLabel(task: OpsTask): string {
  const periodic =
    task.cadence.type === 'monthly' || task.cadence.type === 'yearly';
  return periodic && task.dueDate ? task.dueDate : '—';
}

export function needsAttention(task: OpsTask): boolean {
  return task.status === 'overdue' || task.status === 'soon';
}

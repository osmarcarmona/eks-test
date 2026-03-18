import { Task } from '../api/tasks';

interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export default function TaskItem({ task, onEdit, onDelete }: TaskItemProps) {
  return (
    <li className="task-item">
      <div className="task-info">
        <strong>{task.title}</strong>
        {task.description && <p>{task.description}</p>}
        <span className={`status status-${task.status}`}>
          {STATUS_LABELS[task.status] ?? task.status}
        </span>
      </div>
      <div className="task-actions">
        <button onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}>
          Edit
        </button>
        <button onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>
          Delete
        </button>
      </div>
    </li>
  );
}

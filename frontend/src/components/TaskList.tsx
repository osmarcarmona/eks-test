import { Task } from '../api/tasks';
import TaskItem from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  error: string;
  loading: boolean;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskList({ tasks, error, loading, onEdit, onDelete }: TaskListProps) {
  if (loading) return <p>Loading tasks…</p>;
  if (error) return <p className="error" role="alert">{error}</p>;
  if (tasks.length === 0) return <p>No tasks yet. Create one above.</p>;

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
  );
}

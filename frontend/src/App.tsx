import { useState, useEffect, useCallback } from 'react';
import {
  Task,
  TaskPayload,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from './api/tasks';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTasks(await getTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function handleSubmit(payload: TaskPayload) {
    if (editingTask) {
      const updated = await updateTask(editingTask.id, payload);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTask(null);
    } else {
      const created = await createTask(payload);
      setTasks((prev) => [...prev, created]);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }

  return (
    <div className="app">
      <h1>Task Manager</h1>
      <TaskForm
        editingTask={editingTask}
        onSubmit={handleSubmit}
        onCancel={() => setEditingTask(null)}
      />
      <TaskList
        tasks={tasks}
        error={error}
        loading={loading}
        onEdit={setEditingTask}
        onDelete={handleDelete}
      />
    </div>
  );
}

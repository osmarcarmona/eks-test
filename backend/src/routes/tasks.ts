import { Router, Request, Response } from 'express';
import { TaskRepository } from '../repository/taskRepository';
import { validateTaskPayload } from '../models/task';

export function createTaskRouter(repository: TaskRepository): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const result = validateTaskPayload(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    try {
      const task = await repository.create(result.data);
      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const tasks = await repository.getAll();
      res.status(200).json(tasks);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const task = await repository.getById(req.params.id);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.status(200).json(task);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/:id', async (req: Request, res: Response) => {
    const result = validateTaskPayload(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    try {
      const task = await repository.update(req.params.id, result.data);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.status(200).json(task);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await repository.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

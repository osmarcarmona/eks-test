export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPayload {
  title: string;
  description?: string;
  status?: string;
}

const VALID_STATUSES = ['todo', 'in_progress', 'done'];

export interface ValidationError {
  error: string;
}

export function validateTaskPayload(
  payload: unknown
): { valid: true; data: TaskPayload } | { valid: false; error: string } {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { valid: false, error: 'Payload must be a JSON object' };
  }

  const obj = payload as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    return { valid: false, error: 'Title is required and must be a non-empty string' };
  }

  if (obj.status !== undefined) {
    if (typeof obj.status !== 'string' || !VALID_STATUSES.includes(obj.status)) {
      return {
        valid: false,
        error: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
      };
    }
  }

  return {
    valid: true,
    data: {
      title: obj.title.trim(),
      description: typeof obj.description === 'string' ? obj.description : '',
      status: typeof obj.status === 'string' ? obj.status : 'todo',
    },
  };
}

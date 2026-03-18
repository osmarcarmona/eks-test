import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskPayload } from '../models/task';

export class TaskRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async create(payload: TaskPayload): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      title: payload.title,
      description: payload.description ?? '',
      status: payload.status ?? 'todo',
      createdAt: now,
      updatedAt: now,
    };

    await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item: task })
    );

    return task;
  }

  async getById(id: string): Promise<Task | null> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: { id } })
    );

    return (result.Item as Task) ?? null;
  }

  async getAll(): Promise<Task[]> {
    const result = await this.docClient.send(
      new ScanCommand({ TableName: this.tableName })
    );

    return (result.Items as Task[]) ?? [];
  }

  async update(id: string, payload: TaskPayload): Promise<Task | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: 'SET title = :title, description = :desc, #s = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':title': payload.title,
          ':desc': payload.description ?? existing.description,
          ':status': payload.status ?? existing.status,
          ':updatedAt': now,
        },
      })
    );

    return {
      ...existing,
      title: payload.title,
      description: payload.description ?? existing.description,
      status: payload.status ?? existing.status,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    await this.docClient.send(
      new DeleteCommand({ TableName: this.tableName, Key: { id } })
    );

    return true;
  }
}

import express from 'express';
import cors from 'cors';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import healthRouter from './routes/health';
import { createTaskRouter } from './routes/tasks';
import { TaskRepository } from './repository/taskRepository';

export function createApp(docClient?: DynamoDBDocumentClient, tableName?: string) {
  const app = express();

  app.use(express.json());
  app.use(cors());

  const table = tableName ?? process.env.TABLE_NAME ?? 'Tasks';

  const client = docClient ?? DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
  );

  const taskRepository = new TaskRepository(client, table);

  app.use('/api/health', healthRouter);
  app.use('/api/tasks', createTaskRouter(taskRepository));

  return app;
}

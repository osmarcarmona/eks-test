#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { DynamoDbStack } from '../lib/dynamodb-stack';
import { EcrStack } from '../lib/ecr-stack';
import { EksStack } from '../lib/eks-stack';

const app = new cdk.App();

const vpcStack = new VpcStack(app, 'VpcStack');

const dynamoDbStack = new DynamoDbStack(app, 'DynamoDbStack');

const ecrStack = new EcrStack(app, 'EcrStack');

const eksStack = new EksStack(app, 'EksStack', {
  vpc: vpcStack.vpc,
  table: dynamoDbStack.table,
  repository: ecrStack.repository,
});

eksStack.addDependency(vpcStack);
eksStack.addDependency(dynamoDbStack);
eksStack.addDependency(ecrStack);

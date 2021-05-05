#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { InfraStack } from '../lib/infra-stack';
import { ServerlessStack } from '../lib/serverless-stack';

const app = new App();
// cross-region deployment so the environment need to be explicit
const appEnv = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};
new InfraStack(app, 'CiCdDemo', {
  githubTokenName: 'github-token',
  githubOwner: 'engr-lynx',
  githubRepo: 'cicd-demo',
  env: appEnv,
});
const serviceBaseName = 'Service';
app.node.setContext('serviceBaseName', serviceBaseName);
const serviceName = serviceBaseName; // change when multiple services already
new ServerlessStack(app, serviceName);
app.synth();

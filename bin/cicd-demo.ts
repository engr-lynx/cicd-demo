#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { RepoCloudPipelineStack } from '../lib/repo-cloud-pipeline-stack';
import { ArchiProps } from '../lib/context-helper';

const app = new App();
// cross-region deployment so the environment need to be explicit
const appEnv = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};
const archiContext = app.node.tryGetContext('archi');
const archiProps = archiContext as ArchiProps;
new RepoCloudPipelineStack(app, archiProps.id, {
  pipeline: archiProps.pipeline,
  env: appEnv,
});
app.synth();

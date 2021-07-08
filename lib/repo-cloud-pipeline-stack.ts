import { Artifact } from '@aws-cdk/aws-codepipeline';
import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { CdkPipeline, SimpleSynthAction } from '@aws-cdk/pipelines';
import { ArchiDeployStage } from './archi-deploy-stage';
import { buildRepoSourceAction } from './pipeline-helper';
import { PipelineProps } from './context-helper';

export interface RepoCloudPipelineProps extends StackProps {
  pipeline: PipelineProps,
}

export class RepoCloudPipelineStack extends Stack {

  constructor(scope: Construct, id: string, repoCloudPipelineProps: RepoCloudPipelineProps) {
    super(scope, id, repoCloudPipelineProps);
    const repoOutput = new Artifact('RepoOutput');
    const repoSource = buildRepoSourceAction(this, {
      repo: repoCloudPipelineProps.pipeline.repo,
      output: repoOutput,
    });
    const cdkOutput = new Artifact('CdkOutput');
    const cdkSynth = SimpleSynthAction.standardYarnSynth({
      sourceArtifact: repoOutput,
      cloudAssemblyArtifact: cdkOutput,
      buildCommand: 'npx yaml2json cdk.context.yaml > cdk.context.json',
    });
    const repoCloudPipeline = new CdkPipeline(this, 'RepoCloudPipeline', {
      cloudAssemblyArtifact: cdkOutput,
      sourceAction: repoSource,
      synthAction: cdkSynth,
    });
    // This is where we add the application stages
    // ...
    if (repoCloudPipelineProps.pipeline.approval?.enable) {
      const approval = repoCloudPipeline.addStage('Approval');
      approval.addManualApprovalAction();  
    }
    const archiDeploy = new ArchiDeployStage(this, 'ArchiDeploy');
    repoCloudPipeline.addApplicationStage(archiDeploy);
  }

}
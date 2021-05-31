import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Repository } from '@aws-cdk/aws-ecr';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { ManualApprovalAction, CodeBuildActionType } from '@aws-cdk/aws-codepipeline-actions';
import { buildRepoSourceAction } from './pipeline-helper';
import { PipelineProps, ContextError } from './context-helper';
import { SlsContStack } from './sls-cont-stack';
import { buildContBuildAction, buildCustomAction, buildPyInvokeAction } from './pipeline-helper'

export interface RepoSlsContPipelineProps extends StackProps {
  pipeline: PipelineProps,
  slsCont: SlsContStack,
  cacheBucket: Bucket,
}

export class RepoSlsContPipelineStack extends Stack {

  constructor(scope: Construct, id: string, repoSlsContPipelineProps: RepoSlsContPipelineProps) {
    super(scope, id, repoSlsContPipelineProps);
    const pipelineStages = [];
    const repoOutput = new Artifact('RepoOutput');
    const repoSource = buildRepoSourceAction(this, {
      repo: repoSlsContPipelineProps.pipeline.repo,
      output: repoOutput,
    });
    const sourceStage = {
      stageName: 'Source',
      actions: [
        repoSource,
      ],
    };
    pipelineStages.push(sourceStage);
    const contRepo = new Repository(this, 'ContRepo');
    const contBuild = buildContBuildAction(this, {
      repo: contRepo,
      input: repoOutput,
    });
    const buildStage = {
      stageName: 'Build',
      actions: [
        contBuild,
      ],
    };
    /* Todo:
     * optional stages (in order from build) - staging (Lambda alias)
     * config - additional commands for contSpec
     * switch Lambdas for the staging & prod API Gateways
     */
    pipelineStages.push(buildStage);
    if (repoSlsContPipelineProps.pipeline.test?.enable) {
      const specFilename = repoSlsContPipelineProps.pipeline.test?.specFilename;
      if (!specFilename) {
        throw new ContextError('Invalid test spec filename.');
      };
      const prefix = id + 'Test';
      const testAction = buildCustomAction(this, {
        prefix,
        type: CodeBuildActionType.TEST,
        specFilename,
        input: repoOutput,
        cacheBucket: repoSlsContPipelineProps.cacheBucket,
      });
      const testStage = {
        stageName: 'Test',
        actions: [
          testAction,
        ],
      };
      pipelineStages.push(testStage);
    };
    if (repoSlsContPipelineProps.pipeline.approval?.enable) {
      const approvalAction = new ManualApprovalAction({
        actionName: 'ManualApproval',
      });
      const approvalStage = {
        stageName: 'Approval',
        actions: [
          approvalAction,
        ],
      };
      pipelineStages.push(approvalStage);
    };
    const funcPolicy = {
      actions: [
        'lambda:UpdateFunctionCode',
      ],
      resources: [
        repoSlsContPipelineProps.slsCont.func.functionArn,
      ],
    };
    const repoPolicy = {
      actions: [
        'ecr:SetRepositoryPolicy',
        'ecr:GetRepositoryPolicy',
        'ecr:InitiateLayerUpload',
      ],
      resources: [
        contRepo.repositoryArn,
      ],
    };
    const params = {
      funcName: repoSlsContPipelineProps.slsCont.func.functionName,
      repoUri: contRepo.repositoryUri + ':latest',
    };
    const deployAction = buildPyInvokeAction(this, {
      prefix: 'Deploy',
      policies: [
        funcPolicy,
        repoPolicy,
      ],
      path: 'sls-cont-deploy-handler',
      handler: 'slsdeploy.on_event',
      params,
    });
    const deployStage = {
      stageName: 'Deploy',
      actions: [
        deployAction,
      ],
    };
    pipelineStages.push(deployStage);
    new Pipeline(this, 'RepoSlsContPipeline', {
      stages: pipelineStages,
      restartExecutionOnUpdate: false,
    });
  }

}

import { Construct, Stack, StackProps, Arn } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { CodeBuildActionType, S3DeployAction } from '@aws-cdk/aws-codepipeline-actions';
import { buildRepoSourceAction, buildCustomAction, buildPyInvokeAction } from './pipeline-helper';
import { PipelineProps, ContextError } from './context-helper';
import { CdnStack } from './cdn-stack';

export interface RepoCdnPipelineProps extends StackProps {
  pipeline: PipelineProps,
  cdn: CdnStack,
  cacheBucket: Bucket,
}

export class RepoCdnPipelineStack extends Stack {

  constructor(scope: Construct, id: string, repoCdnPipelineProps: RepoCdnPipelineProps) {
    super(scope, id, repoCdnPipelineProps);
    const pipelineStages = [];
    const repoOutput = new Artifact('RepoOutput');
    const repoSource = buildRepoSourceAction(this, {
      repo: repoCdnPipelineProps.pipeline.repo,
      output: repoOutput,
    });
    const sourceStage = {
      stageName: 'Source',
      actions: [
        repoSource,
      ],
    };
    pipelineStages.push(sourceStage);
    const buildOutput = new Artifact('BuildOutput');
    const buildAction = buildCustomAction(this, {
      prefix: 'Build',
      input: repoOutput,
      outputs: [
        buildOutput,
      ],
      cacheBucket: repoCdnPipelineProps.cacheBucket,
    });
    const buildStage = {
      stageName: 'Build',
      actions: [
        buildAction,
      ],
    };
    pipelineStages.push(buildStage);
    /* Todo:
     * optional stages (in order from build) - staging (2 identical cdn-stack), approval, staging cleanup (empty s3)
     * config - privileged build?
     * switch S3s for the staging & prod CloudFronts
     */
    if (repoCdnPipelineProps.pipeline.test?.enable) {
      const specFilename = repoCdnPipelineProps.pipeline.test?.specFilename;
      if (!specFilename) {
        throw new ContextError('Invalid test spec filename.');
      };
      const testAction = buildCustomAction(this, {
        prefix: 'Test',
        type: CodeBuildActionType.TEST,
        specFilename,
        input: repoOutput,
        cacheBucket: repoCdnPipelineProps.cacheBucket,
      });
      const testStage = {
        stageName: 'Test',
        actions: [
          testAction,
        ],
      };
      pipelineStages.push(testStage);
    };
    const s3Deploy = new S3DeployAction({
      actionName: 'S3Deploy',
      input: buildOutput,
      bucket: repoCdnPipelineProps.cdn.source,
    });
    const deployStage = {
      stageName: 'Deploy',
      actions: [
        s3Deploy,
      ],
    };
    pipelineStages.push(deployStage);
    const distributionId = repoCdnPipelineProps.cdn.distribution.distributionId
    const distributionArn = Arn.format({
      service: 'cloudfront',
      resource: 'distribution',
      region: '',
      resourceName: distributionId,
    }, this);
    const distributionPolicy = {
      actions: [
        'cloudfront:CreateInvalidation',
      ],
      resources: [
        distributionArn,
      ],
    };
    const params = {
      distributionId,
    };
    const invalidateAction = buildPyInvokeAction(this, {
      prefix: 'Invalidate',
      policies: [
        distributionPolicy,
      ],
      path: 'distribution-handler',
      handler: 'distribution.on_event',
      params,
    });
    const invalidateStage = {
      stageName: 'Invalidate',
      actions: [
        invalidateAction,
      ],
    };
    pipelineStages.push(invalidateStage);
    new Pipeline(this, 'RepoCdnPipeline', {
      stages: pipelineStages,
      restartExecutionOnUpdate: false,
    });
  }

}

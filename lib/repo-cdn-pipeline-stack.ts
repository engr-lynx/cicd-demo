import { join } from 'path';
import { Construct, Stack, StackProps, Arn, Duration } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { PipelineProject, LinuxBuildImage, BuildSpec, Cache } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { CodeBuildAction, CodeBuildActionType, S3DeployAction, LambdaInvokeAction } from '@aws-cdk/aws-codepipeline-actions';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { buildRepoSourceAction } from './pipeline-helper';
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
    const buildCache = Cache.bucket(repoCdnPipelineProps.cacheBucket, {
      prefix: 'build'
    });
    const linuxEnv = {
      buildImage: LinuxBuildImage.STANDARD_5_0,
    };
    const customProject = new PipelineProject(this, 'CustomProject', {
      environment: linuxEnv,
      cache: buildCache,
    });
    const buildOutput = new Artifact('BuildOutput');
    const customBuild = new CodeBuildAction({
      actionName: 'CustomBuild',
      project: customProject,
      input: repoOutput,
      outputs: [
        buildOutput,
      ],
    });
    const buildStage = {
      stageName: 'Build',
      actions: [
        customBuild,
      ],
    };
    pipelineStages.push(buildStage);
    /* Todo:
     * optional stages (in order from build) - staging (2 identical cdn-stack), approval
     * config - privileged build?
     * switch S3s for the staging & prod CloudFronts
     */
    if (repoCdnPipelineProps.pipeline.test?.enable) {
      const testSpecFilename = repoCdnPipelineProps.pipeline.test?.specFilename;
      if (!testSpecFilename) {
        throw new ContextError('Invalid test spec filename.');
      }
      const testSpec = BuildSpec.fromSourceFilename(testSpecFilename);
      const testCache = Cache.bucket(repoCdnPipelineProps.cacheBucket, {
        prefix: 'test'
      });
      const testProject = new PipelineProject(this, 'TestProject', {
        buildSpec: testSpec,
        environment: linuxEnv,
        cache: testCache,
      });
      const linuxTest = new CodeBuildAction({
        actionName: 'LinuxTest',
        project: testProject,
        input: repoOutput,
        type: CodeBuildActionType.TEST,
      });
      const testStage = {
        stageName: 'Test',
        actions: [
          linuxTest,
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
    const distributionArn = Arn.format({
      service: 'cloudfront',
      resource: 'distribution',
      region: '',
      resourceName: repoCdnPipelineProps.cdn.distribution.distributionId,
    }, this);
    const distributionPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'cloudfront:CreateInvalidation',
      ],
      resources: [
        distributionArn,
      ],
    });
    const distributionCode = Code.fromAsset(join(__dirname, 'distribution-handler'));
    const distributionHandler = new Function(this, 'DistributionHandler', {
      runtime: Runtime.PYTHON_3_8,
      handler: 'distribution.on_event',
      code: distributionCode,
      timeout: Duration.minutes(1),
      logRetention: RetentionDays.ONE_DAY,
      initialPolicy: [
        distributionPolicy,
      ],
    });
    const distributionProps = {
      distributionId: repoCdnPipelineProps.cdn.distribution.distributionId,
    };
    const cacheInvalidate = new LambdaInvokeAction({
      actionName: 'CacheInvalidate',
      lambda: distributionHandler,
      userParameters: distributionProps,
    });
    const invalidateStage = {
      stageName: 'Invalidate',
      actions: [
        cacheInvalidate,
      ],
    };
    pipelineStages.push(invalidateStage);
    new Pipeline(this, 'RepoCdnPipeline', {
      stages: pipelineStages,
      restartExecutionOnUpdate: false,
    });
  }

}

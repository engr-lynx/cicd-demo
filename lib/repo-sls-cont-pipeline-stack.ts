import { join } from 'path';
import { Construct, Stack, StackProps, Duration } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Repository, AuthorizationToken } from '@aws-cdk/aws-ecr';
import { PipelineProject, LinuxBuildImage, BuildSpec, Cache } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { CodeBuildAction, ManualApprovalAction, CodeBuildActionType, LambdaInvokeAction } from '@aws-cdk/aws-codepipeline-actions';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { buildRepoSourceAction } from './pipeline-helper';
import { PipelineProps, ContextError } from './context-helper';
import { SlsContStack } from './sls-cont-stack';
import { buildContBuildAction } from './pipeline-helper'

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
      /*2*/
      const linuxEnv = {
        buildImage: LinuxBuildImage.STANDARD_5_0,
      };
      const testSpecFilename = repoSlsContPipelineProps.pipeline.test?.specFilename;
      if (!testSpecFilename) {
        throw new ContextError('Invalid test spec filename.');
      }
      const testSpec = BuildSpec.fromSourceFilename(testSpecFilename);
      const testCache = Cache.bucket(repoSlsContPipelineProps.cacheBucket, {
        prefix: id + '/test',
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
      /*2*/
      const testStage = {
        stageName: 'Test',
        actions: [
          linuxTest,
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
    const deployPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'lambda:UpdateFunctionCode',
      ],
      resources: [
        repoSlsContPipelineProps.slsCont.func.functionArn,
      ],
    });
    const deployCode = Code.fromAsset(join(__dirname, 'sls-cont-deploy-handler'));
    const deployHandler = new Function(this, 'DeployHandler', {
      runtime: Runtime.PYTHON_3_8,
      handler: 'slsdeploy.on_event',
      code: deployCode,
      timeout: Duration.minutes(1),
      logRetention: RetentionDays.ONE_DAY,
      initialPolicy: [
        deployPolicy,
      ],
    });
    contRepo.grant(deployHandler,
      "ecr:SetRepositoryPolicy",
      "ecr:GetRepositoryPolicy",
      "ecr:InitiateLayerUpload"
    );
    const deployProps = {
      funcName: repoSlsContPipelineProps.slsCont.func.functionName,
      repoUri: contRepo.repositoryUri + ':latest',
    };
    const slsDeploy = new LambdaInvokeAction({
      actionName: 'SlsDeploy',
      lambda: deployHandler,
      userParameters: deployProps,
    });
    const deployStage = {
      stageName: 'Deploy',
      actions: [
        slsDeploy,
      ],
    };
    pipelineStages.push(deployStage);
    new Pipeline(this, 'RepoSlsContPipeline', {
      stages: pipelineStages,
      restartExecutionOnUpdate: false,
    });
  }

}

import { join } from 'path';
import { Construct, Stack, StackProps, Duration } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Repository, AuthorizationToken } from '@aws-cdk/aws-ecr';
import { PipelineProject, LinuxBuildImage, BuildSpec, Cache } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { CodeBuildAction, ManualApprovalAction, CodeBuildActionType, LambdaInvokeAction } from '@aws-cdk/aws-codepipeline-actions';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from '@aws-cdk/aws-ecs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { buildRepoSourceAction } from './pipeline-helper';
import { PipelineProps, ContextError } from './context-helper';
import { DbContStack } from './db-cont-stack';
import { buildContBuildAction, buildCustomAction } from './pipeline-helper'

export interface RepoDbContPipelineProps extends StackProps {
  pipeline: PipelineProps,
  dbCont: DbContStack,
  cacheBucket: Bucket,
}

export class RepoDbContPipelineStack extends Stack {

  constructor(scope: Construct, id: string, repoDbContPipelineProps: RepoDbContPipelineProps) {
    super(scope, id, repoDbContPipelineProps);
    const pipelineStages = [];
    const repoOutput = new Artifact('RepoOutput');
    const repoSource = buildRepoSourceAction(this, {
      repo: repoDbContPipelineProps.pipeline.repo,
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
    const envVar = {
      TASK_FAMILY: repoDbContPipelineProps.dbCont.task.family,
    }
    const contBuild = buildContBuildAction(this, {
      repo: contRepo,
      input: repoOutput,
      envVar,
      postBuildCommands: [
        'aws ecs register-task-definition --family ${TASK_FAMILY}',
      ]
    });
    const buildStage = {
      stageName: 'Build',
      actions: [
        contBuild,
      ],
    };
    /* Todo:
     * replace build stage with validation stage
     * optional stages (in order from validation) - staging (container built from backup), staging cleanup (stop task)
     * config - additional commands for contSpec
     */
    pipelineStages.push(buildStage);
    if (repoDbContPipelineProps.pipeline.test?.enable) {
      const specFilename = repoDbContPipelineProps.pipeline.test?.specFilename;
      if (!specFilename) {
        throw new ContextError('Invalid test spec filename.');
      };
      const prefix = id + 'Test';
      const testAction = buildCustomAction(this, {
        prefix,
        type: CodeBuildActionType.TEST,
        specFilename,
        input: repoOutput,
        cacheBucket: repoDbContPipelineProps.cacheBucket,
      });
      const testStage = {
        stageName: 'Test',
        actions: [
          testAction,
        ],
      };
      pipelineStages.push(testStage);
    };
    if (repoDbContPipelineProps.pipeline.approval?.enable) {
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
    // const deployPolicy = new PolicyStatement({
    //   effect: Effect.ALLOW,
    //   actions: [
    //     'lambda:UpdateFunctionCode',
    //   ],
    //   resources: [
    //     repoDbContPipelineProps.func.functionArn,
    //   ],
    // });
    // const deployCode = Code.fromAsset(join(__dirname, 'sls-cont-deploy-handler'));
    // const deployHandler = new Function(this, 'DeployHandler', {
    //   runtime: Runtime.PYTHON_3_8,
    //   handler: 'slsdeploy.on_event',
    //   code: deployCode,
    //   timeout: Duration.minutes(1),
    //   logRetention: RetentionDays.ONE_DAY,
    //   initialPolicy: [
    //     deployPolicy,
    //   ],
    // });
    // contRepo.grant(deployHandler,
    //   "ecr:SetRepositoryPolicy",
    //   "ecr:GetRepositoryPolicy",
    //   "ecr:InitiateLayerUpload"
    // );
    // const deployProps = {
    //   funcName: repoDbContPipelineProps.func.functionName,
    //   repoUri: contRepo.repositoryUri + ':latest',
    // };
    // const slsDeploy = new LambdaInvokeAction({
    //   actionName: 'SlsDeploy',
    //   lambda: deployHandler,
    //   userParameters: deployProps,
    // });
    // const deployStage = {
    //   stageName: 'Deploy',
    //   actions: [
    //     slsDeploy,
    //   ],
    // };
    // pipelineStages.push(deployStage);
    new Pipeline(this, 'RepoDbContPipeline', {
      stages: pipelineStages,
      restartExecutionOnUpdate: false,
    });
  }

}

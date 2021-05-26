import { join } from 'path';
import { Construct, Stack, StackProps, Duration } from '@aws-cdk/core';
import { Repository, AuthorizationToken } from '@aws-cdk/aws-ecr';
import { PipelineProject, LinuxBuildImage, BuildSpec } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { CodeBuildAction, ManualApprovalAction, LambdaInvokeAction } from '@aws-cdk/aws-codepipeline-actions';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from '@aws-cdk/aws-ecs';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { buildRepoSourceAction } from './pipeline-helper';
import { PipelineProps } from './context-helper';
import { DbContStack } from './db-cont-stack';

export interface RepoDbContPipelineProps extends StackProps {
  pipeline: PipelineProps,
  dbCont: DbContStack,
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
    const contSpec = BuildSpec.fromObject({
      version: '0.2',
      env: {
        variables: {
          REPO_URI: contRepo.repositoryUri,
          TASK_FAMILY: repoDbContPipelineProps.dbCont.task.family,
        },
      },
      phases: {
        pre_build: {
          commands: [
            'aws ecr get-login-password | docker login --username AWS --password-stdin ${REPO_URI}',
            'docker pull ${REPO_URI}:latest || true',
          ],
        },
        build: {
          commands: 'DOCKER_BUILDKIT=1 docker build --build-arg BUILDKIT_INLINE_CACHE=1 \
            --cache-from ${REPO_URI}:latest -t ${REPO_URI}:latest .',
        },
        post_build: {
          commands: [
            'docker push ${REPO_URI}',
            'aws ecs register-task-definition --family ${TASK_FAMILY}'
          ],
        },
      },
    });
    const linuxPrivilegedEnv = {
      buildImage: LinuxBuildImage.STANDARD_5_0,
      privileged: true,
    };
    const contProject = new PipelineProject(this, 'ContProject', {
      environment: linuxPrivilegedEnv,
      buildSpec: contSpec,
    });
    AuthorizationToken.grantRead(contProject);
    contRepo.grantPullPush(contProject);
    const contBuild = new CodeBuildAction({
      actionName: 'ContBuild',
      project: contProject,
      input: repoOutput,
    });
    const buildStage = {
      stageName: 'Build',
      actions: [
        contBuild,
      ],
    };
    /* Todo:
     * optional stages (in order from build) - staging (Lambda alias / API Gateway stage), test
     * config - filename of testspec file; additional commands for contSpec
     */
    pipelineStages.push(buildStage);
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

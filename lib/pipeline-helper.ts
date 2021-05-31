import { join } from 'path';
import { Repository, IRepository } from '@aws-cdk/aws-codecommit';
import { Repository as EcrRepository, AuthorizationToken } from '@aws-cdk/aws-ecr';
import { PipelineProject, LinuxBuildImage, BuildSpec, Cache } from '@aws-cdk/aws-codebuild';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeCommitSourceAction, CodeBuildAction, CodeBuildActionType, LambdaInvokeAction } from '@aws-cdk/aws-codepipeline-actions';
import { Bucket } from '@aws-cdk/aws-s3';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Construct, SecretValue, Duration } from '@aws-cdk/core';
import { RepoKind, CodeCommitProps, GitHubProps, RepoProps } from './context-helper'

interface KeyValue {
  [key: string]: string,
}

export interface RepoSourceActionProps {
  repo: RepoProps,
  prefix?: string,
  output: Artifact,
}

export function buildRepoSourceAction (scope: Construct, repoSourceActionProps: RepoSourceActionProps) {
  const prefix = repoSourceActionProps.prefix??'';
  const actionName = prefix + 'RepoSource';
  switch(repoSourceActionProps.repo.kind) {
    case RepoKind.CodeCommit:
      const codeCommitProps = repoSourceActionProps.repo as CodeCommitProps;
      const repoId = prefix + 'Repo';
      let repository: IRepository;
      if (codeCommitProps.create) {
        repository = new Repository(scope, repoId, {
          repositoryName: codeCommitProps.name,
        });  
      } else {
        repository = Repository.fromRepositoryName(scope, repoId, codeCommitProps.name);
      }
      return new CodeCommitSourceAction({
        actionName,
        output: repoSourceActionProps.output,
        repository,
      });
    case RepoKind.GitHub:
      const gitHubProps = repoSourceActionProps.repo as GitHubProps;
      const gitHubToken = SecretValue.secretsManager(gitHubProps.tokenName);
      return new GitHubSourceAction({
        actionName,
        output: repoSourceActionProps.output,
        oauthToken: gitHubToken,
        owner: gitHubProps.owner,
        repo: gitHubProps.name,
      });
    default:
      throw new Error('Unsupported Type');
  };
}

export interface ContBuildActionProps {
  prefix?: string,
  repo: EcrRepository,
  input: Artifact,
  envVar?: KeyValue,
  preBuildCommands?: string[];
  postBuildCommands?: string[];
}

export function buildContBuildAction (scope: Construct, contBuildActionProps: ContBuildActionProps) {
  const prefix = contBuildActionProps.prefix??'';
  const envVar = {
    ...contBuildActionProps.envVar,
    REPO_URI: contBuildActionProps.repo.repositoryUri,
  };
  const preBuildCommands = [];
  preBuildCommands.push(...contBuildActionProps.preBuildCommands??[]);
  preBuildCommands.push(
    'aws ecr get-login-password | docker login --username AWS --password-stdin ${REPO_URI}',
    'docker pull ${REPO_URI}:latest || true',
  );
  const postBuildCommands = [];
  postBuildCommands.push(
    'docker push ${REPO_URI}',
  );
  postBuildCommands.push(...contBuildActionProps.postBuildCommands??[]);
  const contSpec = BuildSpec.fromObject({
    version: '0.2',
    env: {
      variables: envVar,
    },
    phases: {
      pre_build: {
        commands: preBuildCommands,
      },
      build: {
        commands: 'DOCKER_BUILDKIT=1 docker build --build-arg BUILDKIT_INLINE_CACHE=1 \
          --cache-from ${REPO_URI}:latest -t ${REPO_URI}:latest .',
      },
      post_build: {
        commands: postBuildCommands,
      },
    },
  });
  const linuxPrivilegedEnv = {
    buildImage: LinuxBuildImage.STANDARD_5_0,
    privileged: true,
  };
  const projectName = prefix + 'ContProject';
  const contProject = new PipelineProject(scope, projectName, {
    environment: linuxPrivilegedEnv,
    buildSpec: contSpec,
  });
  AuthorizationToken.grantRead(contProject);
  contBuildActionProps.repo.grantPullPush(contProject);
  const actionName = prefix + 'ContBuild';
  return new CodeBuildAction({
    actionName,
    project: contProject,
    input: contBuildActionProps.input,
  });
}

export interface CustomActionProps {
  prefix?: string,
  type?: CodeBuildActionType,
  specFilename?: string,
  input: Artifact,
  outputs?: Artifact[],
  cacheBucket: Bucket,
}

export function buildCustomAction (scope: Construct, customActionProps: CustomActionProps) {
  const prefix = customActionProps.prefix??'';
  let buildSpec;
  if (customActionProps.specFilename) {
    buildSpec = BuildSpec.fromSourceFilename(customActionProps.specFilename);
  }
  const environment = {
    buildImage: LinuxBuildImage.STANDARD_5_0,
  };
  const cache = Cache.bucket(customActionProps.cacheBucket, {
    prefix,
  });
  const projectName = prefix + 'Project';
  const customProject = new PipelineProject(scope, projectName, {
    buildSpec,
    environment,
    cache,
  });
  const actionName = prefix + 'Action';
  return new CodeBuildAction({
    actionName,
    project: customProject,
    type: customActionProps.type,
    input: customActionProps.input,
    outputs: customActionProps.outputs,
  });
}

interface Policy {
  actions: string[],
  resources: string [],
}

export interface PyInvokeActionProps {
  prefix?: string,
  policies: Policy[],
  path: string,
  handler: string,
  params?: KeyValue,
}

export function buildPyInvokeAction (scope: Construct, pyInvokeActionProps: PyInvokeActionProps) {
  const prefix = pyInvokeActionProps.prefix??'';
  const initialPolicy = pyInvokeActionProps.policies.map(policy => new PolicyStatement(policy));
  const code = Code.fromAsset(join(__dirname, pyInvokeActionProps.path));
  const handlerName = prefix + 'Handler';
  const lambda = new Function(scope, handlerName, {
    runtime: Runtime.PYTHON_3_8,
    handler: pyInvokeActionProps.handler,
    code,
    timeout: Duration.minutes(1),
    logRetention: RetentionDays.ONE_DAY,
    initialPolicy,
  });
  const actionName = prefix + 'Action';
  return new LambdaInvokeAction({
    actionName,
    lambda,
    userParameters: pyInvokeActionProps.params,
  });
}

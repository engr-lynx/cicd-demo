import { Repository, IRepository } from '@aws-cdk/aws-codecommit';
import { Repository as EcrRepository, AuthorizationToken } from '@aws-cdk/aws-ecr';
import { PipelineProject, LinuxBuildImage, BuildSpec } from '@aws-cdk/aws-codebuild';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeCommitSourceAction, CodeBuildAction } from '@aws-cdk/aws-codepipeline-actions';
import { Construct, SecretValue } from '@aws-cdk/core';
import { RepoKind, CodeCommitProps, GitHubProps, RepoProps } from './context-helper'

export interface RepoSourceActionProps {
  repo: RepoProps,
  prefix?: string,
  output: Artifact,
}

export function buildRepoSourceAction (scope: Construct, repoSourceActionProps: RepoSourceActionProps) {
  const actionName = (repoSourceActionProps.prefix??'') + 'RepoSource';
  switch(repoSourceActionProps.repo.kind) {
    case RepoKind.CodeCommit:
      const codeCommitProps = repoSourceActionProps.repo as CodeCommitProps;
      const repoId = (repoSourceActionProps.prefix??'') + 'Repo';
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

interface KeyValue {
  [key: string]: string,
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
  const projectName = (contBuildActionProps.prefix??'') + 'ContProject';
  const contProject = new PipelineProject(scope, projectName, {
    environment: linuxPrivilegedEnv,
    buildSpec: contSpec,
  });
  AuthorizationToken.grantRead(contProject);
  contBuildActionProps.repo.grantPullPush(contProject);
  const actionName = (contBuildActionProps.prefix??'') + 'ContBuild';
  return new CodeBuildAction({
    actionName,
    project: contProject,
    input: contBuildActionProps.input,
  });
}

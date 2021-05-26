import { Repository, IRepository } from '@aws-cdk/aws-codecommit';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeCommitSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { Construct, SecretValue } from '@aws-cdk/core';
import { RepoKind, CodeCommitProps, GitHubProps, RepoProps } from './context-helper'

export interface RepoSourceActionProps {
  repo: RepoProps,
  output: Artifact,
}

export function buildRepoSourceAction (scope: Construct, repoSourceActionProps: RepoSourceActionProps) {
  const actionName = 'RepoSource';
  switch(repoSourceActionProps.repo.kind) {
    case RepoKind.CodeCommit:
      const codeCommitProps = repoSourceActionProps.repo as CodeCommitProps;
      const repoId = scope.node.id + 'Repo';
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

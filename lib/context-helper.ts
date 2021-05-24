export interface Context {
  [key: string]: any,
}

export enum RepoKind {
  CodeCommit = 'CODECOMMIT',
  GitHub = 'GITHUB',
} 

export interface CodeCommitProps {
  repoKind: RepoKind.CodeCommit,
  repoName: string,
  createRepo: boolean,
}

export interface GitHubProps {
  repoKind: RepoKind.GitHub,
  repoName: string,
  tokenName: string,
  owner: string,
}

export type RepoProps = CodeCommitProps | GitHubProps;

export interface StageProps {
  enableStaging?: boolean,
  enableTest?: boolean,
  enableApproval?: boolean,
  enableDeploy?: boolean,
  privilegedBuild?: boolean,
  stagingSpecFilename?: string,
  testSpecFilename?: string,
  deploySpecFilename?: string,
}

export interface NetworkProps {
  namespace: string,
  azCount: number,
}

export interface DbProps {
  cpu: number,
  mem: number,
}

export interface AppProps {
  mem: number,
}

export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextError";
  }
}

export function buildRepoProps (context: Context) {
  let repoProps: RepoProps;
  const repoKind = context.repoKind.toUpperCase();
  switch(repoKind) {
    case RepoKind.CodeCommit:
      repoProps = {
        repoKind,
        repoName: context.repoName,
        createRepo: context.createRepo,
      };
      return repoProps;
    case RepoKind.GitHub:
      repoProps = {
        repoKind,
        repoName: context.repoName,
        tokenName: context.tokenName,
        owner: context.owner,
      };
      return repoProps;
    default:
      throw new ContextError('Unsupported Repository Type');
  };
}

export function buildStageProps (context: Context) {
  const stageProps: StageProps = {
    enableStaging: context.enableStaging,
    enableTest: context.enableTest,
    enableApproval: context.enableApproval,
    enableDeploy: context.enableDeploy,
    privilegedBuild: context.privilegedBuild,
    stagingSpecFilename: context.stagingSpecFilename,
    testSpecFilename: context.testSpecFilename,
    deploySpecFilename: context.deploySpecFilename,  
  };
  return stageProps;
}

export function buildNetworkProps (context: Context) {
  const networkProps: NetworkProps = {
    namespace: context.namespace,
    azCount: context.azCount,
  };
  return networkProps;
}

export function buildDbProps (context: Context) {
  const dbProps: DbProps = {
    cpu: context.cpu,
    mem: context.mem,
  };
  return dbProps;
}

export function buildAppProps (context: Context) {
  const appProps: AppProps = {
    mem: context.mem,
  };
  return appProps;
}

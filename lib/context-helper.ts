export interface Context {
  [key: string]: any,
}

export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextError';
  }
}

/**/

export enum RepoKind {
  CodeCommit = 'CodeCommit',
  GitHub = 'GitHub',
} 

interface RepoPropsBase {
  kind: RepoKind,
  name: string,
}

export interface CodeCommitProps extends RepoPropsBase {
  kind: RepoKind.CodeCommit,
  create: boolean,
}

export interface GitHubProps extends RepoPropsBase {
  kind: RepoKind.GitHub,
  tokenName: string,
  owner: string,
}

export type RepoProps = CodeCommitProps | GitHubProps;

interface BuildProps {
  privileged?: boolean,
}

interface OptStageProps {
  enable?: boolean,
}

interface OptCustomStageProps extends OptStageProps {
  specFilename?: string,
}

interface StagingProps extends OptCustomStageProps {}

interface TestProps extends OptCustomStageProps {}

interface ApprovalProps extends OptStageProps {}

interface DeployProps extends OptCustomStageProps {}

export interface PipelineProps {
  repo: RepoProps,
  build?: BuildProps,
  staging?: StagingProps,
  test?: TestProps,
  approval?: ApprovalProps,
  deploy?: DeployProps,
}

interface DeployableProps {
  pipeline: PipelineProps,
}

export interface ArchiProps extends DeployableProps {
  id: string,
}

export interface SiteProps extends DeployableProps {}

export interface NetworkProps {
  namespace: string,
  azCount: number,
}

interface SlsSpecProps {
  mem: number,
}

interface ContSpecProps {
  cpu: number,
  mem: number,
}

export enum DbKind {
  AuroraSls = 'AuroraSls',
  CustomDbCont = 'CustomDbCont',
} 

export interface AuroraSlsProps extends DeployableProps {
  kind: DbKind.AuroraSls,
}

interface CustomDbContSpecProps extends ContSpecProps {}

export interface CustomDbContProps extends DeployableProps {
  kind: DbKind.CustomDbCont,
  spec: CustomDbContSpecProps,
}

export type DbProps = AuroraSlsProps | CustomDbContProps;

export enum AppKind {
  CustomSlsCont = 'CustomSlsCont',
  CustomAppCont = 'CustomAppCont',
} 

interface CustomSlsContSpecProps extends SlsSpecProps {}

export interface CustomSlsContProps extends DeployableProps {
  kind: AppKind.CustomSlsCont,
  spec: CustomSlsContSpecProps,
}

export interface CustomAppContProps extends DeployableProps {
  kind: AppKind.CustomAppCont,
}

export type AppProps = CustomSlsContProps | CustomAppContProps;

interface ServiceProps {
  id: string,
  db: DbProps,
  app: AppProps,
}

export interface ServicesProps {
  network: NetworkProps,
  list: ServiceProps[],
}

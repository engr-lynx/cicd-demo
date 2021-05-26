export interface Context {
  [key: string]: any,
}

export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextError";
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

function buildRepoProps (context: Context) {
  let repoProps: RepoProps;
  const kind = context.kind;
  switch(kind) {
    case RepoKind.CodeCommit:
      repoProps = {
        kind,
        name: context.name,
        create: context.create,
      };
      return repoProps;
    case RepoKind.GitHub:
      repoProps = {
        kind,
        name: context.name,
        tokenName: context.tokenName,
        owner: context.owner,
      };
      return repoProps;
    default:
      throw new ContextError('Unsupported Repository Type');
  };
}

interface BuildProps {
  privileged?: boolean,
}

function buildBuildProps (context: Context) {
  const buildProps: BuildProps = {
    privileged: context.privileged,
  };
  return buildProps;
}

interface OptStageProps {
  enable?: boolean,
}

interface OptCustomStageProps extends OptStageProps {
  specFilename?: string,
}

interface StagingProps extends OptCustomStageProps {}

function buildStagingProps (context: Context) {
  const stagingProps: StagingProps = {
    enable: context.enable,
    specFilename: context.specFilename,
  };
  return stagingProps;
}

interface TestProps extends OptCustomStageProps {}

function buildTestProps (context: Context) {
  const testProps: TestProps = {
    enable: context.enable,
    specFilename: context.specFilename,
  };
  return testProps;
}

interface ApprovalProps extends OptStageProps {}

function buildApprovalProps (context: Context) {
  const approvalProps: ApprovalProps = {
    enable: context.enable,
  };
  return approvalProps;
}

interface DeployProps extends OptCustomStageProps {}

function buildDeployProps (context: Context) {
  const deployProps: DeployProps = {
    enable: context.enable,
    specFilename: context.specFilename,
  };
  return deployProps;
}

export interface PipelineProps {
  repo: RepoProps,
  build?: BuildProps,
  staging?: StagingProps,
  test?: TestProps,
  approval?: ApprovalProps,
  deploy?: DeployProps,
}

function buildPipelineProps (context: Context) {
  const repo = buildRepoProps(context.repo);
  const build = buildBuildProps(context.build);
  const staging = buildStagingProps(context.staging);
  const test = buildTestProps(context.test);
  const approval = buildApprovalProps(context.approval);
  const deploy = buildDeployProps(context.deploy);
  const pipelineProps: PipelineProps = {
    repo,
    build,
    staging,
    test,
    approval,
    deploy,
  };
  return pipelineProps;
}

interface DeployableProps {
  pipeline: PipelineProps,
}

export interface ArchiProps extends DeployableProps {
  id: string,
}

export function buildArchiProps (context: Context) {
  const pipeline = buildPipelineProps(context.pipeline);
  const archiProps: ArchiProps = {
    id: context.id,
    pipeline,
  };
  return archiProps;
}

export interface SiteProps extends DeployableProps {}

export function buildSiteProps (context: Context) {
  const pipeline = buildPipelineProps(context.pipeline);
  const siteProps: SiteProps = {
    pipeline,
  };
  return siteProps;
}

export interface NetworkProps {
  namespace: string,
  azCount: number,
}

function buildNetworkProps (context: Context) {
  const networkProps: NetworkProps = {
    namespace: context.namespace,
    azCount: context.azCount,
  };
  return networkProps;
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

function buildCustomDbContSpecProps (context: Context) {
  const customDbContSpecProps: CustomDbContSpecProps = {
    cpu: context.cpu,
    mem: context.mem,
  };
  return customDbContSpecProps;
}

export interface CustomDbContProps extends DeployableProps {
  kind: DbKind.CustomDbCont,
  spec: CustomDbContSpecProps,
}

export type DbProps = AuroraSlsProps | CustomDbContProps;

function buildDbProps (context: Context) {
  const pipeline = buildPipelineProps(context.pipeline);
  let dbProps: DbProps;
  const kind = context.kind;
  switch(kind) {
    case DbKind.AuroraSls:
      dbProps = {
        kind,
        pipeline,
      };
      return dbProps;
    case DbKind.CustomDbCont:
      const dbContSpec = buildCustomDbContSpecProps(context.spec);
      dbProps = {
        kind,
        spec: dbContSpec,
        pipeline,
      };
      return dbProps;
    default:
      throw new ContextError('Unsupported Database Type');
  };
}

export enum AppKind {
  CustomSlsCont = 'CustomSlsCont',
  CustomAppCont = 'CustomAppCont',
} 

interface CustomSlsContSpecProps extends SlsSpecProps {}

function buildCustomSlsContSpecProps (context: Context) {
  const customSlsContSpecProps: CustomSlsContSpecProps = {
    mem: context.mem,
  };
  return customSlsContSpecProps;
}

export interface CustomSlsContProps extends DeployableProps {
  kind: AppKind.CustomSlsCont,
  spec: CustomSlsContSpecProps,
}

export interface CustomAppContProps extends DeployableProps {
  kind: AppKind.CustomAppCont,
}

export type AppProps = CustomSlsContProps | CustomAppContProps;

function buildAppProps (context: Context) {
  const pipeline = buildPipelineProps(context.pipeline);
  let appProps: AppProps;
  const kind = context.kind;
  switch(kind) {
    case AppKind.CustomSlsCont:
      const customSlsContSpec = buildCustomSlsContSpecProps(context.spec);
      appProps = {
        kind,
        spec: customSlsContSpec,
        pipeline,
      };
      return appProps;
    case AppKind.CustomAppCont:
      appProps = {
        kind,
        pipeline,
      };
      return appProps;
    default:
      throw new ContextError('Unsupported Database Type');
  };
}

interface ServiceProps {
  id: string,
  db: DbProps,
  app: AppProps,
}

function buildServiceProps (context: Context) {
  const db = buildDbProps(context.db);
  const app = buildAppProps(context.app);
  const serviceProps: ServiceProps = {
    id: context.id,
    db,
    app,
  };
  return serviceProps;
}

export interface ServicesProps {
  network: NetworkProps,
  list: ServiceProps[],
}

export function buildServicesProps (context: Context) {
  const network = buildNetworkProps(context.network);
  const list = context.list.map((serviceContext: Context) => buildServiceProps(serviceContext));
  const servicesProps: ServicesProps = {
    network,
    list,
  };
  return servicesProps;
}

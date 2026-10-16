import ReactNativeBlobUtil from 'react-native-blob-util';

const directory = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/pending-report`;
const staging = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/pending-report-next`;

// The 0.25 types omit cp and mv. Both exist on the runtime.
type CopyableFs = {
  cp(source: string, destination: string): Promise<boolean>;
  mv(source: string, destination: string): Promise<boolean>;
};

function files(): CopyableFs {
  return ReactNativeBlobUtil.fs as typeof ReactNativeBlobUtil.fs & CopyableFs;
}

export async function prepareReportDirectory(): Promise<void> {
  if (await ReactNativeBlobUtil.fs.exists(staging)) {
    await ReactNativeBlobUtil.fs.unlink(staging);
  }
  await ReactNativeBlobUtil.fs.mkdir(staging);
}

export async function commitReportDirectory(): Promise<void> {
  await removeReportDirectory();
  await files().mv(staging, directory);
}

export async function removeReportDirectory(): Promise<void> {
  if (await ReactNativeBlobUtil.fs.exists(directory)) {
    await ReactNativeBlobUtil.fs.unlink(directory);
  }
}

export async function writeReportText(name: string, contents: string): Promise<void> {
  await ReactNativeBlobUtil.fs.writeFile(`${staging}/${name}`, contents, 'utf8');
}

export async function copyReportFile(source: string, name: string): Promise<void> {
  await files().cp(source, `${staging}/${name}`);
}

export async function readReportText(name: string): Promise<string | null> {
  const path = `${directory}/${name}`;
  if (!(await ReactNativeBlobUtil.fs.exists(path))) {
    return null;
  }
  const contents = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
  return typeof contents === 'string' ? contents : null;
}

export function reportFilePath(name: string): string {
  return `${directory}/${name}`;
}

import {
  spawn as spawn2,
  SpawnOptionsWithoutStdio,
  CommonSpawnOptions,
} from 'child_process';

import colors from 'colors';

export class ProcessError extends Error {
  constructor(public code: number, public message: string) {
    super(`Program exited with code ${code} -- ${message}`);
  }
}

export async function exec(
  cmd: string,
  args: string[],
  options: CommonSpawnOptions = {}
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn2(cmd, args, options);

    console.log(colors.cyan(`Executing command: ${cmd} ${args.join(' ')}`));

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdout += data;
      });
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        stderr += data;
      });
    }

    child.on('close', code => {
      if (code !== 0 && code !== null) {
        reject(new ProcessError(code, stderr));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function shell(
  cmd: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<void> {
  await exec(cmd, args, {
    ...options,
    stdio: 'inherit',
  });
}

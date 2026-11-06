// Child processes of the build scripts run executables from fixed directories only (SonarCloud
// javascript:S4036). The inherited PATH could name a directory a PR or a dependency writes to,
// so a command is resolved here to an absolute path, from the directory of this Node binary
// and the system directories, and the child receives exactly that PATH.
import { accessSync, constants } from 'node:fs'
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path'

export const SYSTEM_DIRS = ['/usr/local/bin', '/usr/bin', '/bin']

export function fixedDirs(execPath = process.execPath) {
  return [dirname(execPath), ...SYSTEM_DIRS.filter(dir => dir !== dirname(execPath))]
}

export function fixedPath(execPath = process.execPath) {
  return fixedDirs(execPath).join(delimiter)
}

function isExecutable(file) {
  try {
    accessSync(file, constants.X_OK)
    return true
  }
  catch {
    return false
  }
}

// node is this Node binary; a path (relative or absolute) is resolved from the working
// directory; a bare name is looked up in the fixed directories. An unknown name throws.
export function resolveCommand(cmd, { execPath = process.execPath, cwd = process.cwd(), executable = isExecutable } = {}) {
  if (cmd === 'node') return execPath
  if (isAbsolute(cmd) || cmd.includes('/')) return resolve(cwd, cmd)
  const found = fixedDirs(execPath).map(dir => join(dir, cmd)).find(file => executable(file))
  if (!found) throw new Error(`${cmd} is not in ${fixedPath(execPath)}.`)
  return found
}

// The environment of a child: the parent's, with PATH replaced by the fixed directories.
export function childEnv(env = process.env, extra = {}, execPath = process.execPath) {
  return { ...env, ...extra, PATH: fixedPath(execPath) }
}

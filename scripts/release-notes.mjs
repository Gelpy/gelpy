// Extracts the CHANGELOG.md section of one version for the GitHub Release.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function extractReleaseNotes(changelog, version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version "${version}".`)
  }
  const lines = changelog.replace(/\r\n/g, '\n').split('\n')
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s|$)`)
  const start = lines.findIndex(line => heading.test(line))
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no section for ${version}.`)
  }
  const rest = lines.slice(start + 1)
  const next = rest.findIndex(line => /^## /.test(line))
  const body = (next === -1 ? rest : rest.slice(0, next)).join('\n').trim()
  if (!body) {
    throw new Error(`CHANGELOG.md section for ${version} is empty.`)
  }
  return `${body}\n`
}

export function main(argv, log = console.log) {
  const [version, changelogPath = 'CHANGELOG.md', outPath] = argv
  const notes = extractReleaseNotes(readFileSync(changelogPath, 'utf8'), version)
  if (outPath) {
    writeFileSync(outPath, notes)
    log(`Wrote release notes for ${version} to ${outPath}.`)
  } else {
    log(notes)
  }
  return notes
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}

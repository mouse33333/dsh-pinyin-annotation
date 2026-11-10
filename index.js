/**
 * DeepSeek Harness (dsh) bundle entry: publishes every packaged
 * `skills/<name>/SKILL.md` bundle on `ctx.skills`.
 *
 * A skill pack needs no tool, UI or preset wiring of its own: it rides on the
 * registry the base bundle already mounts. The `skills/` tree is re-read on
 * every discovery pass, so editing a SKILL.md or a reference note takes effect
 * without restarting the harness — and a malformed edit can be fixed the same
 * way, because nothing is parsed at mount time.
 *
 * Deliberately dependency-free: frontmatter is read by a small parser for the
 * subset of YAML that SKILL.md headers actually use, so the bundle installs and
 * runs from any directory (including a plain `file:` link) without a
 * `node_modules` tree of its own.
 *
 * @module dsh-pinyin-annotation
 */

import { readdirSync, watch } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Same rank as packaged dsh skill providers (`BUNDLED_SKILL_RANK` in `@deepseek-ai/dsh-skill`). */
const BUNDLED_SKILL_RANK = 600
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PROVIDER_NAME = 'dsh-pinyin-annotation'
const SKILLS_ROOT = fileURLToPath(new URL('./skills/', import.meta.url))

export const name = 'dsh-pinyin-annotation'
export const inject = ['skills']

/**
 * Register the packaged skill directory as one `ctx.skills` provider.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  // Only the directory layout is checked here; SKILL.md files are parsed on
  // discovery so a bad edit is a recoverable listing error, not a dead plugin.
  const directories = skillDirectories()
  if (directories.length === 0) {
    throw new Error(`dsh-pinyin-annotation: no skills/<name>/ directories under ${SKILLS_ROOT}`)
  }
  const register = () => ctx.skills.registerProvider(createProvider)
  // `ctx.effect` ties the registration to this plugin's lifetime, so unloading
  // or reloading the bundle never leaves a stale provider behind.
  if (typeof ctx.effect === 'function') {
    ctx.effect(register, 'dsh-pinyin-annotation skills provider')
  } else {
    register()
  }
}

function createProvider(control) {
  const stopWatching = watchSkills(control)
  control?.signal?.addEventListener?.('abort', stopWatching, { once: true })
  return { name: PROVIDER_NAME, list: listSkills, get: getSkill }
}

/**
 * Ask the registry to re-list when `skills/` changes, so dropping in a new
 * skill directory takes effect without a restart. Watching is an optimisation:
 * if it is unavailable, discovery still works on the next natural refresh.
 */
function watchSkills(control) {
  const invalidate = control?.invalidate
  if (typeof invalidate !== 'function') return () => {}
  let timer
  let watcher
  try {
    watcher = watch(SKILLS_ROOT, { recursive: true, persistent: false }, () => {
      clearTimeout(timer)
      timer = setTimeout(invalidate, 60)
    })
  } catch {
    return () => {}
  }
  return () => {
    clearTimeout(timer)
    watcher.close()
  }
}

async function listSkills(options) {
  options?.signal?.throwIfAborted()
  const listed = await loadSkills()
  options?.signal?.throwIfAborted()
  return listed.map(toCandidate)
}

async function getSkill(candidate, options) {
  options?.signal?.throwIfAborted()
  const listed = await loadSkills()
  return toDefinition(requireSkill(listed.find(entry => entry.name === candidate.name), candidate.name))
}

/** Directory names under `skills/`, in stable order; the mount-time sanity check. */
function skillDirectories() {
  return readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => entry.name)
    .sort()
}

/**
 * Read and parse every `skills/<name>/SKILL.md`.
 * @returns {Promise<ReadonlyArray<object>>}
 */
async function loadSkills() {
  const directories = await readdir(SKILLS_ROOT, { withFileTypes: true })
  const skills = []
  for (const entry of directories) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const directory = join(SKILLS_ROOT, entry.name)
    const skillFile = join(directory, 'SKILL.md')
    skills.push(parseSkill(await readFile(skillFile, 'utf8'), directory, skillFile))
  }
  return sortSkills(skills)
}

/**
 * Parse one SKILL.md into the shape `ctx.skills` candidates and definitions are
 * projected from.
 *
 * @param {string} raw - the file contents.
 * @param {string} directory - the skill bundle directory, used as its resource base.
 * @param {string} skillFile - the absolute SKILL.md path, for error messages.
 */
function parseSkill(raw, directory, skillFile) {
  const parsed = splitFrontmatter(raw)
  if (parsed === undefined) {
    throw new Error(`dsh-pinyin-annotation: ${skillFile} is missing its --- frontmatter block`)
  }
  const data = parseFrontmatterYaml(parsed.header)
  const skillName = nonEmptyString(data.name)
  const description = nonEmptyString(data.description)
  if (skillName === undefined || description === undefined) {
    throw new Error(`dsh-pinyin-annotation: ${skillFile} frontmatter requires name and description`)
  }
  if (!SKILL_NAME.test(skillName)) {
    throw new Error(
      `dsh-pinyin-annotation: invalid skill name "${skillName}" in ${skillFile} (kebab-case only)`,
    )
  }
  return {
    name: skillName,
    description,
    // Same frontmatter keys the shipped local provider reads; both default to true.
    invocation: {
      modelInvocable: data['disable-model-invocation'] !== true,
      userInvocable: data['user-invocable'] !== false,
    },
    provider: PROVIDER_NAME,
    source: 'bundled',
    // `references/` next to SKILL.md resolves against this directory.
    resourceBase: { kind: 'directory', path: directory },
    rank: BUNDLED_SKILL_RANK,
    locator: skillFile,
    path: skillFile,
    content: parsed.body.trim(),
  }
}

function sortSkills(skills) {
  const names = new Set()
  for (const skill of skills) {
    if (names.has(skill.name)) {
      throw new Error(`dsh-pinyin-annotation: duplicate skill name "${skill.name}"`)
    }
    names.add(skill.name)
  }
  return [...skills].sort((left, right) => left.name.localeCompare(right.name))
}

function requireSkill(skill, requested) {
  if (skill === undefined) {
    throw new Error(`dsh-pinyin-annotation: skill "${requested}" is no longer on disk`)
  }
  return skill
}

function toCandidate(skill) {
  return {
    name: skill.name,
    description: skill.description,
    invocation: skill.invocation,
    provider: skill.provider,
    source: skill.source,
    resourceBase: skill.resourceBase,
    rank: skill.rank,
    locator: skill.locator,
    path: skill.path,
  }
}

function toDefinition(skill) {
  return {
    name: skill.name,
    description: skill.description,
    invocation: skill.invocation,
    provider: skill.provider,
    source: skill.source,
    resourceBase: skill.resourceBase,
    path: skill.path,
    content: skill.content,
  }
}

/**
 * Split a leading `---` fenced block from the Markdown body.
 *
 * Kept separate from YAML parsing on purpose: the fence is a Markdown fact, the
 * header is a YAML one, and an unclosed fence should say so plainly.
 *
 * @param {string} raw
 * @returns {{ header: string, body: string } | undefined}
 */
function splitFrontmatter(raw) {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  if (stripCr(raw.slice(0, firstLineEnd)) !== '---') return undefined
  let lineStart = firstLineEnd + 1
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    if (stripCr(raw.slice(lineStart, lineEnd)) === '---') {
      return {
        header: raw.slice(firstLineEnd + 1, lineStart),
        body: nextNewline < 0 ? '' : raw.slice(nextNewline + 1),
      }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
  return undefined
}

function stripCr(line) {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

/**
 * Read the flat `key: value` subset of YAML that SKILL.md headers use: plain,
 * single-quoted and double-quoted scalars, plus `|` and `>` block scalars.
 * Nested mappings and sequences are ignored — no SKILL.md needs them, and
 * guessing at them would be worse than saying nothing.
 *
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
function parseFrontmatterYaml(text) {
  const lines = text.split('\n').map(stripCr)
  const data = {}
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) continue
    const match = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/.exec(line)
    if (match === null) continue
    const key = match[1]
    const rest = match[2].trim()
    if (/^[|>][+-]?$/.test(rest)) {
      const block = readBlockScalar(lines, index)
      index = block.lastIndex
      const joined = block.lines.filter(part => part.length > 0)
      data[key] = rest.startsWith('>') ? joined.join(' ').trim() : joined.join('\n')
      continue
    }
    data[key] = parseScalar(rest)
  }
  return data
}

/**
 * Consume an indented block after `key: |` / `key: >`.
 * @returns {{ lines: string[], lastIndex: number }}
 */
function readBlockScalar(lines, keyIndex) {
  const block = []
  let indent
  let index = keyIndex
  while (index + 1 < lines.length) {
    const next = lines[index + 1]
    if (next.trim().length === 0) {
      block.push('')
      index += 1
      continue
    }
    const lead = next.length - next.trimStart().length
    if (indent === undefined) indent = lead
    if (lead < indent) break
    block.push(next.slice(indent))
    index += 1
  }
  while (block.length > 0 && block[block.length - 1] === '') block.pop()
  return { lines: block, lastIndex: index }
}

function parseScalar(value) {
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return unescapeDoubleQuoted(value.slice(1, -1))
  }
  const plain = stripTrailingComment(value).trim()
  if (plain === 'true') return true
  if (plain === 'false') return false
  if (plain === 'null' || plain === '~') return null
  return plain
}

/** A ` #` sequence starts a YAML comment; a bare `#` inside a value does not. */
function stripTrailingComment(value) {
  const at = value.search(/\s#/)
  return at < 0 ? value : value.slice(0, at)
}

function unescapeDoubleQuoted(value) {
  return value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, escape) => {
    if (escape[0] === 'u') return String.fromCharCode(Number.parseInt(escape.slice(1), 16))
    switch (escape) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      case '0':
        return '\0'
      default:
        return escape
    }
  })
}

function nonEmptyString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

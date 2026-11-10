# dsh-pinyin-annotation

**Pinyin annotation skill pack for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — teacher-grade拼音, not machine transliteration.**

DeepSeek Harness 拼音标注技能包 —— 面向国际中文教学的拼音注音，不是机器音译。

> 模型不缺"拼音怎么拼"，缺的是"怎么给外国学生标注"：分词连写的词界、
> 专名大写、儿化与隔音撇、成语半字线、轻声辨义——一处写错，学生就记成错的。
> 本技能包把 GB/T 16159-2012 正词法与 HSK 教学体例提炼成可执行的规则 +
> 分布检查清单，模型匹配后按同一口径产出。
>
> Models can spell syllables; what they get wrong is **how to annotate for
> learners** — where the word boundaries go, which letters are capitalized,
> when `r` folds in, where the apostrophe belongs. One wrong word break and the
> student memorizes it. This pack turns GB/T 16159-2012 orthography plus HSK
> classroom conventions into executable rules and a pre-delivery checklist.

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-pinyin-annotation)](https://www.npmjs.com/package/dsh-pinyin-annotation)
[![dsh](https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-4176E6)](https://github.com/deepseek-ai/deepseek-harness)

English | [中文](README.zh.md)

## What it does / 做什么

Feed it Chinese, get back **pinyin only** — tone marks on every syllable, word
groupings written together, proper nouns capitalized, half-width punctuation:

| Source / 原文 | Output / 输出 |
|---|---|
| 我们明天去北京语言大学。 | `Wǒmen míngtiān qù Běijīng Yǔyán Dàxué.` |
| 风平浪静 | `fēngpíng-làngjìng` |
| 第九 / 七八个 | `dì-jiǔ` / `qī-bā gè` |
| 花儿 / 皮袄 | `huār` / `pi'ǎo` |

No `汉字+pinyin` side-by-side tables, no per-word explanations, no `。` or
`，` — the deliverable is plain pinyin text a learner can read aloud.

## What's inside / 包含内容

| Skill | Covers / 覆盖 |
|---|---|
| [`pinyin-annotation`](skills/pinyin-annotation/SKILL.md) | 三条铁律、三步工作流（音节 → 分词 → 篇章）、教学口径默认值、必错清单、交付前自检 |

Four reference notes ship beside it and are loaded on demand, so the main
`SKILL.md` stays short:

| Reference | Topic / 主题 |
|---|---|
| [`01-音节拼写与标调.md`](skills/pinyin-annotation/references/01-音节拼写与标调.md) | 声母韵母、标调位置、`ü`、零声母、隔音符号、儿化、多音字 |
| [`02-分词连写.md`](skills/pinyin-annotation/references/02-分词连写.md) | 词界、重叠式、助词、动宾/动补、方位词、数词量词、成语、虚词 |
| [`03-专名大写标点移行.md`](skills/pinyin-annotation/references/03-专名大写标点移行.md) | 人名地名机构名大写、标点、移行、分段硬规则 |
| [`04-两可边界与等同写法.md`](skills/pinyin-annotation/references/04-两可边界与等同写法.md) | 标准允许的两种写法、择一后全篇一致 |

## Install / 安装

From npm / 从 npm：

```bash
dsh plugin --profile desktop add dsh-pinyin-annotation
```

Or from the GitHub tag / 或从 GitHub 的 tag：

```bash
dsh plugin --profile desktop add "git+https://github.com/mouse33333/dsh-pinyin-annotation.git#v1.0.2"
```

From a local checkout / 从本地目录：

```bash
dsh plugin --profile desktop add /path/to/dsh-pinyin-annotation
```

The bundle inserts one host plugin (`dsh-pinyin-annotation`) into the profile's
`cordis.patch.yml`. It needs nothing else — the base bundle already mounts the
skill registry it publishes to.

## Usage / 使用

Just ask. The skill routes on its own description — 注音、标拼音、加拼音、拼音转写、
生词表/例句/课文的带拼音版本 all trigger it:

> 给这段课文标拼音：我们明天去北京语言大学。

> 把这 10 个生词做成带拼音的生词表。

> Annotate this dialogue with pinyin for HSK 2 students.

## How it works / 工作原理

`index.js` registers one `ctx.skills` provider and reads every
`skills/<name>/SKILL.md` from disk **on each discovery pass**. On top of that it
`fs.watch`es the `skills/` tree and calls the provider's `invalidate()`, so an
edited SKILL.md, a changed reference note, and a newly added or deleted skill
folder all take effect without restarting the harness:

```js
export const inject = ['skills']

export function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: 'dsh-pinyin-annotation',
    async list(options) { /* … */ },
    async get(candidate, options) { /* … */ },
  }))
}
```

Each skill is published with `source: 'bundled'`, `rank: 600` (the same rank as
the shipped skill packs, so a same-name user skill still wins) and a
`resourceBase` pointing at its own directory — that is what makes
`references/01-音节拼写与标调.md` resolvable from inside the skill body.

Frontmatter follows the standard SKILL.md shape (`name`, `description`, optional
`user-invocable` / `disable-model-invocation`); `description` is the routing
text, so it leads with the concrete triggers.

## Structure / 目录结构

```
dsh-pinyin-annotation/
├── index.js                 # bundle entry: registers the skills provider
├── cordis.patch.yml         # inserts the plugin into the profile
├── package.json             # dsh.bundle.patch points at cordis.patch.yml
├── icon.png
└── skills/
    └── pinyin-annotation/
        ├── SKILL.md
        └── references/
            ├── 01-音节拼写与标调.md
            ├── 02-分词连写.md
            ├── 03-专名大写标点移行.md
            └── 04-两可边界与等同写法.md
```

## Add your own skill / 添加自己的技能

Drop a `skills/<your-skill>/SKILL.md` in — the watcher picks it up, no code change
and no restart needed. The name must be kebab-case
(`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) and the frontmatter must carry `name` and
`description`. Duplicate names fail at load with the offending name, rather than
silently shadowing each other.

## License / 许可

MIT. The skill content is an independent reimplementation of the rules in
GB/T 16159-2012《汉语拼音正词法基本规则》and common HSK classroom practice. The
entry point has no runtime dependencies — frontmatter is parsed by a small
built-in reader rather than a YAML library.

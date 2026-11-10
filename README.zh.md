# dsh-pinyin-annotation

**DeepSeek Harness（DSH）拼音标注技能包 —— 面向国际中文教学的注音，不是机器音译。**

[English](README.md) | 中文

> 模型不缺"拼音怎么拼"，缺的是"怎么给外国学生标注"：分词连写的词界、专名大写、
> 儿化与隔音撇、成语半字线、轻声辨义——一处写错，学生就记成错的。
> 本技能包把 GB/T 16159-2012《汉语拼音正词法基本规则》与 HSK 教学体例提炼成
> 可执行的规则和分布检查清单，模型匹配后按同一口径产出。

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![dsh](https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-4176E6)](https://github.com/deepseek-ai/deepseek-harness)

## 做什么

输入汉字，输出**纯拼音**——逐字带调、以词为书写单位连写、专名大写、标点半角：

| 原文 | 输出 |
|---|---|
| 我们明天去北京语言大学。 | `Wǒmen míngtiān qù Běijīng Yǔyán Dàxué.` |
| 风平浪静 | `fēngpíng-làngjìng` |
| 第九 / 七八个 | `dì-jiǔ` / `qī-bā gè` |
| 花儿 / 皮袄 | `huār` / `pi'ǎo` |

不输出「汉字＋拼音对照」表格、不逐词解释、句号不写 `。`、逗号不写 `，`——
交付物是学生能直接照着念的纯拼音文本。

## 包含内容

| 技能 | 覆盖 |
|---|---|
| [`pinyin-annotation`](skills/pinyin-annotation/SKILL.md) | 三条铁律、三步工作流（音节 → 分词 → 篇章）、教学口径默认值、必错清单、交付前自检 |

主文件旁边另有四份细则，按需加载，主 `SKILL.md` 因此保持精简：

| 细则 | 主题 |
|---|---|
| [`01-音节拼写与标调.md`](skills/pinyin-annotation/references/01-音节拼写与标调.md) | 声母韵母、标调位置、`ü`、零声母、隔音符号、儿化、多音字 |
| [`02-分词连写.md`](skills/pinyin-annotation/references/02-分词连写.md) | 词界、重叠式、助词、动宾/动补、方位词、数词量词、成语、虚词 |
| [`03-专名大写标点移行.md`](skills/pinyin-annotation/references/03-专名大写标点移行.md) | 人名地名机构名大写、标点、移行、分段硬规则 |
| [`04-两可边界与等同写法.md`](skills/pinyin-annotation/references/04-两可边界与等同写法.md) | 标准允许的两种写法、择一后全篇一致 |

## 安装

直接从 GitHub 安装：

```bash
dsh plugin --profile desktop add "git+https://github.com/mouse33333/dsh-pinyin-annotation.git#v1.0.0"
```

从本地目录：

```bash
dsh plugin --profile desktop add /path/to/dsh-pinyin-annotation
```

本包尚未发布到 npm。发布之后最短的装法是：
`dsh plugin --profile desktop add dsh-pinyin-annotation`。

本包向 profile 的 `cordis.patch.yml` 插入一个 host 插件（`dsh-pinyin-annotation`）。
不需要别的配置——基础包已经挂好了它要注册进去的技能注册表。

## 使用

直接提需求即可，技能靠 `description` 自动路由——注音、标拼音、加拼音、拼音转写、
生词表/例句/课文的带拼音版本都会触发：

> 给这段课文标拼音：我们明天去北京语言大学。

> 把这 10 个生词做成带拼音的生词表。

> 给这篇 HSK2 对话加拼音。

## 工作原理

`index.js` 注册一个 `ctx.skills` provider，**每次发现都从磁盘重读**所有
`skills/<name>/SKILL.md`；同时用 `fs.watch` 监听 `skills/` 目录并调用 provider 的
`invalidate()`，因此改 SKILL.md、改细则文件、新增或删除整个技能目录都不需要重启 Harness：

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

每个技能以 `source: 'bundled'`、`rank: 600`（与随包技能同级，同名用户技能仍可覆盖）
和指向自身目录的 `resourceBase` 发布——后者正是技能正文里能引用
`references/01-音节拼写与标调.md` 的原因。

frontmatter 沿用标准 SKILL.md 形状（`name`、`description`，可选
`user-invocable` / `disable-model-invocation`）；`description` 就是路由文本，
所以开头直接写触发词。

## 目录结构

```
dsh-pinyin-annotation/
├── index.js                 # bundle 入口：注册技能 provider
├── cordis.patch.yml         # 把插件插入 profile
├── package.json             # dsh.bundle.patch 指向 cordis.patch.yml
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

## 添加自己的技能

新建 `skills/<your-skill>/SKILL.md` 后由 watcher 自动拾取，无需改代码、无需重启。技能名须为
kebab-case（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`），frontmatter 必须含 `name` 与 `description`。
重名会在加载时报出具体名字直接失败，不会静默互相遮蔽。

## 许可

MIT。技能正文是对 GB/T 16159-2012《汉语拼音正词法基本规则》与通行 HSK 教学体例的
独立整理；入口文件零运行时依赖，frontmatter 由内置的小型解析器读取，未引入 YAML 库。

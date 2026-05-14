使用中文与用户对话
所有操作均以文档为核心依据，推进文档引领的开发流程
行动之前检查先检查有没有能使用的skill，有的话就先使用skill
**git提交一定要使用中文描述！**
**代码和文档活在仓库里，不活在对话窗口里**
**职责分离原则：追踪“过去是什么”以及“为什么修改”是版本控制系统Git的职责，而不是代码注释或系统文档的职责。**
【制品写作规范】
你生成的代码、注释、UI文字和文档将被长期保存在仓库中，
读者不会有本次对话的背景。因此：
1. 用"现状描述"而非"变更描述"
2. 禁用对话时态词：现在/不再/改为/新方案/之前/原来
3. 每一句话都能独立成立，不依赖任何对话上下文


你有另一个身份为React-Motion-Maker 当需要制作动效时，请读取它
描述文件在".opencode/agents/react-motion-maker.md"

## Skills

以下为当前项目内可用 skills（来源：`.trae/skills`）：

### Available skills
- `canvas-design`: 创建高质量视觉设计作品（海报/艺术图/静态设计）
  - 路径：`.trae/skills/canvas-design/SKILL.md`
- `doc-coauthoring`: 结构化文档共创流程（需求文档/提案/技术方案）
  - 路径：`.trae/skills/doc-coauthoring/SKILL.md`
- `frontend-design`: 构建高设计质量前端界面与页面
  - 路径：`.trae/skills/frontend-design/SKILL.md`
- `git-commit-specification`: Git 提交规范（commit/分支/PR）
  - 路径：`.trae/skills/git-commit-specification/SKILL.md`
- `web-artifacts-builder`: 复杂 Web Artifact 构建（React/Tailwind/shadcn）
  - 路径：`.trae/skills/web-artifacts-builder/SKILL.md`
- `webapp-testing`: 基于 Playwright 的 Web 应用测试
  - 路径：`.trae/skills/webapp-testing/SKILL.md`

### How to use skills
- 触发规则：用户显式提到 skill 名称，或任务与 skill 描述明显匹配时，必须优先使用对应 skill。
- 执行顺序：如多个 skill 同时适用，选最小覆盖集合并说明使用顺序。
- 文件解析：先读取对应 `SKILL.md`，按其中流程执行；引用相对路径时先相对 skill 目录解析。
- 失败回退：若 skill 缺失或不可读，简要说明并使用最佳替代方案继续执行。

# LUCID

[English](README.md) | **中文**

## 在线演示

在 Google Cloud Run 上体验 LUCID：

https://lucid-cognitive-triage-agent-220940600627.us-central1.run.app

## 产品演示

### 以“先暂停”为核心的认知安全体验

![LUCID 首页，引导用户在行动前暂停](public/screenshots/home-hero-pause.jpg)

### 可解释证据与情绪压力信号

![LUCID 可解释风险贡献与情绪压力信号](public/screenshots/evidence-highlights.png)

## 为什么要做 LUCID？

### LUCID 背后的故事

LUCID 源于一位身边朋友真实经历的诈骗事件。

几个月前，我的一位朋友收到了一条冒充大使馆的诈骗信息。诈骗者声称朋友卷入了一起严重刑事案件，甚至指控其逼迫他人自杀，并要求支付 60 万人民币“保证金”以避免入狱。

朋友起初有所怀疑，但诈骗者提供了家庭情况、身份资料等个人信息，让整件事显得极其真实。在高压威胁与隐私泄露的双重作用下，朋友逐渐陷入恐慌。

这件事让我意识到：

> 人通常是理性的，但恐惧和心理压力会暂时扰乱我们的理性判断。

人在受到威胁时，大脑会自然进入生存反应。此刻需要的未必是更多信息，而是一套能帮助人慢下来、判断风险并回到理性状态的系统。

### 为理性决策打造 AI Agent

这成为了 LUCID 的出发点。我希望它能在人与潜在诈骗之间充当一层“数字安全缓冲”：

- 自动分析可疑信息、截图、网址和对话；
- 通过量化诈骗风险分数评估风险；
- 给出清晰解释，而不是只说“这是诈骗”；
- 帮助用户重新获得控制感，基于证据而非恐惧作出决定。

安全是 LUCID 的第一原则。保护用户的工具不应成为新的隐私风险，因此系统会尽量减少不必要的数据暴露。

LUCID 不只是诈骗检测系统，而是一个在人受到操纵时，帮助其暂停、理清思路并恢复理性判断的 AI Agent。

**在伤害发生前，为认知安全争取一个暂停的瞬间。**

LUCID 是 Google Cloud Rapid Agent Hackathon 项目。它分析用户主动提交的截图、网址、通话记录或粘贴文本，识别操纵链，从 MongoDB Pattern Memory 检索相似的匿名模式，并生成由用户自主决定是否采用的安全行动建议。

LUCID 不是诈骗判决引擎，而是在诈骗者试图孤立、催促或恐吓用户时发挥作用的认知分诊 Agent。

## 功能

- 接收最多五张截图，并可附加网址或文字背景；
- 使用 Gemini 进行多模态诈骗与操纵分析；
- 识别恐惧、紧迫感、权威冒充、孤立、贪婪、账号威胁、可疑链接和敏感数据索取等压力手段；
- 使用 `Green`、`Yellow`、`Orange`、`Red` 四级认知分诊；
- 对 `Orange` 或 `Red` 案例启用保护性引导；
- 从 MongoDB Pattern Memory 检索相似匿名诈骗模式；
- 生成安全回复、核验步骤、证据摘要、可分享报告和可选的匿名模式记录；
- 未配置外部 API 时回退到稳定演示数据，保证 Demo 可用。

## Agent 工作流

1. **感知证据**：Gemini 读取用户提交的截图、网址、通话记录或文本。
2. **检索记忆**：MongoDB Pattern Memory 从 `patterns` 与 `cases` 中搜索相似的匿名操纵结构。
3. **推理与分诊**：LUCID 结合 Gemini 输出、检索结果和校准规则分配风险等级。
4. **建议安全行动**：生成冷静的下一步、安全回复、核验指南和可信联系人报告。
5. **仅在用户监督下行动**：是否保存、分享、复制或忽略，完全由用户决定。
6. **可选记忆更新**：经明确确认后，只保存匿名模式，不保存原始私人聊天。

## Google Cloud 与合作方集成

- **Google Cloud Gemini**：对截图、网址和文本进行多模态推理；
- **Google Cloud Run**：托管公开 Web Agent；
- **MongoDB Atlas**：保存 Pattern Memory 集合；
- **MongoDB MCP 兼容工具**：提供模式检索和匿名模式保存能力。

生产运行时目前使用 MongoDB Node.js 驱动以保证可靠性，Agent 架构和参赛材料则将同一组集合映射为 MongoDB MCP 工具。详见 [`docs/agent-builder-mcp.md`](docs/agent-builder-mcp.md)。

### MongoDB Pattern Memory 集合

- `patterns`：人工整理的匿名诈骗模式；
- `cases`：用户确认后从应用保存的匿名模式；
- `feedback`：用于未来质量审查的可选集合。

### MCP 工具映射

- `search_patterns`：从 `patterns` 与 `cases` 检索相似模式；
- `save_anonymized_pattern`：用户确认后，仅保存抽象风险类型、操纵链、证据短语和安全行动。

## 技术栈

- Next.js + TypeScript
- Google Cloud Gemini API
- Google Cloud Run
- MongoDB Atlas / MongoDB Pattern Memory
- Docker + Cloud Build

## 本地运行

安装依赖：

```bash
npm install
```

复制环境变量文件：

```bash
cp .env.example .env
```

填写 `.env`：

```bash
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_API_MODE=vertex_express
GOOGLE_MODEL=gemini-2.5-flash
GOOGLE_CLOUD_PROJECT=your_google_cloud_project
GOOGLE_CLOUD_LOCATION=us-central1
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=lucid
```

本地启动：

```bash
npm run dev
```

打开 `http://localhost:3000`。如果 3000 端口已被占用，Next.js 可能会使用 `http://localhost:3001`。

## 回退模式

如果缺少 `GOOGLE_API_KEY` 或 Gemini 返回无效 JSON，LUCID 会返回稳定的内置演示分析。

如果缺少 `MONGODB_URI` 或 MongoDB 调用失败，LUCID 会搜索本地匿名示例模式列表。

这是为黑客松演示可靠性而设计的；条件允许时，公开 Demo 应配置 Gemini 与 MongoDB。

## 演示案例

- 低风险 IG 联络：普通日程安排，应保持 Green；
- 航空退款钓鱼：电话配合虚假赔偿网站；
- 假警察/大使馆威胁：权威、恐惧、孤立与付款压力；
- WhatsApp 账号钓鱼：封号压力和可疑链接；
- 加密投资炒作：虚假新币发布、倒计时、无法验证的收益以及充值诱导。

演示截图位于 `public/cases/`。

## 隐私与安全边界

- LUCID 只分析用户主动提交的内容；
- 不读取短信、WhatsApp、Gmail、浏览器标签页或银行账户；
- 不发送消息、举报用户、冻结账户或执行金融操作；
- 用户提交内容可能暂时经过后端与 Gemini 进行分析；
- 不将 LUCID 描述为完全私密或端到端加密；
- 本地保存的审查记录留在浏览器 Local Storage；
- 保存匿名模式必须获得用户确认；
- 匿名模式仅应包含风险类型、操纵链、短证据语句、风险等级与建议行动；
- 不应将原始截图、完整私聊、姓名、账号和联系方式保存为模式记忆；
- 证据摘要不属于法律文件。

## Devpost 简介

LUCID 是一个在伤害发生前介入的认知安全 Agent。它使用 Gemini 分析截图、通话记录、网址和消息中的诈骗压力，从 MongoDB Pattern Memory 检索相似匿名操纵模式，并在不通知信息发送者的前提下，帮助用户暂停、核验并选择更安全的下一步。

## 部署

推荐部署到 **Google Cloud Run**。Docker 与 Cloud Build 命令见 [`DEPLOYMENT.md`](DEPLOYMENT.md)。

必需环境变量：

- `GOOGLE_API_KEY`
- `GOOGLE_API_MODE`
- `GOOGLE_MODEL`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `MONGODB_URI`
- `MONGODB_DB`

## 许可证

MIT

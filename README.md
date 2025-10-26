# NovelToComic（小说转漫画）产品说明与实现文档

## 概览（你现在已有的成品）

- **定位**：把中文小说片段自动拆成“分镜 JSON”，前端并发逐格调用生图接口，边生成边展示。
- **架构**：一台服务器（Nginx + FastAPI + 前端静态页），产物本地落盘 `/srv/comicgen/public/outputs` 并通过 `/outputs/` 公开访问。
- **模型接入**：采用 **七牛云 AI 大模型推理 Token API（OpenAI 兼容）**
  - **文本分镜**：`deepseek-v3`（/v1/chat/completions）
  - **图像生成**：`gemini-2.5-flash-image`（/v1/chat/completions + `modalities: ["image","text"]`）
- **前端**：你给的 Apple 风格单页 **布局不动**，我已接上接口：
  - 左侧：“小说→分镜 JSON”（按钮：生成分镜、清空）
  - 右侧：批量并发渲染（尺寸、并发数、统一画风前缀、开始/停止/复制链接）
- **一致性说明**：由于当前图像模型与 API 不支持“种子/参考图像一致化”这类强约束，**主角人脸完全一致**暂时**无法保证**。文档给出替代方案与改进路线（见下）。

------

## 1）目标用户、痛点与用户故事

### 目标用户

1. **网络小说作者 / 平台签约作者**
   - **痛点**：给章节做插图/分镜成本高、排期慢、需要沟通稿件风格。
   - **故事**：作为作者，我把一段章节贴进去，选择“黑白线稿”，1 分钟得到 4–8 个分镜草图，挑满意的继续细化。
2. **独立漫画创作者 / 小团队**
   - **痛点**：剧本转分镜耗时，前期美术小样反复迭代很慢。
   - **故事**：我粘贴场景描述，设置“统一画风前缀”，开启并发一次出 6 格，失败不影响整体，快速评审走查。
3. **影视/广告分镜设计师**
   - **痛点**：文字脚本到视觉小样周期长；反复修改成本高。
   - **故事**：我把脚本段落分批生成，右侧栅格直接看到小样链接，挑选复用或让美术二次加工。
4. **教育/培训机构（分镜思维训练）**
   - **痛点**：学生难把文字转镜头语言。
   - **故事**：课堂把练习题扔进来，生成 2×2 或 3×3 分镜，让学生讲述镜头意图并改写文本。

------

## 2）实现挑战与应对策略

### A. **主角人物“同一张脸、同一造型”的一致性**

- **现状**：七牛当前图像模型（`gemini-2.5-flash-image`）为文生图，**无官方“种子/参考图像一致化”参数**；API 返回 base64 data URL；不同帧有**随机性**。
- **我们尝试过**：
  - 方案一（已编写）：“**Anchor + 人脸向量相似度筛选**”
    - 借助 `insightface` 提取锚点人脸 embedding，生成多次取最高相似度（/`image_consistent`）。
    - **问题**：CPU 推理慢、少数图无脸或姿态偏转时检测失败；即使筛选，**仍不能保证“完全同脸”**，只是“更像”。
  - 方案二（现行替代）：**提示词工程 + 统一画风前缀 + 场景锁定**
    - 角色外观关键词（年龄/发型/衣着/配饰/情绪）、画风词（manga、screentone 等）、场景锁（雨夜/白卫衣/牛仔裤）
    - 前端并发生成 **2–3 张/格** 取其优（人工挑选/复用）。

> 结论：在当前模型与 API 能力下，**完全一致的人脸不可保证**。我们提供“更像”的筛选机制与“统一画风+场景锁”的稳定化手段，并在路线图里规划更强一致性的升级（见第 4 点）。

### B. **稳定与成本**

- 并发受模型队列与速率限制影响；**前端并发默认 2–3**，失败重试单独进行，不拖累整队列。
- 产物按日期落盘，Nginx 静态服务，方便复用、节省费用。

### C. **安全与运维**

- Key 存 `.env`，建议定期轮换。
- Nginx 关 `server_tokens`，开启防火墙只放行 22/80。
- 日志可观测：`journalctl -u comicgen -f` 与 Nginx access/error。

### D. **中文 JSON 可用性**

- LLM 容易输出“包裹说明+JSON”，我们做了**JSON 提取**与“只输出 JSON”系统提示，保证前端解析稳定。

------

## 3）模型与 API 选择

### 已采用

- **七牛云 Token API（OpenAI 兼容）**
  - 统一接入域名（主：`https://openai.qiniu.com/v1`；备：`https://api.qnaigc.com/v1`）
  - **文本**：`deepseek-v3`（中文能力强、性价比高；json 指令遵循度好）
  - **图像**：`gemini-2.5-flash-image`（支持 `modalities:["image","text"]` 与 `image_config.aspect_ratio`；返回 base64 data URL）

### 对比与理由

- **统一代理 / 合规与可用性**：七牛在国内网络/稳定性更好，**一个 API Key** 同时调多家主流模型；OpenAI/Anthropic 兼容接口，迁移成本低。
- **中文表现**：`deepseek-v3` 对中文分镜更稳。
- **落地成本**：统一计费、网络连通性更好，降低开发与运维复杂度。
- **限制**：图像侧目前仅 `gemini-2.5-flash-image` 支持生图；不暴露 seed 与图生图参考图等强一致能力——这正是我们一致性上的天花板。

> 若未来七牛补齐“**图生图** / **参考图** / **seed**”，一致性问题将质变改善。

------

## 4）未来功能规划（不引入第三方 Agent，仅 LLM / AIGC / TTS）

1. **角色卡（Character Card）**
   - 功能：在分镜前先生成“统一人物设定卡”（头像、三视图、服装关键词），后续各镜头自动拼接该设定卡的要点到提示词。
   - 价值：显著提升风格与要素一致性；与“场景锁”组合，减少漂移。
2. **图生图（如 API 支持时立即接入）**
   - 功能：以角色卡头像作为参考图进行 **image-to-image**；或同一画面里保持人脸。
   - 价值：一致性从“更像”跃迁到“强一致”。
3. **TTS 语音**
   - 功能：把分镜对白生成旁白音轨（mp3/wav），随页面播放。
   - 价值：适配短视频/条漫有声化；提升传播力。
   - 方案：接入支持 **中文 TTS** 的 SDK（本项目不调用“Agent”，只调用 TTS 即可）。
4. **项目与图库管理**
   - 功能：把每次生成的分镜/图片归档成“项目”，支持标签、检索、ZIP/PDF 导出。
5. **导出格式**
   - 一键导出整话 ZIP、PDF、分镜 JSON；自动拼接 3×3 或 2×2 网格页。
6. **风格/场景预设**
   - 内置“雨夜街头 / 校园白天 / 古风庭院”等预设，降低新手门槛。
7. **配额管理 & 登录**（简单表单鉴权）
   - 控制用量、避免滥用；可为团队配置并发与额度上限。
8. **CDN / Kodo 对象存储**
   - 产物走 Kodo + CDN，公有读桶 + 目录化，页面加载更快。

------

## 实现快照（你当前的代码与接口）

### 已有 API（FastAPI）

- `GET /api/healthz` → `{"ok":true}`
- `POST /api/storyboard`
  **入参**：`{text, style}`
  **出参**：`{storyboard_json: "<JSON字符串>"}`
- `POST /api/image`
  **入参**：`{prompt, size}`（`size` 映射为生图 `aspect_ratio`）
  **出参**：`{path, url}`
- （可选）`POST /api/render` → 批量 `image`
- （实验）`/api/anchor_from_text`、`/api/anchor_from_url`、`/api/image_consistent`（人脸筛选，但非强一致）

### 前端（单页，布局保持不变）

- 左侧：**小说→分镜 JSON**（风格 chips：日式/美式/黑白/水彩/复古民国水粉）
- 右侧：**并发渲染控制**（尺寸、并发、统一画风前缀），**逐格并发**调用 `/api/image`；失败仅影响单格。
- 统一画风前缀示例（可覆盖）：
  - 日式漫画：`anime style, clean line art, expressive characters, soft lighting`
  - 黑白线稿：`black and white manga, line art, screentone, high contrast, dramatic lighting`
  - 复古民国水粉：`Republic of China era watercolor & gouache illustration, 1930s Shanghai street life, warm sepia tone, retro poster texture, nostalgic detail`

------

## 使用与测试清单（要点）

1. **健康检查**
   - 打开 `http://你的IP/api/healthz` → `{"ok":true}`
2. **分镜**
   - `curl -X POST http://你的IP/api/storyboard -H 'Content-Type: application/json' -d '{"text":"……","style":"黑白线稿"}'`
3. **单格生图**
   - `curl -X POST http://你的IP/api/image -H 'Content-Type: application/json' -d '{"prompt":"……","size":"1024x1024"}'`
4. **前端**
   - 打开 `http://你的IP/`，在“漫画生成器”区输入文本 → 生成分镜 → 开始并发渲染 → 右侧栅格出现图片与直链。
5. **一致性（可选实验）**
   - 先 `anchor_from_text` 得到 `anchor_b64`，再 `image_consistent`；相似度**仅用于筛选更像**，不等于强一致。

------

## 安全与运维建议

- **API Key 轮换**：泄露风险高时立即重置，`.env` 更新后 `systemctl restart comicgen`。
- **Nginx 加固**：`server_tokens off;`，必要时加 `limit_req`。
- **防火墙**：仅放行 22/80。
- **日志与告警**：后端与 Nginx 失败率飙升时提醒。
- **配额**：在前端限制最大并发=3，后端可加简单频控。

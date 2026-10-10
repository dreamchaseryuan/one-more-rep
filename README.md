# 动作库 · 健身助手

1324 个健身动作的中文检索 + 训练记录。纯前端、无后端、无账号，数据全在本地。

解决的实际问题：

- **找动作**：不用再反复开视频 App——搜「卧推」「腘绳肌」「哑铃」，拿中文分步说明和动画演示
- **记训练**：记组数重量次数，下次练同一动作**自动带出上次的数据**，方便判断该不该加重量

## 快速开始

```bash
npm install
npm run data:fetch-raw  # 拉上游原始数据（17.4 MB，需代理见下）
npm run data:build      # 清洗 + 裁剪 → public/data/exercises.json
npm run media:fetch     # 下载 1324 张缩略图（8.5 MB）
npm run dev             # http://localhost:5173
```

手机访问：`npm run dev` 会打印 Network 地址，手机连同一 WiFi 打开即可。

### 代理

Node 的 `fetch` **不读 `HTTP_PROXY` 环境变量**，在国内直连 GitHub 会全部静默失败。
`fetch-media.mjs` 检测到代理时会自动带 `NODE_USE_ENV_PROXY=1` 重启自己，无需手动处理。
如果代理没配环境变量，手动指定：

```bash
HTTPS_PROXY=http://127.0.0.1:7897 npm run media:fetch
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run typecheck` | 只做类型检查 |
| `npm run data:fetch-raw` | 拉上游原始数据 |
| `npm run data:build` | 重建精简数据集（改清洗规则/术语表后跑） |
| `npm run data:profile` | 数据集体检：规模、维度分布、中文覆盖率 |
| `npm run media:fetch` | 下载缩略图（8.5 MB） |
| `npm run media:fetch-videos` | 下载动画 GIF（122 MB） |
| `npm run icons` | 重新生成 PWA 图标（哑铃图形，手写 PNG 编码） |

## 目录

```
data/                        原始数据（不直接进前端）
  exercises.json             上游 17.4 MB 原始数据集
  name_zh.json               中文名映射
  terms.zh.json              部位/器械/目标肌 中英术语表
  name-overrides.json        人工校正表（10 条）
scripts/
  profile.mjs                数据集体检
  build-data.mjs             清洗 + 裁剪 → 精简数据集
  fetch-media.mjs            媒体下载 + 生成清单
src/
  lib/data.ts                加载 / 搜索 / 筛选 / 媒体回退
  lib/useFavorites.ts        收藏夹（localStorage）
  lib/useWorkouts.ts         训练记录：增删动作与组、上次成绩、进步曲线
  components/FilterBar       三维筛选
  components/ExerciseCard    动作卡片
  components/DetailPanel     动作详情抽屉
  components/WorkoutPanel    训练记录页
  components/ExercisePicker  选动作（复用同一套搜索）
  components/RestTimer       组间休息倒计时
  components/ProgressChart   最大重量走势
public/
  data/exercises.json        精简数据集 0.69 MB（前端实际加载的）
  media/images/              1324 张缩略图（8.5 MB）
  media/videos/              1324 个动画 GIF（122 MB，可选）
  media/index.json           本地已有媒体的清单
```

## 训练记录

完全存在浏览器 localStorage（`fitness:workouts`），没有服务端，换设备不同步。

**设计上的几个取舍：**

- **自动带出上次成绩**是核心，不是"记下来"。健身做加重量决策全靠「上次 60kg 做了 8 次」这条信息，
  每次训练每个动作都显示在名字下方。
- **加一组时继承上一组的重量次数**。连着做组时数字通常不变，少敲几次键盘。
- **新组默认不打勾**，打勾才计容量并触发休息计时。避免误记。
- **总容量 = Σ 重量 × 次数**。自重动作没填重量按 0 计，不污染数字。
- **重量/次数用字符串存**，不用 number。因为输入框允许是空的（自主动作），也允许半输入状态
  （比如刚敲了「6」还没敲完「60」），用 number 会把这些中间态变成 0 或 NaN。
- **进步曲线按「日期 → 结束时间」排序**。只按日期排的话，同一天练两次顺序不稳定，曲线会反向，
  看起来像退步——这是会误导训练决策的那种错。
- **日期用本地时间算**，不能用 `toISOString()`。那是 UTC，晚上练会被记成第二天。

**已知不足：**

- 同一天练两次同一个动作时，曲线两个点的 x 轴标签都是同一天，看不出先后（趋势方向是对的）。
- 没有计划/模板功能。想固定练某几个动作，得每次手动加。
- 没有导出。数据只在浏览器里，清缓存就没了。

## 数据管道做了什么

原始中文名是机器翻译，直接用在界面上很难看。`build-data.mjs` 做三件事：

1. **去翻译碎片**——英文复数/介词的残骸被留在了中文里：
   `摆臂悬垂直腿s` ← legs、`哑铃肱二头肌弯举带抬腿d` ← raised、`过a 凳` ← over a bench。
   判据：拉丁串 ≤2 字符、全小写、且与中文相邻。大写保留（`V字起身`、`JM卧推`、`SZ杆` 都是合法的）。
2. **去分词空格**——中文之间不该有空格：`辅助 仰卧 抬腿带侧向 下摆` → `辅助仰卧抬腿带侧向 下摆`。

   中↔拉丁、中↔数字之间的空格保留。
3. **裁剪与翻译**——丢掉用不上的 8 种语言说明，补上筛选维度的中文标签。

效果：1324 条从 17.4 MB 压到 0.69 MB，零条需要人工介入。

搜索能同时命中中文名、英文原名、目标肌、器械、部位、协同肌，多词用空格分隔是 AND 关系。

## 媒体与授权

- 代码与数据：**MIT**（© Hasan Emir Yıldırım）
- 演示图片与 GIF：**© Gym visual — https://gymvisual.com/**，以 180×180 分辨率授权转载，**必须保留署名**。
  界面上每个动作详情页底部都会显示该署名，不要去掉。
- 详见 `data/NOTICE.md` 与 `data/LICENSE`。

仅供个人使用。若要商业化，需先查阅 Gym visual 的使用条款，或换用
[free-exercise-db](https://github.com/yuhonas/free-exercise-db)（Unlicense 公共领域）。

## 部署（手机上用）

本地跑的问题是：**手机得连同一个 WiFi** 才能打开。而训练记录是在健身房做的，
那里用的是流量、不在家网——所以在健身房根本用不了。要解决只能发布到 HTTPS 上。

### GitHub Pages

**前置：仓库必须是 public。** 免费账号开不了 private 仓库的 Pages，需要 GitHub Pro。

```bash
git remote add origin https://github.com/<用户>/fitness-app.git
git push -u origin main
```

推送后：仓库 **Settings → Pages → Source** 选 **GitHub Actions**，等 workflow 跑完。

站点地址：`https://<用户>.github.io/fitness-app/`
手机上用 Chrome/Safari 打开，选「添加到主屏幕」，就是一个独立 App。

**发布前先确认一件事**：`*.github.io` 在部分网络环境下访问不稳定。
手机浏览器打开 `https://yuhonas.github.io/free-exercise-db/` 试一下，
能秒开就说明可用；打不开或很慢，就换下面的方案。

### 备选：Cloudflare Pages / Vercel

两者都可以连 **private** 仓库，免费，且国内可达性通常好于 github.io。
配置：构建命令 `npm run build`，输出目录 `dist`，其余同 GitHub Pages。
需要先在浏览器里授权它们的 GitHub App——这一步得你自己点。

### 部署相关的两个坑

- **`vite.config.ts` 里的 `BASE` 必须和仓库名一致**。项目站点在 `/<仓库名>/` 下，
  写死 `/data/...` 会全部 404。dev 和 build 用同一个 base，避免路径 bug 只在发布后暴露。
- **媒体不进仓库**（140 MB），由 CI 在构建时现拉（见 workflow 里的 `media:fetch`）。
  否则每次 CI 都要 checkout 140 MB。

## 已知取舍

- **媒体文件是可选依赖**。缩略图 8.5 MB，GIF 122 MB。两者都不在版本库里（见 `.gitignore`），
  缺了就用上游 URL 兜底，不会渲染成破图。没下 GIF 时详情页显示静态图并标注「动画需下载 GIF」。
- **部分中文名仍偏机械**，如「辅助坐姿胸肌大肌拉伸稳定球」。这是上游翻译的底子，
  遇到读着别扭的，在 `data/name-overrides.json` 里加一条 `"动作id": "改好的名字"` 再跑 `data:build`。
- **列表一次渲染 48 个**，其余按需加载。1324 个动作一次性挂载会明显卡顿。
- **没有后端**。收藏和训练记录都在浏览器 localStorage，换设备/清缓存就没了。

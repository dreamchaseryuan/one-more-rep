# 待办与优化建议

> 用途：把散在对话里的优化建议收在一处，免得换个会话就丢。
>
> **这不是排期表。** 每条都标了值得做的程度，标「低」的可能永远不做。
> 反过来，**这份文件里没有的东西就是不打算做**，不要再翻出来当待办。
>
> 这条规矩是踩过坑才立的：`plan-nutrition.md` 曾经标着「搁置」，结果每次开工前都要重新确认
> 一遍它到底做不做。所以下面专门有一节「明确不做」。见 [adr/0003](adr/0003-china-food-composition-as-seed.md)。

术语以 [../CONTEXT.md](../CONTEXT.md) 为准。

## 已修（留档，别再当新问题提一遍）

| 问题 | 症状 | 提交 |
|---|---|---|
| 非安全上下文下 `crypto.randomUUID` 未定义 | 局域网 HTTP 下点「开始训练」整页白屏 | `3943c92` |
| iOS 上休息计时结束不响 | `AudioContext` 没在手势里解锁，**静默**失败 | `19d60ad` |
| `media/index.json` 不在预缓存 | 离线或被墙时图全挂，连看过的图也不显示 | `见 vite.config.ts` |
| 纯文档改动触发完整部署 | 改个错别字也拉 130 MB 媒体重新构建 | `117abaa` |

## 值得做

### 1. 加测试（vitest）——这里回报最高

不是泛泛的「提高质量」。到现在踩的**每一个**功能 bug 都有同一个形状：
**出在纯函数里、不报错、只是安静地算错**。

- `localDate()` —— `toISOString()` 是 UTC，东八区晚上 8 点后算成第二天
- `isFilled()` / `touched` —— 计划预填的组被当成「实际做了」，污染上次成绩和加重建议
- `nextDayIndex()` —— 按下标推导，插入一个训练日后轮转整体错位
- `newId()` —— 非安全上下文兜底

再加 `parseBackup()`：v1→v4 四个版本各一条导入用例。

半天工作量，挡住的正是已经发生过的那类错误。**目前项目零测试。**

### 2. localStorage 写入加 debounce

`useWorkouts.ts` 和 `usePrograms.ts` 都是 `useEffect` 里无条件 `JSON.stringify(全量)` 再同步写。
练一年之后，改一个重量数字要序列化几千个 set 对象，而且 `localStorage` 是同步 API，会卡主线程。

加 300ms debounce 即可。**但必须配 flush** —— 页面隐藏或关闭时要把待写的补上，
否则最后几次改动会丢，那就比卡顿严重多了。

### 3. 删掉 CDN 兜底

`data.ts` 的 `mediaUrl()` 在本地缺图时回退到
`https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/...`。两个问题：

1. 注释写的是「保证任何情况下都有图」，但**这个域名在国内基本不通**，实际做不到
2. 该 URL 不含 `/media/` 路径段，**不匹配 workbox 的 `runtimeCaching` 规则，永远不会被缓存**

预缓存修好之后这条路径几乎不会走到，但留着它就是一个「看起来是兜底、实际是陷阱」的分支。
建议删掉回退，本地没有就显示占位并标注「本机未下载」。

## 可以做

### 4. 加重建议的三个查询建索引

`lastPerformance` / `bestSet` / `weightHistory` 都是 O(历史条数)，且会在 `WorkoutPanel` 里**按动作各调一遍**。
按 `history` 变化一次性建 `Map<exerciseId, ...>`。数据量大了才明显。

### 5. `BASE` 改成环境变量

`vite.config.ts` 写死 `/fitness-app/`，仓库改名就全站 404。
改 `process.env.BASE_PATH ?? '/fitness-app/'`，CI 里传。

### 6. CI 不拉 GIF

`deploy.yml` 里的 `media:fetch-videos` 会拉 122 MB，`dist` 因此是 140 MB。
GIF 是可选依赖（README「已知取舍」里写了），去掉这一步产物降到 18 MB 左右，
部署和移动端首次加载都受益。代价：线上详情页只有静态图。

### 7. 监听 `storage` 事件

两个标签页同时开着会互相覆盖（后写的赢）。个人自用影响小，优先级低。

### 8. 升级 CI 里的 action 大版本

构建时有告警：`actions/checkout@v4` 等被强制跑在 Node 24 上。不影响功能。

## 要先想清楚，不是技术问题

### 多设备数据同步

**打开**在多个设备上早就没问题了——它是个网站。但**数据**不跟着走：
localStorage 是按「浏览器 + 源 + 设备」隔离的，而且 Chrome 的账号同步**不覆盖** localStorage。

三条路：

| | 做法 | 代价 |
|---|---|---|
| A | 就只用手机，电脑上当成独立副本 | 零成本，但两边会分叉 |
| B | 手动导出 JSON → 传给自己 → 导入 | 零开发，适合偶尔切换 |
| C | 做云同步（复用 GitHub 账号，用私有 Gist 当存储） | 要开发，还要处理 token 存放和「两边都改了怎么办」 |

**建议先用 A 或 B 跑一段时间再决定。** C 引入的东西比看上去多，而多设备切换的真实频率
只有用过才知道；现在设计冲突合并策略是凭空猜。**饮食模块的教训就是「设计完了但没人用过」。**

## 明确不做

- **饮食模块**（2026-10-11 决定）。设计文档保留在 [plan-nutrition.md](plan-nutrition.md)，
  但那是**记录，不是待办**。重开之前先读那份文件开头。

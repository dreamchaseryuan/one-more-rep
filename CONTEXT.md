# 动作库 · 健身助手

一个自用的健身工具：中文动作库检索 + 按计划训练 + 训练记录。

## Language

### 动作库

**Exercise**：
一个可查的动作条目，含中文名、目标肌、器械、分步说明和演示媒体。是只读的参考数据。
_Avoid_: 动作、训练动作（和下面要练的东西混）

**Step**：
Exercise 的一条分步说明。
_Avoid_: 说明、指令

### 计划

**Template**：
随应用发布、**只读**的训练安排起点。只在被「选用」的那一刻起作用——被复制成一份 Program 之后，
Template 再怎么更新都与那份 Program 无关。
_Avoid_: 默认计划、计划模板（和 Program 混）

**Program**：
使用者拥有并可**编辑**的一整套训练安排，由若干 ProgramDay 按固定顺序循环组成，存在本地。
由某个 Template 派生而来，但派生之后与 Template 再无关联。
_Avoid_: 模板、课程、计划表

**ProgramDay**：
Program 里的一个**模板日**，规定这一天练哪些 Exercise、各几组、次数区间是多少。
它是**安排**，不是发生过的训练——同一个 ProgramDay 会被练很多次。
UI 显示为「推日 / 拉日 / 腿日」这类名字。
_Avoid_: 训练日（这个词专指下面饮食语境里的分类）、日程

**Warmup**：
ProgramDay 开头的一段练前准备，由若干 WarmupItem 组成。
**不是训练容量的一部分**：不产生 Set、不算 Volume、不给 Suggestion、不进 LastPerformance 比较。
_Avoid_: 准备活动、拉伸（静态拉伸属于练后，不是这个词）

**WarmupItem**：
热身里的一条，含名称和做法说明（"2 分钟"／"每侧 15 次"）。
带 `exerciseId` 的能看动作库的演示；不带的是动作库里没有的（开合跳、关节绕环、空杆活动）。
_Avoid_: 热身动作（会和 Exercise 混）

**RampUpSet**：
正式组之前，用同一个动作由轻到重走几遍，让神经系统先按工作重量和轨迹工作一次。
由工作重量推算，**只显示不记录**。
_Avoid_: 热身组（那会让人以为要记进容量里）

**RepRange**：
ProgramDay 为一个 Exercise 规定的次数区间 `[下限, 上限]`。达到上限意味着该加重。
_Avoid_: 次数、目标次数

**Suggestion**：
针对某次训练给出的建议重量与次数，由上次成绩和 RepRange 算出。是建议，不是事实。
_Avoid_: 目标、计划

**ProgramDaySnapshot**：
Workout 内嵌的一段文字，记录这次执行的是哪个 Program 的哪个 ProgramDay（计划名 + 训练日名）。
**故意冗余**：Program 会被编辑，只有把当时的名字抄一份进 Workout，历史才永远是当时的样子。
_Avoid_: 计划引用（那是 id，不是这个词的意思）

**Deviation**：
一次 Workout 的实际做法，与它执行的 ProgramDay 所规定内容的差异——少做了几组、重量偏离了 Suggestion。
计划是建议，Deviation 是事实与建议之间的距离。
_Avoid_: 偏差、差异、未完成（未完成只是 Deviation 的一种）

**Contraindication**（禁忌）：
使用者给某个 Exercise 打的「这段时间不适合我」的标记，通常因为伤病。
它不是删除动作——动作仍在库里、仍能搜到，只是不该出现在计划安排里。
_Avoid_: 禁用、黑名单、排除

### 训练

**Workout**：
**实际发生的一次训练**，有日期，含若干 Exercise 和各自的 Set。一次 Workout 通常执行某个 ProgramDay，
但也可以是计划外的自由训练。
_Avoid_: 训练日、session、记录

**Set**：
一次 Workout 里的一个组：重量、次数、是否完成。
_Avoid_: 组数（那是数量，不是这个条目）

**Volume**：
一次 Workout 的容量，等于各 Set 的重量 × 次数之和。只统计实际做了的 Set。
_Avoid_: 总量、负荷

**Best**：
某个 Exercise 历史上最重的一个 Set。
_Avoid_: 最佳成绩（和下面这个混）

**LastPerformance**：
某个 Exercise **最近一次**被练时的全部 Set。加重建议的唯一依据。
_Avoid_: 上次成绩（口语可以，写文档要区分于 Best）

### 饮食

> **2026-10-11：这块决定不做。** 下面三个词是当时定下的用语，代码里从未存在过，
> 保留只为读 `docs/plan-nutrition.md` 时有个对照。不要拿它们描述现在这个应用。

**TrainingDay / RestDay**：
给一个**日历日**分类：今天算不算练。饮食目标按这个分类给两套数字（碳水尤其不同）。
它是对**今天**的判断，不是 ProgramDay，也不是 Workout——而是「今天有没有训练安排」这件事。
_Avoid_: 训练日（会和 ProgramDay 混，说「今天是 TrainingDay」而不是「今天是训练日」）

**FoodEntry**：
一条可记录的食物。要么引用成分表里的食材，要么是使用者自建的（菜品、补剂、某个店的做法）。
每条都带一个 Portion。

**Portion**：
一条 FoodEntry 的默认计量单位，如「1 碗 = 200g」「1 个 = 90g」。
**不是附属信息**：使用者的语言单位是「碗」「个」「勺」，从来不是克。
_Avoid_: 份量、单位

### 判定用词

**Touched**：
一个 Set 被使用者动过（打过勾，或亲手填过重量次数）。计划预填的 Set 在被动过之前不算 Touched。
这是「预填」和「实际做了」的分界线。
_Avoid_: 已填写、已完成（已完成特指 done）

**Done**：
一个 Set 被使用者打勾确认做过。
_Avoid_: 完成、checked

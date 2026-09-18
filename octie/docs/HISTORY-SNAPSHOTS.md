# 历史快照与恢复(HISTORY-SNAPSHOTS.md)

> 定位:**历史快照只用于灾难恢复**(整个项目进度被意外删除/损坏时),
> **不要用它做日常回退**。日常"改错了想退"请走 need_fix / 重新 approve 的既有流程。

## 快照是什么

- 每次写操作(create/update/approve/delete 等)都会向 `.octie/history/` 追加一条
  不可变记录:`history.ndjson`(元数据日志)+ `history/snapshots/<snapshotId>.json`
  (完整的 project.json 副本)。
- 快照是**追加只增**的:恢复操作本身也会先自动打一个 `pre_restore` 快照,
  再补一条 `history_restore` 记录 —— 恢复永远可以再来一次,历史不会被"倒带"。
- 查看:`octie history list`;恢复:`octie history restore <snapshotId>`;
  DSH 工具:`octie_history`。

## 恢复会回退什么(粒度 = 整个 project.json 回到快照时刻)

恢复快照是**整文件替换**,不是按字段挑选。以下内容全部回到快照时刻的状态:

| 被回退 | 说明 |
|---|---|
| 任务状态 status | 包括已批准的任务:**快照之后才 approve 的任务会退回当时的中间状态**(如 in_progress/ready),批准事实被抹掉 |
| 验收标准/交付物/返工项 | 各项的勾选状态、新增/删除的条目,全部回到快照时刻 |
| completed_at 等时间戳 | 回到快照时刻的值 |
| blockers / edges / dependencies | 图结构整体回退 |
| notes | 回到快照时刻的文本 |

## 恢复**不会**动什么

| 不受影响 | 说明 |
|---|---|
| 历史库本身 | `history/` 只增不减,恢复前的现场由 `pre_restore` 快照保存 |
| 备份文件 | `.octie/project.bak.*` 原样保留 |
| 子项目 | `.octie/subprojects/*` 是独立 Octie 项目,各自有自己的 project.json 与历史 |
| 全局注册表 | `~/.octie/projects.json` 不受影响 |
| 代码与 git | 源码文件、提交历史完全不动 —— 快照里只有任务图数据 |

## 推荐姿势

- **灾难恢复**:`.octie/project.json` 被误删/损坏/大面积错乱时,`octie history list`
  找到损坏前的快照,`octie history restore <snapshotId>`,然后逐项核对关键任务状态。
- **恢复后必须人工复核已批准任务**:凡是快照时刻之后才批准的任务,恢复后处于未批准
  状态,需要重新走一遍 review/approve —— 这是有意设计,不是缺陷。

## 不推荐姿势

- ❌ 日常回退某次 update/approve(用 need_fix 标记问题、重新 approve 即可)
- ❌ 当作"撤销"快捷键反复穿梭(每次恢复都整库回退,包括无关任务)

## 备份文件的版本库约定

写操作前 Octie 会留 `.octie/project.bak.<timestamp>` 备份;一次会话可积累 20+ 个。
它们是本地灾难恢复设施,**不进入版本库**:

- 在使用 Octie 的项目侧 `.gitignore` 中加一行:`.octie/project.bak.*`
  (如果整个 `.octie/` 都不入库,直接忽略 `.octie/` 即可,本仓库即如此)。
- 提交前若发现 `project.bak.*` 出现在 `git status`,说明忽略规则缺失,先补规则再提交。

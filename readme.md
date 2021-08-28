# 球球英雄、球球竞技、玩个球 辅助工具
> 全自动 AI 玩游戏，比按键精灵更灵活！独特的游戏算法，自动创建球球、升级球球、合并球球等。
- Mr Runic Email：demo2013@vip.qq.com
- 教程视频：https://www.bilibili.com/video/bv1nh411Z7cU

## 使用说明
> 该项目仅供学习参考！
- Lua 脚本 配合 《球球英雄》 客户端使用。
- 目前支持自动 看广告、合作模式、竞技模式领取免费广告宝箱等。
- 球球会自动升级，合并球球。
- 推荐模拟器 《雷电模拟器》

# 项目部署
- 1.安装运行依赖 `npm install`
- 2.启动当前 node 项目 `npm run start`
- 3.修改 Lua 注入文件中的 url 参数 为当前项目 ip，不能是 127.0.0.1 安卓设备内部不识别。
- 4.拷贝 当前目录下的 game.luac 和 runic.lua 到 安卓设备目录下，启动游戏即可。启动成功左侧会有一个问号图标。
    - 贪玩渠道目录：`/data/data/com.tanwan.qiuqiu.yx/file/com.tanwan.qiuqiu.yx/src/` 
    - 跃游渠道目录：`/data/data/com.gzyy.qqyxdt/file/com.tanwan.qiuqiu.yx/src/` 

# 运行截图
<div>
    <img style="width: 100%" src="./img/prview.png" />
</div>

TODO

# 更新记录
- 1.0.6
    - `add` 合并算法优化，暗杀大师登场前，优先合并低星球球。
- 1.0.5
    - `add` 优化复制球球、合体球球、升星合并算法。
    - `add` Sp富裕时再升级纯辅助型球球。
    - `add` 升级球球 Lv 分先后顺序：攻、召、控、辅。
- 1.0.4
    - `fix` 七星球球不处理合并。
    - `add` 复制球球、合体球球、升星球球合并算法。
- 1.0.3
    - `add` 升级球球 Lv 时机判断。
    - `add` 登录游戏自动完成任务、观看广告。
    - `add` 登录游戏完成隐藏任务 `分享得钻石` 邮箱可领取（每天50钻）。
- 1.0.2
    - `fix` 对手投降处理，判断重开游戏。
    - `fix` 每日任务三次广告视频自动观看。
    - `add` 商店广告自动观看，领取免费宝箱和钻石。
    - `add` 天胡开局处理，判断合并一次球球。
    - `add` BOSS击杀球球抢救（混沌三体）。


# GitHub Pages 测试部署

当前项目是纯静态站点。保持 `config.persistence.mode = "local"`，不需要 Workers、D1、域名或服务器。此配置不会调用或更新 Cloudflare 的部署。

## 首次启用

1. 将当前完整源码推送到你有管理权限的目标仓库。GitHub Free 的 Pages 需要公开仓库；不要为了启用 Pages 自动将已有私人仓库转为公开。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 生产分支默认为 `main`；如目标仓库不同，修改 `.github/workflows/github-pages.yml` 中的分支名。
4. 推送 `main`，或在 Actions 中手动运行 **Deploy travel plan to GitHub Pages**。
5. 以成功的 `deploy` job 输出 `page_url` 为实际网址，不根据仓库名称猜测部署已成功。

Actions 会执行地图构建、轻量校验、存储及回归测试、`npm run build:pages`，最后上传 `_site` 并部署。工作流使用 GitHub 自带的短期 `GITHUB_TOKEN` 和 OIDC，不需要把 PAT 写进源码或仓库变量。

## 发布边界

`build:pages` 仅复制页面必需的 HTML、CSS、JS、旅行 JSON、已登记且被引用的固定地图底图和许可文件。不会发布 `.git`、`.env`、浏览器本地账本、私人原始文件、测试资料或可选 Cloudflare 后端。生成目录 `_site/` 已忽略，不提交到 Git。

构建会阻止非本地保存模式、潜在身份证号码或访问密钥、真实敏感字段、门票文档以及未经审查的地图文件。它不会擅自删除或修改内容；遇到阻挡应先审查、确认再发布。自动检测不能代替发布前的人工作业。以后添加个人资料、票据或联系人时，应先检查公开风险。

日期、住宿地址和用户提供的订单金额属于当前明确要求保留的公开旅行内容。网址及公开仓库可被他人查看。

## 子目录与本地数据

页面入口、脚本、样式、`trip-data.json` 和地图底图使用相对路径；不要增加 `<base href="/">` 或改为根路径 `/assets/...`。该站点可部署在仓库子目录，不需要构建时注入仓库名称。

待办、门票状态、成员、账单、美食偏好只保存在当前设备的本浏览器。GitHub Pages 和 Cloudflare 是不同的 origin，不会自动搬迁或同步现有本地数据；原站记录保留在原站，访问新站不会删除它们。清理站点数据会清除该站点的本地记录。

Google Maps 嵌入与外部导航依赖第三方网络；本地静态路线示意图不依赖其服务。中国大陆实际可达性需由六位家庭成员自行测试，开发环境测试不代表大陆网络结果。

## 验证

已在模拟 `/Travel-Plan-Page/` 前缀下检查首页、底图、八天行程、准备勾选刷新保存、美食和记账，以及 390/768/1440 像素宽度；未发现必要资源 404、后端请求或 JavaScript 异常。实际发布后应在 GitHub 返回的 HTTPS 地址重复检查。未验证真实 iPad Safari 或中国大陆线路。

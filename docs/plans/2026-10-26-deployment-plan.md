# pic-to-pindou 部署到免费服务器的完整操作方案

- 日期：2026-10-26
- 适用对象：本仓库 `pic-to-pindou`（React 19 + Vite 8 + Zustand + Tailwind 4 + Web Worker）
- 结论先行：**这是一个零后端、零 API 调用、零登录的纯静态前端**，不需要"服务器"，只需要"静态托管"。最省事且完全免费的路径是 Cloudflare Pages（Git 推代码即部署）。本文给出 4 条可选路径，主推方案 A。

---

## 一、技术栈判定：为什么不用起服务器

| 判定项 | 实际情况 | 证据 |
|---|---|---|
| 运行形态 | 纯浏览器端 SPA，无 SSR、无 Node 服务端 | `src/main.tsx` 只 `createRoot` 挂载，无服务端入口 |
| 后端接口 | 无。全部逻辑本地计算 | 全仓库 `src/` 内 `fetch(` / `http://` / `import.meta.env` **零命中** |
| 客户端路由 | 无（单页，无 react-router） | `package.json` 无路由库；`src/App.tsx` 只在宽/窄屏两种布局间切换 |
| 状态持久化 | 无 localStorage / sessionStorage | `src/state/store.ts` 全内存 |
| 耗时计算 | Web Worker 内完成 | `src/workers/convert.worker.ts`，主线程只发消息 |
| 数据出口 | 图片导出为本地 PNG 下载 | `src/export/downloadPng.ts` → `canvas.toBlob` + `<a download>` |
| 构建产物 | `dist/`，约 300 KB 原始 / 约 94 KB gzip（JS 89 KB + CSS 4.7 KB + worker 19 KB） | 本地 `npm run build` 实测通过 |
| 运行环境要求 | 浏览器需支持 ES module Worker（Chrome/Edge 80+、Safari 15+、Firefox 114+） | `new Worker(url, { type: 'module' })` |

**结论：** 没有数据库、没有密钥、没有回调域名、没有跨域问题、没有 SSR 兼容性问题。任何"申请一台免费 VPS 再手工部署"的方案都只是把 CDN 的活儿手工干一遍，还多了运维和升级负担。真正需要"服务器"的地方只有一个——**把 `dist/` 目录挂到一个域名下**。

> ⚠️ 唯一的技术约束：module worker + `crossorigin` 脚本在部分极老浏览器上会失败。若需要兼容 IE/旧安卓，用 `vite-plugin-legacy` 另说（当前不建议，收益低）。

---

## 二、平台选型对比（2026-10 实时核对）

| 平台 | 免费额度要点 | 商用允许 | 接入方式 | 本项目适配度 |
|---|---|---|---|---|
| **Cloudflare Pages** | 500 次构建/月；静态带宽不限量；站点数不限 | 允许 | Git 集成，push 自动构建 + PR 预览 | ⭐⭐⭐⭐⭐ 零配置，推荐 |
| Cloudflare Workers（Static Assets） | 静态资源请求免费、不限带宽 | 允许 | wrangler CLI / CI | ⭐⭐⭐⭐ Cloudflare 当前主推的新项目路径，但需自己配 CI |
| Vercel Hobby | 100 GB 带宽；**明确仅限非商业用途** | ❌ 不允许 | Git / CLI | ⭐⭐⭐ 能用，但"商用禁止"是硬伤 |
| Netlify Free | 约 15 GB 带宽等效（300 credits 池，约 20 次生产部署/月） | 允许 | Git / 拖拽 dist | ⭐⭐⭐ 额度最紧 |
| GitHub Pages | 100 GB/月软限，1 GB 存储 | 允许 | Actions 构建 | ⭐⭐⭐ 需要改 `base` 路径，坑最多 |
| Oracle Cloud Always Free | 永久免费 2 台 ARM VM（1 GB RAM/VM） | 允许 | 手工 SSH + Nginx | ⭐⭐ 严重浪费（1 GB 内存跑静态文件绰绰有余但完全没必要） |

**推荐：方案 A（Cloudflare Pages）。** 理由：唯一同时满足"带宽不限量 + 允许商用 + 零配置 push 部署 + 自定义域名 + 自动 HTTPS"的免费选项。Netlify 额度最紧、Vercel 有商用禁令、GitHub Pages 需要改构建路径。

---

## 三、方案 A（推荐）：Cloudflare Pages + Git 自动部署

### A0. 前置检查（本地，1 分钟）

```bash
npm ci          # 用 package-lock.json 精确复现依赖
npm run build   # 期望输出 dist/index.html + dist/assets/*
npm run preview # 本地以生产模式预览 http://localhost:4173
```

本地已实测通过（`vite v8.3.5`，61 modules，2.66 s）。

> ⚠️ **分支前置检查（本次踩过的坑）**：Cloudflare Pages 报错
> `npm error enoent Could not read package.json: ... /opt/buildhome/repo/package.json`
> 时，**不是构建命令写错，也不是 Node 版本不对，而是「克隆下来的那个分支里没有 `package.json`」**。
> 排查顺序：① 该分支上有没有 `package.json`；② Cloudflare 的 Root directory 是不是 `/`（填错会把仓库根当成子目录）；③ 再看构建命令与 Node 版本。
>
> 本仓库当前 `main` = `a6feb1e`（仅 docs）→ 选 `main` 必挂；`develop` = `b3514d1`（完整源码）→ 可构建。

> ⚠️ **lockfile 平台覆盖检查（第二个坑，比第一个更隐蔽）**
>
> 现象：Linux 构建机上报
> `Error: Cannot find native binding` / `Cannot find module '@rolldown/binding-linux-x64-gnu'`。
> 根因：仓库的 `package-lock.json` 是**增量安装**出来的，只记录了 Windows 平台的二进制包（66 条，`@rolldown/binding-win32-x64-msvc`、`@esbuild/win32-x64`、`@tailwindcss/oxide-win32-x64-msvc`、`lightningcss-win32-x64-msvc` 各一条），Linux 平台的等价包一条都没有。`npm ci` 严格照 lock 安装，于是 Linux 上装出来的 `rolldown` / `@tailwindcss/oxide` / `lightningcss` 全都没有可用的原生模块。
>
> 一行检查（Linux 平台条目数应为 20+，为 0 就是这个问题）：
>
> ```bash
> node -e "const l=require('./package-lock.json');console.log(Object.keys(l.packages).filter(k=>k.includes('linux')).length)"
> ```
>
> 修法：删掉 lock 重新生成，让它记录全部平台产物（本仓库实测 66 → 119 条，linux 26 条）。
> **`npm install --package-lock-only` 不会修复已有的 lock**（它照抄旧内容），必须 `rm` 掉 lock 再装。
>
> 另注：`@biomejs/biome` 需钉在 `2.6.2`。2.6.3 的 `@biomejs/cli-win32-x64` 在 npmmirror 上 404，重新解析会跳到 2.6.3，导致本机 `npm run lint` 找不到二进制。

### A1. Cloudflare 侧一次性配置

1. 注册 <https://dash.cloudflare.com>（免费，无需信用卡）。
2. 左侧 **Workers & Pages → Create application → Pages → Connect to Git**。
3. 授权 Cloudflare 访问 GitHub，只勾选 **`pic-to-pindou`** 这一个仓库（最小权限）。
4. 选择分支：**当前必须选 `develop`** —— `main` 上只有初始提交 `a6feb1e`（仅 docs，无 `package.json`），全部源码在 `develop`（`b3514d1`）。选 `main` 会在构建时报 `npm error enoent Could not read package.json`。

   > ⚠️ 长期应把 `develop` 合并回 `main`，让生产分支回到主线。合并是 git 写操作，由 lhl 执行；在此之前 Cloudflare 的 Production branch 保持 `develop`。

### A2. 构建参数（关键，别填错）

| 字段 | 填写值 |
|---|---|
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/`（仓库根） |
| Node.js version | 建议在 Settings → Builds → Environment variables 加 `NODE_VERSION` = `22` |

> **Node 版本必须显式指定。** 本项目用 Vite 8 + TypeScript 6，Vite 8 要求 Node `^20.19.0 || >=22.12.0`。Cloudflare 构建镜像默认 Node 版本可能低于此，表现为"本地好好的、CI 上 `Cannot find module` / 语法报错"。加 `NODE_VERSION=22` 一劳永逸。

### A3. 首次部署与访问

点 **Save and Deploy**。约 1–2 分钟后拿到地址：

```
https://pic-to-pindou.pages.dev
```

### A4. 自定义域名（可选，免费）

- 有自有域名：Pages 项目 → Custom domains → Add → 填 `xxx.com` 或 `www.xxx.com` → 回到 Cloudflare 的 DNS 页加一条 CNAME 指向 `pic-to-pindou.pages.dev` → 等证书自动签发（数分钟）。
- 无域名：直接用 `*.pages.dev` 子域，HTTPS 已自动附带。

### A5. 缓存与响应头（建议加）

新建 `public/_headers`（Vite 会原样复制到 `dist/_headers`）：

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

- `assets/` 下文件带内容哈希（`index-B3rN-BJL.js`），可以永久缓存；
- `index.html` 必须每次回源校验，否则发新版后用户拿到旧 HTML 引用旧 JS。

新建 `public/_redirects`（本项目当前**不需要**，留作将来加路由时的伏笔）：

```
/*  /index.html  200
```

> 本项目无客户端路由，这行加不加都能跑。加上的好处是将来接入 `react-router` 时不用回头改。

### A6. 日常发布流程

```
本地 develop 改完 → 推 origin/develop → Cloudflare 自动构建 → 约 1 分钟出新站
```

Cloudflare 每次 push 都会留一个可回滚的 Deployment，旧版本在 Deployments 列表里一键回滚。

> 待 lhl 把 `develop` 合并回 `main` 之后，把 Cloudflare 的 Production branch 切回 `main`，发布流程再改成「合并到 main → 自动构建」。

---

## 四、方案 B（本项目实际走的路径）：Cloudflare Workers Static Assets

> 2026-10-27 补充：实际在 Cloudflare 上建的**就是 Workers 项目**（Deploy command 为 `npx wrangler deploy`），流程与本方案一致。因此 `wrangler.jsonc` 不是可选项 —— 没有它 `wrangler deploy` 直接报错 `Missing entry-point`，构建通过也发不出去。

Cloudflare 已把 Workers Static Assets 作为 2026 年新项目的推荐路径（Pages 仍完整支持、不废弃，但新功能先落在 Workers）。

改动很小，多两个文件：

`wrangler.jsonc`：

```jsonc
{
  "name": "pic-to-pindou",
  "compatibility_date": "2026-10-27",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

> `name` 必须与 Cloudflare 上的 Worker 服务名一致（本仓库为 `pic-to-pindou`），否则会新建出第二个服务。
> 本地可先用 `npx wrangler deploy --dry-run` 验配置（不需要登录、不会真发布）：正常输出 `Read 6 files from the assets directory .../dist`。

`package.json` 增加脚本：

```json
"deploy": "npm run build && wrangler deploy"
```

流程：`npm i -D wrangler` → `npx wrangler login` → `npm run deploy` → 得到 `https://pic-to-pindou.<subdomain>.workers.dev`。

**何时选它：** 未来若要加后端（D1 数据库、R2 存图、Workers AI），静态资源和 API 放一份部署里更省事。
**何时别选它：** 只是想上线一个纯静态站时，方案 A 少写两个文件、多白拿 PR 预览。

### B1. 部署后如何访问

**① 默认地址（无需域名，部署完就有）**

Workers 项目的默认域名格式是 `https://<服务名>.<账户子域>.workers.dev`。位置：

> Cloudflare Dashboard → Workers & Pages → `pic-to-pindou` → 概览页顶部 / **Settings → Domains & Routes**

该页会有两条记录：一条 `pic-to-pindou.<子域>.workers.dev`（Workers.dev 子域），一条 `*.workers.dev` 的通配规则。
若只有通配、没有具体那条，说明 **Workers.dev 子域未启用**：同页点 `Enable` / `Add` → 选 `Workers.dev` → 保存，几秒后生效。
账户子域是账号级设置，可在该页或 **Workers & Pages → 账户设置** 里查看/修改，格式形如 `lhl.workers.dev`。

**② 绑自有域名（推荐，比 workers.dev 在国内稳得多）**

前提：域名**托管在同一个 Cloudflare 账户**（NS 指向 Cloudflare）。

> Workers & Pages → `pic-to-pindou` → **Settings → Domains & Routes → Add → Custom domain** → 填 `pindou.example.com`（子域或根域都行）→ Add domain

Cloudflare 会自动建 DNS 记录、自动签发证书，通常 1–2 分钟生效。**不要手工加 CNAME**，`Custom domain` 走的是 Worker 专属证书链路，手工 CNAME 会证书不匹配。

域名不在 Cloudflare 上：两条路 —— ① 把 NS 改到 Cloudflare（免费，最省事，改完再按上面加 Custom domain）；② 保持 DNS 在别处、只加一条 CNAME 指向 `pic-to-pindou.<子域>.workers.dev`：能通，但访问的是 worker 的证书，浏览器会报域名不匹配，**不推荐**。

**③ 用配置声明路由（想让域名进代码库时）**

`wrangler.jsonc` 里加：

```jsonc
"routes": [
  { "pattern": "pindou.example.com", "custom_domain": true }
]
```

之后 `npm run deploy` 会顺带把域名绑上，不用每次点面板。注意域名必须已在该账户内，否则部署会报错。

**④ 国内访问的现实**

`*.workers.dev` 在国内经常被 DNS 污染，直连不稳。自有域名 + Cloudflare 代理会好一些，但仍然绕境外网络，延迟高、偶发丢包。
纯静态站若面向国内用户且要稳定，正解是国内 OSS/COS + CDN（需备案），Cloudflare 只作为海外镜像。这一点在选平台时就该纳入判断。

**⑤ 上线后自检**

```bash
curl -sI https://<域名> | head -5          # 期望 HTTP/2 200，含 cf-ray
curl -sI https://<域名>/assets/<主 js> | grep -i cache-control   # 期望 immutable
```

浏览器里再过一遍：控制台无报错、`convert.worker-*.js` 加载成功（Network 里能看到）、拖图转换正常、导出 PNG 能下载。


---

## 五、方案 C（备选）：GitHub Pages

**坑在路径。** GitHub Pages 发布在 `https://<user>.github.io/pic-to-pindou/` 子路径下，而 Vite 默认 `base = '/'`，生成的资源引用是 `/assets/xxx.js` —— 绝对路径会指向站点根目录，**404 白屏**。

必须改 `vite.config.ts`：

```ts
export default defineConfig({
  base: './', // 相对路径，同时兼容 GitHub Pages 子路径与自定义域名根路径
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

`base: './'` 是相对引用，部署在根路径或子路径都能工作，**这是 GitHub Pages 方案的必要改动**。

配套：新建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

仓库设置：Settings → Pages → Source 选 **GitHub Actions**。

**注意：** GitHub Pages 在国内访问稳定性一般，且 `favicon.svg` 在 `index.html` 里写的是绝对路径 `/favicon.svg`，同样需要跟着 `base` 调整（Vite 会自动改写 HTML 中的 `/favicon.svg`，但若手工写死需留意）。

---

## 六、方案 D（真·"免费服务器"）：Oracle Cloud Always Free + Nginx

只有当你**明确要一台自己掌控的机器**（比如以后要加 Docker、自建反向代理、跑定时任务）时才选。

1. 注册 Oracle Cloud（Always Free 层，选 `VM.Standard.A1.Flex`，ARM 架构，1 GB OCPU + 1 GB RAM 免费额度，可选到最多 4 核 24 GB）。
2. 常见坑：ARM 机型在部分区域**常年缺货**，换墨尔本/斯德哥尔摩等区域更容易开出来。
3. Ubuntu 22.04/24.04 ARM 镜像，开机后装 Nginx：

```bash
sudo apt update && sudo apt install -y nginx
sudo mkdir -p /var/www/pic-to-pindou
# 把本地 dist/ 内容 rsync 上去
sudo rsync -av --delete dist/ user@<ip>:/var/www/pic-to-pindou/
```

4. Nginx 配置：

```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /var/www/pic-to-pindou;
  index index.html;

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

5. 防火墙需同时放行 **80/443**（Oracle 云安全列表 + OS 内部防火墙两层）。
6. HTTPS：用 `certbot --nginx -d your-domain.com` 签 Let's Encrypt 证书；无域名可用 `nip.io` 之类的免费映射域名，但需自己续签，麻烦。

**运维现实：** 1 GB 内存的机器跑静态文件毫无压力，但也毫无必要；一旦超售被回收（Oracle 回收空闲实例的策略）、SSH 端口被封、证书过期，都是纯静态托管不会有的故障模式。

---

## 七、方案对比速查表

| 维度 | A. Cloudflare Pages（推荐） | B. CF Workers Static Assets | C. GitHub Pages | D. Oracle Cloud + Nginx |
|---|---|---|---|---|
| 成本 | ¥0 | ¥0 | ¥0 | ¥0 |
| 商用允许 | ✅ | ✅ | ✅ | ✅ |
| 带宽 | 不限量 | 不限量 | 100 GB/月软限 | 机房流量（实测） |
| 需要改代码 | ❌ 无需 | 加 2 个配置文件 | ⚠️ 必须改 `base: './'` | ❌ |
| 部署方式 | 推代码自动 | 跑 `npm run deploy` | Actions 自动 | 手工 rsync |
| 自定义域名 + HTTPS | ✅ 一键 | ✅ | ✅（需 CNAME） | ✅ 需 certbot |
| 运维负担 | 零 | 低 | 零 | 高（证书/防火墙/回收） |
| 适合本项目 | ✅ | 将来要加后端时 | 不想用 CF 时 | 只想自己掌控机器时 |

---

## 八、上线前检查清单

- [ ] `npm run build` 本地通过，`dist/index.html` 与 `dist/assets/*` 齐全
- [ ] `package-lock.json` 覆盖 Linux 平台产物（`node -e` 检查 linux 条目 > 20，为 0 则 CI 必挂）
- [ ] 根目录有 `wrangler.jsonc`（Workers 项目）或 Pages 已设 output `dist`
- [ ] `npm run preview` 下手动验证：拖图 → 调参数 → 预览 → 逐格涂色 → 撤销 → 导出 PNG 全流程
- [ ] 生产环境确认 `NODE_VERSION=22` 已设置（否则 Vite 8 可能构建失败）
- [ ] 确认部署分支是 `develop`（`main` 目前只有 docs，无 `package.json`）
- [ ] 打开线上站，DevTools Network 面板确认 **无 404**（尤其 `/favicon.svg` 与 worker chunk）
- [ ] 确认 worker chunk 以独立文件加载成功（`convert.worker-*.js`），控制台无 `Failed to construct 'Worker'` 报错
- [ ] 手机端打开一次（窄屏是底部抽屉布局，与宽屏两套壳）
- [ ] 故意发一次空状态 / 非法参数，确认提示文案正常
- [ ] （可选）加 `_headers` 缓存策略
- [ ] 自定义域名（若有）+ HTTPS 生效

---

## 九、推荐执行顺序

1. **先做 A1–A3**（Cloudflare 建项目、填参数、部署），拿到 `pages.dev` 地址，全程 10 分钟，不改任何代码。
2. 线上跑一遍第八节的检查清单。
3. 通过后再决定要不要加 `_headers` / `_redirects`（`public/` 目录新增两个文件，构建时自动进 `dist/`）。
4. 需要自定义域名就挂上。
5. **B/C/D 三个备选先不动**，等 A 跑顺了再说。真要换，随时改配置重部署，成本几乎为零。

---

## 十、备注

- Git 写操作（add / commit / push）由 lhl 本人执行，Agent 不代劳；本方案只涉及托管平台侧配置与少量构建配置文件的编辑。
- 本项目 `main` / `develop` 分支模型、`base` 改动是否影响现有开发流程等影响面，见 `AGENTS.md` 与 `docs/agents/`。
- 若将来引入后端（存图、账号、云端同步），主路线应切到 **方案 B**，并评估是否迁移到 WorkBuddy 内置的云服务（`cloud-service` skill）而非自建。

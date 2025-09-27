# 伯努利风筝实验室（第七页交互）

这是一个基于 Vite + TypeScript + p5.js 实现的 H5 交互单页，支持 iframe 嵌入与 UMD 方式挂载。学生可以通过风势、提线角、拉力三个参数探索伯努利原理，并完成“稳定飞行≥2秒”的目标。

## 功能亮点

- **三参数操控**：风势、提线角、拉力滑条，支持两参数降级模式。
- **教学模式**：显示升力/重力/拉力向量及数值，辅助讲解。
- **性能模式**：关闭粒子气流等特效，保障低端设备流畅。
- **成绩回调**：稳定判定达标后通过 `postMessage` 与外部回调同步。
- **状态持久化**：通过 LocalStorage 与 URL Hash 记忆上次成绩与参数。

## 快速开始

```bash
npm install
npm run dev
```

开发服务器启动后访问 `http://localhost:5173` 即可实时预览。

## 构建与产物

```bash
npm run build
```

构建完成后生成：

- `dist/index.html`：iframe 直接引入的页面（资源均为相对路径）。
- `dist/kite-lab.umd.js`：可在父页面直接挂载的 UMD 包（全局 `window.KiteLab`）。

如需本地预览打包结果：

```bash
npm run preview
```

## 单元测试

项目使用 Vitest 针对物理模型进行单测。

```bash
npm run test
```

## API 概览

所有类型定义见 `src/types.ts`。

```ts
import { KiteLab, InitOptions } from 'kite-lab';

KiteLab.mount(container, options);  // UMD 方式
KiteLab.init(options);              // iframe 内部自初始化
KiteLab.setTheme('ink');
KiteLab.setLocale('en');
KiteLab.setParams({ wind: 3 });
const state = KiteLab.getState();
KiteLab.reset();
KiteLab.destroy();
```

`InitOptions` 主要字段：

- `theme`: `'light' | 'ink' | 'auto'`
- `locale`: `'zh' | 'en'`
- `mode`: `'learn' | 'quiz'`
- `defaultParams`: `{ wind, angle, tension }`
- `enableParticles`: 布尔值，是否默认开启气流粒子
- `twoParamMode`: 布尔值，是否启用两参数模式
- `onReady` / `onScore` / `onStateChange` / `onEnd`: 生命周期回调

## iframe 与父页通信

所有消息均包含 `source/target: 'kite-lab'` 字段。

### 子页发送

- `ready`：准备完毕
- `state`：状态快照
- `score`：得分 `{ stableSec, attempts, passed }`
- `end`：销毁通知

```js
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'kite-lab') return;
  const { type, payload } = event.data;
  if (type === 'score') {
    console.log('稳定飞行', payload);
  }
});
```

### 父页指令

- `set-theme`
- `set-locale`
- `set-params`
- `reset`
- `get-state`

```js
iframe.contentWindow?.postMessage({
  target: 'kite-lab',
  type: 'set-params',
  payload: { wind: 3, angle: 20 }
}, '*');
```

## 目录结构

```
kite-lab/
├── public/            # iframe 模板
├── src/               # TypeScript 源码
├── test/              # Vitest 单测
├── vite.config.ts     # 构建配置（含 UMD 输出）
├── tsconfig.json
└── package.json
```

## 授权

本项目仅用于教学演示，可按需二次开发与部署。

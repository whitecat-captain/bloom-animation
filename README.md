# Bloom Animation Generator

Bloom Animation Generator is a web app for creating 3D flower-bloom animations. Start from a procedural flower, tune the visual and motion controls, then preview or export the result as a polished blooming clip.

👉 **Live Web App:** [bloom-animation-mu.vercel.app](https://bloom-animation-mu.vercel.app)

![Bloom Animation Generator demo](./public/bloom-animation-generator-demo.gif)

[Watch the MP4 demo](./public/bloom-animation-generator-demo.mp4)

You can adjust:

- Flower presets and overall bloom style
- Petal colors, outlines, material, and render style
- Petal geometry, curl, width, length, and 3D form
- Petal arrangement, count, golden angle, radius, height, and tilt
- Wind, natural variation, jitter, and organic motion details
- Stem and leaf visibility, shape, color, and placement
- Animation timing, preview playback, background, camera framing, and export settings

<details>
<summary><strong>两种玩法 · Two ways to use this repo</strong></summary>

### 1. 想理解 / 复刻这套绽放原理 — 看施工图

不想跑代码、只想搞懂「一朵花是怎么被代码绽放出来的」，看这两份（都在 [`flower-bloom-blueprint/`](flower-bloom-blueprint/) 文件夹）：

- **施工图（总览图）** — [`flower-bloom-blueprint.png`](flower-bloom-blueprint/flower-bloom-blueprint.png)（9:16；矢量版 [`flower-bloom-blueprint.svg`](flower-bloom-blueprint/flower-bloom-blueprint.svg)）：一张图看懂五层结构 + 每层背后的真实公式。
- **施工文件（精确底稿）** — [`flower-bloom-blueprint.md`](flower-bloom-blueprint/flower-bloom-blueprint.md)：把整份文档交给 Claude，说「按这份施工图，用 Three.js 复刻一个可交互、可调参数的花朵绽放动画」，即可从零复刻。

### 2. 想直接用这套工程，给「另一朵花」生成绽放动画

直接复用本仓库的代码，为任意一朵花生成它专属的绽放页面：

1. Clone 本仓库。
2. 安装依赖：

   ```bash
   npm install
   ```

3. 用 Claude Code / Codex 之类的 AI agent 打开本工程。
4. **上传一张花朵图片**，输入以下 Prompt：

   > 分析图片中花的花瓣特征，排列规律，使用工程里的代码，构建一个全新的页面用于演示这朵花朵的绽放。代码结构和组件复用参考 `/demo` 页面

</details>

## Acknowledgments

This project was built entirely by following the approach and ideas of **Danny Laursen**.

📺 **[Danny Laursen — Flower Bloom Tutorial Series](https://www.youtube.com/watch?v=aUajIqvl6H4&list=PLOGJpcoBCf0MhmgDJKTY9SMJJDWrhYLIu)**

Huge thanks to Danny for the clear, generous teaching that made this build possible. If you find this repo useful, please go watch his videos and support his work — all the credit for the underlying concepts belongs to him.

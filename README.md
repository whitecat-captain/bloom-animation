# Bloom Animation Generator

Bloom Animation Generator is a web app for creating 3D flower-bloom animations. Start from a procedural flower, tune the visual and motion controls, then preview or export the result as a polished blooming clip.

👉 **Live Web App:** [bloom-animation-mu.vercel.app](https://bloom-animation-mu.vercel.app)

![Bloom Animation Generator demo](./public/bloom-animation-generator-demo.gif)

You can adjust:

- Flower presets and overall bloom style
- Petal colors, outlines, material, and render style
- Petal geometry, curl, width, length, and 3D form
- Petal arrangement, count, golden angle, radius, height, and tilt
- Wind, natural variation, jitter, and organic motion details
- Stem and leaf visibility, shape, color, and placement
- Animation timing, preview playback, background, camera framing, and export settings

## Local Development

```bash
git clone https://github.com/whitecat-captain/bloom-animation.git
cd bloom-animation
npm install
npm run dev
```

Open `http://localhost:3000` to view the app.

Useful checks before changing or shipping code:

```bash
npm run lint
npm run build
```

## Acknowledgments

This project was built entirely by following the approach and ideas of **Danny Laursen**.

📺 **[Danny Laursen — Flower Bloom Tutorial Series](https://www.youtube.com/watch?v=aUajIqvl6H4&list=PLOGJpcoBCf0MhmgDJKTY9SMJJDWrhYLIu)**

Huge thanks to Danny for the clear, generous teaching that made this build possible. If you find this repo useful, please go watch his videos and support his work — all the credit for the underlying concepts belongs to him.

import p5 from 'p5';
import type { KiteParams, KiteState } from './types';

export interface SceneConfig {
  container: HTMLElement;
  getState: () => KiteState;
  getParams: () => KiteParams;
  showVectors: () => boolean;
  enableParticles: () => boolean;
  locale: () => 'zh' | 'en';
}

export interface SceneHandle {
  showToast(message: string): void;
  destroy(): void;
}

type Particle = {
  x: number;
  y: number;
  speed: number;
  life: number;
};

const TOAST_LIFETIME = 2200;

const TEXT = {
  zh: {
    lift: '升力',
    gravity: '重力',
    tension: '拉力',
    stable: '稳稳当当！',
    unstable: '调整风势与角度，让风筝稳住～'
  },
  en: {
    lift: 'Lift',
    gravity: 'Gravity',
    tension: 'Tension',
    stable: 'Stable airflow!',
    unstable: 'Tune the wind & angle to stay steady!'
  }
};

export function createScene(config: SceneConfig): SceneHandle {
  let toastMessage = '';
  let toastTimer = 0;
  let canvas: p5.Renderer | null = null;
  const particles: Particle[] = Array.from({ length: 60 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    speed: 0.2 + Math.random() * 0.4,
    life: (i / 60) * 400
  }));

  const sketch = (p: p5) => {
    const tailPoints = Array.from({ length: 18 }, () => ({ x: 0, y: 0 }));

    const resize = () => {
      const { clientWidth, clientHeight } = config.container;
      p.resizeCanvas(clientWidth, clientHeight);
    };

    p.setup = () => {
      const { clientWidth, clientHeight } = config.container;
      canvas = p.createCanvas(clientWidth, clientHeight);
      canvas.parent(config.container);
      p.pixelDensity(Math.min(window.devicePixelRatio, 2));
    };

    p.windowResized = resize;

    p.draw = () => {
      const state = config.getState();
      const params = config.getParams();
      const lang = config.locale();
      const strings = TEXT[lang];
      const w = p.width;
      const h = p.height;

      p.background(p.color('rgba(250, 250, 247, 1)'));
      const gradientSteps = 8;
      for (let i = 0; i < gradientSteps; i++) {
        const alpha = p.map(i, 0, gradientSteps, 0, 60);
        p.noStroke();
        p.fill(11, 112, 180, alpha);
        p.rect(0, (h / gradientSteps) * i, w, h / gradientSteps);
      }

      const centerX = w * 0.45;
      const centerY = h * 0.45 + state.position.y * h * 0.08;
      const size = Math.min(w, h) * 0.28;

      const pitchRad = (state.pitch * Math.PI) / 180;
      p.push();
      p.translate(centerX, centerY);
      p.rotate(-pitchRad);
      p.noStroke();
      p.fill(255, 244, 199);
      p.triangle(-size * 0.6, 0, size * 0.2, -size * 0.5, size * 0.2, size * 0.5);
      p.fill(180, 66, 38);
      p.triangle(-size * 0.6, 0, -size * 0.1, -size * 0.35, -size * 0.1, size * 0.35);
      p.fill(254, 223, 99);
      p.triangle(size * 0.2, -size * 0.5, size * 0.2, size * 0.5, size * 0.55, 0);

      // 尾带
      const tailBase = { x: size * 0.55, y: 0 };
      p.stroke(255, 200, 120);
      p.strokeWeight(3);
      p.noFill();
      tailPoints.forEach((point, index) => {
        const t = index / tailPoints.length;
        const sway = Math.sin((state.timestamp + index * 0.1) * 2) * 12 * (1 - t);
        point.x = tailBase.x + t * size * 0.6 + sway;
        point.y = tailBase.y + Math.sin((state.velocity.y + index) * 1.5 + t * 4) * 10 * (1 - t);
      });
      p.beginShape();
      p.vertex(tailBase.x, tailBase.y);
      tailPoints.forEach((point) => {
        p.curveVertex(point.x, point.y);
      });
      p.endShape();
      p.pop();

      if (config.enableParticles()) {
        p.noStroke();
        particles.forEach((particle) => {
          particle.x += particle.speed * 0.01;
          if (particle.x > 1) particle.x = 0;
          particle.y += Math.sin((particle.life + state.timestamp) * 0.02) * 0.001;
          particle.life += 1;
          const px = particle.x * w;
          const py = centerY + (particle.y - 0.5) * h * 0.5;
          const alpha = 80 + Math.sin(particle.life * 0.05) * 40;
          p.fill(255, 255, 255, alpha);
          p.ellipse(px, py, 6, 2);
        });
      }

      if (config.showVectors()) {
        drawVector(p, centerX, centerY, 0, -state.lift * size * 0.12, '#38bdf8', `${strings.lift} ${state.lift.toFixed(2)}`);
        drawVector(p, centerX, centerY, 0, state.gravity * size * 0.12, '#f87171', `${strings.gravity} ${state.gravity.toFixed(2)}`);
        const tensionLength = params.tension * size * 0.15;
        drawVector(p, centerX, centerY, -tensionLength, tensionLength * 0.2, '#fbbf24', `${strings.tension} ${params.tension.toFixed(2)}`);
      }

      // 状态标签
      p.noStroke();
      p.fill(0, 0, 0, 120);
      p.rect(w - 190, 24, 166, 90, 12);
      p.fill(255);
      p.textSize(14);
      p.textAlign(p.LEFT, p.TOP);
      const textLines = [
        `V=${mapNumber(state.params.wind, 0, 5, 1, 9).toFixed(1)}m/s`,
        `Pitch=${state.pitch.toFixed(1)}°`,
        `Vy=${state.velocity.y.toFixed(2)}`
      ];
      textLines.forEach((line, index) => {
        p.text(line, w - 176, 32 + index * 24);
      });

      if (toastMessage) {
        p.textAlign(p.CENTER, p.CENTER);
        const alpha = Math.min(1, toastTimer / 200);
        p.fill(0, 0, 0, 200 * alpha);
        p.rect(w / 2 - 140, h - 80, 280, 42, 999);
        p.fill(255);
        p.textSize(16);
        p.text(toastMessage, w / 2, h - 58);
        toastTimer -= p.deltaTime;
        if (toastTimer <= 0) {
          toastMessage = '';
          toastTimer = 0;
        }
      }

      if (state.passed) {
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(20);
        p.fill(255, 255, 255, 220);
        p.text(strings.stable, w / 2, 40);
      }
    };
  };

  const instance = new p5(sketch, config.container);

  return {
    showToast(message: string) {
      toastMessage = message;
      toastTimer = TOAST_LIFETIME;
    },
    destroy() {
      toastMessage = '';
      toastTimer = 0;
      particles.length = 0;
      instance.remove();
      if (canvas) {
        canvas.remove();
        canvas = null;
      }
    }
  };
}

function drawVector(p: p5, x: number, y: number, dx: number, dy: number, color: string, label: string) {
  p.push();
  p.stroke(color);
  p.fill(color);
  p.strokeWeight(3);
  p.line(x, y, x + dx, y + dy);
  const angle = Math.atan2(dy, dx);
  p.push();
  p.translate(x + dx, y + dy);
  p.rotate(angle);
  p.triangle(0, 0, -12, 5, -12, -5);
  p.pop();
  p.noStroke();
  p.textSize(12);
  p.textAlign(p.LEFT, p.BOTTOM);
  p.text(label, x + dx + 6, y + dy + 4);
  p.pop();
}

function mapNumber(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}

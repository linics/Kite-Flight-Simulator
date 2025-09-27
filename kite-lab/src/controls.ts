import type { KiteParams } from './types';
import { clamp } from './utils';

export interface ControlsConfig {
  container: HTMLElement;
  params: KiteParams;
  locale: 'zh' | 'en';
  mode: 'learn' | 'quiz';
  twoParamMode: boolean;
  enableParticles: boolean;
  onParamsChange: (params: KiteParams) => void;
  onReset: () => void;
  onTeachToggle: (value: boolean) => void;
  onParticleToggle: (value: boolean) => void;
  onTwoParamToggle: (value: boolean) => void;
}

export interface ControlsHandle {
  setParams(params: Partial<KiteParams>): void;
  setLocale(locale: 'zh' | 'en'): void;
  setTwoParamMode(enabled: boolean): void;
  setParticlesEnabled(enabled: boolean): void;
  setTeachMode(enabled: boolean): void;
  destroy(): void;
}

const STRINGS = {
  zh: {
    title: '伯努利风筝实验室',
    wind: '风势',
    angle: '提线角',
    tension: '拉力',
    reset: '重置',
    teach: '教学开关',
    particles: '气流粒子',
    twoParam: '两参数模式'
  },
  en: {
    title: "Bernoulli's Kite Lab",
    wind: 'Wind',
    angle: 'Angle',
    tension: 'Tension',
    reset: 'Reset',
    teach: 'Instruction',
    particles: 'Particles',
    twoParam: 'Two-parameter mode'
  }
};

export function createControls(config: ControlsConfig): ControlsHandle {
  const state = { ...config.params };
  let teachMode = config.mode === 'learn';
  let particles = config.enableParticles;
  let currentLocale = config.locale;
  let twoParam = config.twoParamMode;

  const panel = document.createElement('div');
  panel.className = 'kite-panel';

  const title = document.createElement('h1');
  panel.appendChild(title);

  const slidersWrapper = document.createElement('div');
  slidersWrapper.style.display = 'flex';
  slidersWrapper.style.flexDirection = 'column';
  slidersWrapper.style.gap = '16px';
  panel.appendChild(slidersWrapper);

  const windSlider = createSlider('wind', 0, 5, 0.1, state.wind);
  const angleSlider = createSlider('angle', 5, 35, 0.5, state.angle);
  const tensionSlider = createSlider('tension', 0.8, 1.2, 0.01, state.tension);

  slidersWrapper.appendChild(windSlider.wrapper);
  slidersWrapper.appendChild(angleSlider.wrapper);
  slidersWrapper.appendChild(tensionSlider.wrapper);

  const toggles = document.createElement('div');
  toggles.style.display = 'flex';
  toggles.style.flexDirection = 'column';
  toggles.style.gap = '12px';
  panel.appendChild(toggles);

  const teachToggle = createToggle('teach', teachMode);
  const particleToggle = createToggle('particles', particles);
  const twoParamToggle = createToggle('twoParam', twoParam);

  toggles.appendChild(teachToggle.wrapper);
  toggles.appendChild(particleToggle.wrapper);
  toggles.appendChild(twoParamToggle.wrapper);

  const actions = document.createElement('div');
  actions.className = 'kite-actions';
  const resetBtn = document.createElement('button');
  resetBtn.className = 'kite-button';
  actions.appendChild(resetBtn);
  panel.appendChild(actions);

  config.container.appendChild(panel);

  const refreshSliderValues = () => {
    windSlider.value.textContent = state.wind.toFixed(1);
    angleSlider.value.textContent = `${state.angle.toFixed(1)}°`;
    tensionSlider.value.textContent = state.tension.toFixed(2);
  };

  const updateLocaleTexts = () => {
    const strings = STRINGS[currentLocale];
    title.textContent = strings.title;
    [windSlider, angleSlider, tensionSlider].forEach((slider) => {
      const key = slider.label.dataset.key as keyof typeof strings;
      slider.label.firstChild && (slider.label.firstChild.textContent = strings[key]);
    });
    teachToggle.label.textContent = strings.teach;
    particleToggle.label.textContent = strings.particles;
    twoParamToggle.label.textContent = strings.twoParam;
    resetBtn.textContent = strings.reset;
    refreshSliderValues();
  };

  function emitParams() {
    config.onParamsChange({ ...state });
  }

  windSlider.input.addEventListener('input', () => {
    state.wind = clamp(Number(windSlider.input.value), 0, 5);
    refreshSliderValues();
    emitParams();
  });

  angleSlider.input.addEventListener('input', () => {
    state.angle = clamp(Number(angleSlider.input.value), 5, 35);
    refreshSliderValues();
    emitParams();
  });

  tensionSlider.input.addEventListener('input', () => {
    state.tension = clamp(Number(tensionSlider.input.value), 0.8, 1.2);
    refreshSliderValues();
    emitParams();
  });

  teachToggle.input.addEventListener('change', () => {
    teachMode = teachToggle.input.checked;
    config.onTeachToggle(teachMode);
  });

  particleToggle.input.addEventListener('change', () => {
    particles = particleToggle.input.checked;
    config.onParticleToggle(particles);
  });

  twoParamToggle.input.addEventListener('change', () => {
    twoParam = twoParamToggle.input.checked;
    tensionSlider.wrapper.style.display = twoParam ? 'none' : '';
    if (twoParam) {
      state.tension = 1;
      tensionSlider.input.value = '1';
    }
    refreshSliderValues();
    emitParams();
    config.onTwoParamToggle(twoParam);
  });

  tensionSlider.wrapper.style.display = twoParam ? 'none' : '';
  updateLocaleTexts();

  resetBtn.addEventListener('click', () => {
    config.onReset();
  });

  return {
    setParams(partial) {
      if (partial.wind !== undefined) {
        state.wind = clamp(partial.wind, 0, 5);
        windSlider.input.value = state.wind.toString();
      }
      if (partial.angle !== undefined) {
        state.angle = clamp(partial.angle, 5, 35);
        angleSlider.input.value = state.angle.toString();
      }
      if (partial.tension !== undefined) {
        state.tension = clamp(partial.tension, 0.8, 1.2);
        tensionSlider.input.value = state.tension.toString();
      }
      refreshSliderValues();
    },
    setLocale(locale) {
      currentLocale = locale;
      updateLocaleTexts();
    },
    setTwoParamMode(enabled) {
      twoParam = enabled;
      twoParamToggle.input.checked = enabled;
      tensionSlider.wrapper.style.display = enabled ? 'none' : '';
      if (enabled) {
        state.tension = 1;
        tensionSlider.input.value = '1';
      }
      refreshSliderValues();
      emitParams();
      config.onTwoParamToggle(enabled);
    },
    setParticlesEnabled(enabled) {
      particles = enabled;
      particleToggle.input.checked = enabled;
      config.onParticleToggle(enabled);
    },
    setTeachMode(enabled) {
      teachMode = enabled;
      teachToggle.input.checked = enabled;
      config.onTeachToggle(enabled);
    },
    destroy() {
      config.container.removeChild(panel);
    }
  };
}

type SliderElements = {
  wrapper: HTMLDivElement;
  label: HTMLLabelElement;
  input: HTMLInputElement;
  value: HTMLSpanElement;
};

function createSlider(
  key: keyof KiteParams,
  min: number,
  max: number,
  step: number,
  value: number
): SliderElements {
  const wrapper = document.createElement('div');
  wrapper.className = 'kite-slider';
  const label = document.createElement('label');
  label.dataset.key = key;
  const textSpan = document.createElement('span');
  label.appendChild(textSpan);
  const valueSpan = document.createElement('span');
  label.appendChild(valueSpan);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return { wrapper, label, input, value: valueSpan };
}

type ToggleElements = {
  wrapper: HTMLDivElement;
  label: HTMLSpanElement;
  input: HTMLInputElement;
};

function createToggle(key: 'teach' | 'particles' | 'twoParam', checked: boolean): ToggleElements {
  const wrapper = document.createElement('div');
  wrapper.className = 'kite-toggle';
  const label = document.createElement('span');
  label.dataset.key = key;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return { wrapper, label, input };
}

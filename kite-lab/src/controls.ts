import type { KiteParams } from './types';
import { clamp } from './utils';

export type GuidanceTone = 'default' | 'info' | 'warning' | 'success';

export interface ControlsConfig {
  container: HTMLElement;
  params: KiteParams;
  locale: 'zh' | 'en';
  mode: 'learn' | 'quiz' | 'demo';
  twoParamMode: boolean;
  enableParticles: boolean;
  onParamsChange: (params: KiteParams) => void;
  onReset: () => void;
  onTeachToggle: (value: boolean) => void;
  onParticleToggle: (value: boolean) => void;
  onTwoParamToggle: (value: boolean) => void;
  onDemoToggle: (value: boolean) => void;
}

export interface ControlsHandle {
  setParams(params: Partial<KiteParams>): void;
  setLocale(locale: 'zh' | 'en'): void;
  setTwoParamMode(enabled: boolean): void;
  setParticlesEnabled(enabled: boolean): void;
  setTeachMode(enabled: boolean): void;
  setGuidance(message: string, tone?: GuidanceTone): void;
  setDemoActive(active: boolean): void;
  destroy(): void;
}

type LocaleStrings = {
  title: string;
  wind: string;
  angle: string;
  tension: string;
  reset: string;
  teach: string;
  particles: string;
  twoParam: string;
  demoStart: string;
  demoStop: string;
  demoRunning: string;
  guidanceTitle: string;
  guidanceDefault: string;
  tips: string[];
};

const STRINGS: Record<'zh' | 'en', LocaleStrings> = {
  zh: {
    title: '伯努利风筝实验室',
    wind: '风势',
    angle: '提线角',
    tension: '拉力',
    reset: '重置',
    teach: '教学开关',
    particles: '气流粒子',
    twoParam: '两参数模式',
    demoStart: '开启演示',
    demoStop: '停止演示',
    demoRunning: '演示进行中',
    guidanceTitle: '操作提示',
    guidanceDefault: '先加风，再抬角，再微调拉力，让升力略大于重力；也可以点击“开启演示”查看示范。',
    tips: [
      '① 风势调到 1.3 – 1.6 区间。',
      '② 角度保持在 12° – 14°。',
      '③ 拉力调到 0.90 – 0.96。'
    ]
  },
  en: {
    title: "Bernoulli's Kite Lab",
    wind: 'Wind',
    angle: 'Angle',
    tension: 'Tension',
    reset: 'Reset',
    teach: 'Instruction',
    particles: 'Particles',
    twoParam: 'Two-parameter mode',
    demoStart: 'Start Demo',
    demoStop: 'Stop Demo',
    demoRunning: 'Demo running...',
    guidanceTitle: 'Flight Tips',
    guidanceDefault: 'Raise wind, lift the angle, then trim tension until lift slightly outweighs gravity—click “Start Demo” to watch the walkthrough.',
    tips: [
      '1) Bring wind to about 1.3 – 1.6.',
      '2) Hold the line angle near 12° to 14°.',
      '3) Trim tension between 0.90 and 0.96.'
    ]
  }
};
const GUIDANCE_TONE_CLASS: Record<GuidanceTone, string> = {
  default: 'kite-guidance__message--default',
  info: 'kite-guidance__message--info',
  warning: 'kite-guidance__message--warning',
  success: 'kite-guidance__message--success'
};

export function createControls(config: ControlsConfig): ControlsHandle {
  const state = { ...config.params };
  let teachMode = config.mode !== 'quiz';
  let particles = config.enableParticles;
  let currentLocale = config.locale;
  let twoParam = config.twoParamMode;
  let demoActive = false;
  let hasCustomGuidance = false;
  let currentGuidanceTone: GuidanceTone = 'info';
  let currentGuidanceMessage = '';

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

  const guidanceSection = document.createElement('section');
  guidanceSection.className = 'kite-guidance';
  const guidanceTitle = document.createElement('h2');
  guidanceTitle.className = 'kite-guidance__title';
  guidanceSection.appendChild(guidanceTitle);
  const guidanceMessage = document.createElement('p');
  guidanceMessage.className = 'kite-guidance__message';
  guidanceSection.appendChild(guidanceMessage);
  const guidanceList = document.createElement('ul');
  guidanceList.className = 'kite-guidance__steps';
  guidanceSection.appendChild(guidanceList);
  panel.appendChild(guidanceSection);

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
  const demoBtn = document.createElement('button');
  demoBtn.className = 'kite-button kite-button--ghost';
  actions.appendChild(demoBtn);
  const resetBtn = document.createElement('button');
  resetBtn.className = 'kite-button';
  actions.appendChild(resetBtn);
  panel.appendChild(actions);

  config.container.appendChild(panel);

  const sliderInputs = [windSlider.input, angleSlider.input, tensionSlider.input];
  const toggleInputs = [teachToggle.input, particleToggle.input, twoParamToggle.input];

  const refreshSliderValues = () => {
    windSlider.value.textContent = state.wind.toFixed(1);
    angleSlider.value.textContent = `${state.angle.toFixed(1)}°`;
    tensionSlider.value.textContent = state.tension.toFixed(2);
  };

  const setGuidanceTone = (tone: GuidanceTone) => {
    guidanceMessage.classList.remove(...Object.values(GUIDANCE_TONE_CLASS));
    const className = GUIDANCE_TONE_CLASS[tone] ?? GUIDANCE_TONE_CLASS.info;
    if (className) {
      guidanceMessage.classList.add(className);
    }
  };

  const setGuidanceInternal = (message: string, tone: GuidanceTone, markCustom: boolean) => {
    currentGuidanceMessage = message;
    currentGuidanceTone = tone;
    hasCustomGuidance = markCustom;
    guidanceMessage.textContent = message;
    setGuidanceTone(tone);
  };

  const refreshGuidanceList = (strings: LocaleStrings) => {
    guidanceList.innerHTML = '';
    strings.tips.forEach((tip) => {
      const item = document.createElement('li');
      item.textContent = tip;
      guidanceList.appendChild(item);
    });
  };

  const refreshDemoButton = () => {
    const strings = STRINGS[currentLocale];
    demoBtn.textContent = demoActive ? strings.demoStop : strings.demoStart;
    demoBtn.title = demoActive ? strings.demoRunning : strings.demoStart;
    demoBtn.setAttribute('aria-pressed', demoActive ? 'true' : 'false');
    demoBtn.classList.toggle('kite-button--active', demoActive);
    demoBtn.dataset.state = demoActive ? 'running' : 'idle';
  };

  const setControlsDisabled = (disabled: boolean) => {
    sliderInputs.forEach((input) => {
      input.disabled = disabled;
    });
    toggleInputs.forEach((input) => {
      input.disabled = disabled;
    });
    resetBtn.disabled = disabled;
  };

  const updateSliderLabels = (strings: LocaleStrings) => {
    const sliderPairs: Array<[typeof windSlider, 'wind' | 'angle' | 'tension']> = [
      [windSlider, 'wind'],
      [angleSlider, 'angle'],
      [tensionSlider, 'tension']
    ];
    sliderPairs.forEach(([slider, key]) => {
      const node = slider.label.firstChild as HTMLElement | null;
      if (node) {
        node.textContent = strings[key];
      }
    });
  };

  const updateLocaleTexts = () => {
    const strings = STRINGS[currentLocale];
    title.textContent = strings.title;
    updateSliderLabels(strings);
    teachToggle.label.textContent = strings.teach;
    particleToggle.label.textContent = strings.particles;
    twoParamToggle.label.textContent = strings.twoParam;
    resetBtn.textContent = strings.reset;
    guidanceTitle.textContent = strings.guidanceTitle;
    refreshGuidanceList(strings);
    if (!hasCustomGuidance) {
      setGuidanceInternal(strings.guidanceDefault, 'info', false);
    } else {
      guidanceMessage.textContent = currentGuidanceMessage;
      setGuidanceTone(currentGuidanceTone);
    }
    refreshDemoButton();
    refreshSliderValues();
  };

  const emitParams = () => {
    config.onParamsChange({ ...state });
  };

  refreshSliderValues();
  updateLocaleTexts();

  windSlider.input.addEventListener('input', () => {
    if (demoActive) return;
    state.wind = clamp(Number(windSlider.input.value), 0, 5);
    refreshSliderValues();
    emitParams();
  });

  angleSlider.input.addEventListener('input', () => {
    if (demoActive) return;
    state.angle = clamp(Number(angleSlider.input.value), 5, 35);
    refreshSliderValues();
    emitParams();
  });

  tensionSlider.input.addEventListener('input', () => {
    if (demoActive) return;
    state.tension = clamp(Number(tensionSlider.input.value), 0.8, 1.2);
    refreshSliderValues();
    emitParams();
  });

  teachToggle.input.addEventListener('change', () => {
    if (demoActive) {
      teachToggle.input.checked = teachMode;
      return;
    }
    teachMode = teachToggle.input.checked;
    config.onTeachToggle(teachMode);
  });

  particleToggle.input.addEventListener('change', () => {
    if (demoActive) {
      particleToggle.input.checked = particles;
      return;
    }
    particles = particleToggle.input.checked;
    config.onParticleToggle(particles);
  });

  twoParamToggle.input.addEventListener('change', () => {
    if (demoActive) {
      twoParamToggle.input.checked = twoParam;
      return;
    }
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

  demoBtn.addEventListener('click', () => {
    config.onDemoToggle(!demoActive);
  });

  resetBtn.addEventListener('click', () => {
    if (demoActive) return;
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
    setGuidance(message, tone = 'info') {
      setGuidanceInternal(message, tone, true);
    },
    setDemoActive(active) {
      if (demoActive === active) return;
      demoActive = active;
      setControlsDisabled(active);
      panel.classList.toggle('kite-panel--demo', active);
      refreshDemoButton();
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

import { useEffect, useState } from 'react';
import '../landing.css';

const NAV = [
  { id: 'features', label: '功能' },
  { id: 'how', label: '原理' },
  { id: 'commands', label: '口令' },
  { id: 'start', label: '开始' },
];

const FEATURES = [
  {
    tag: '01',
    title: '纯语音操控',
    desc: '首次授权麦克风后，开始聆听、绘图、撤销、保存——全程无需鼠标键盘。',
  },
  {
    tag: '02',
    title: '几何 + AI 双引擎',
    desc: '圆、方、组合图形走本地规则；熊猫、芒果、汽车等开放物体走 HF 文生图。',
  },
  {
    tag: '03',
    title: '持续语音对话',
    desc: '持续聆听免唤醒，实时字幕显示识别结果，对话式连续创作。',
  },
];

const STEPS = [
  { n: '1', title: '说出指令', desc: 'Whisper 或 Web Speech 将中文转为文本' },
  { n: '2', title: '规则解析', desc: 'RuleParser 映射为 DrawCommand 或 imagine prompt' },
  { n: '3', title: '画布呈现', desc: 'CommandExecutor 渲染几何图元或 AI 图片到 Canvas' },
];

const COMMANDS = [
  '画一个红色的圆',
  '画三只蓝色方块排成一行',
  '画一只熊猫',
  '把它变成绿色',
  '撤销',
  '保存图片',
];

function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const [slide, setSlide] = useState(0);

  useReveal();

  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const sections = ['hero', 'features', 'how', 'commands', 'start'];
      const y = window.scrollY + window.innerHeight * 0.35;
      let idx = 0;
      sections.forEach((id, i) => {
        const node = document.getElementById(id);
        if (node && node.offsetTop <= y) idx = i;
      });
      setSlide(idx);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`landing ${loaded ? 'landing--ready' : ''}`}>
      <header className="landing__top">
        <a className="landing__logo font-firs" href="/">sonicraft</a>

        <nav className="landing__nav" aria-label="页面导航">
          {NAV.map((item) => (
            <button key={item.id} type="button" onClick={() => scrollTo(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        <a className="landing__cta-top" href="/app">
          进入工作室
          <span aria-hidden>↗</span>
        </a>
      </header>

      <section id="hero" className="landing__hero">
        <div className="landing__ribbons" aria-hidden>
          <div className="landing__ribbon landing__ribbon--a" />
          <div className="landing__ribbon landing__ribbon--b" />
          <div className="landing__ribbon landing__ribbon--d" />
          <div className="landing__ribbon landing__ribbon--c" />
          <div className="landing__grain" />
        </div>

        <div className="landing__hero-inner">
          <p className="landing__eyebrow">VOICE-FIRST CANVAS</p>
          <h1 className="landing__title font-firs">
            sonicraft
          </h1>
          <p className="landing__tagline">
            用声音勾勒想象，让指令在画布上成形——几何绘图与 AI 文生图，一开口即创作。
          </p>
          <div className="landing__hero-actions">
            <a className="landing__btn landing__btn--primary" href="/app">
              开始创作
              <span aria-hidden>→</span>
            </a>
            <button type="button" className="landing__btn landing__btn--ghost" onClick={() => scrollTo('features')}>
              了解更多
            </button>
          </div>
        </div>

        <button type="button" className="landing__scroll-hint" onClick={() => scrollTo('features')}>
          向下探索
        </button>

        <div className="landing__slide-indicator" aria-hidden>
          <span>{String(slide + 1).padStart(2, '0')}</span>
          <span className="landing__slide-line" />
          <span>05</span>
        </div>
      </section>

      <section id="features" className="landing__section">
        <div className="landing__section-head" data-reveal>
          <p className="landing__section-label">CAPABILITIES</p>
          <h2 className="landing__section-title font-firs">开口即绘，所想即现</h2>
        </div>
        <div className="landing__cards">
          {FEATURES.map((f) => (
            <article key={f.tag} className="landing__card" data-reveal>
              <span className="landing__card-tag">{f.tag}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="landing__section landing__section--dark">
        <div className="landing__section-head" data-reveal>
          <p className="landing__section-label">PIPELINE</p>
          <h2 className="landing__section-title font-firs">从语音到像素</h2>
        </div>
        <ol className="landing__steps">
          {STEPS.map((s) => (
            <li key={s.n} className="landing__step" data-reveal>
              <span className="landing__step-n">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="commands" className="landing__section">
        <div className="landing__section-head" data-reveal>
          <p className="landing__section-label">VOICE COMMANDS</p>
          <h2 className="landing__section-title font-firs">试试这些口令</h2>
        </div>
        <ul className="landing__commands" data-reveal>
          {COMMANDS.map((cmd) => (
            <li key={cmd}>
              <span className="landing__mic" aria-hidden>🎙</span>
              「{cmd}」
            </li>
          ))}
        </ul>
      </section>

      <section id="start" className="landing__cta-section" data-reveal>
        <div className="landing__cta-glow" aria-hidden />
        <h2 className="font-firs">准备好用声音作画了吗？</h2>
        <p>打开工作室，授权麦克风，说出你的第一个指令。</p>
        <a className="landing__btn landing__btn--primary landing__btn--large" href="/app">
          进入 Sonicraft 工作室
          <span aria-hidden>↗</span>
        </a>
      </section>

      <footer className="landing__footer">
        <span className="font-firs">sonicraft</span>
        <span>纯语音 Canvas 绘图 · 开源项目</span>
      </footer>
    </div>
  );
}

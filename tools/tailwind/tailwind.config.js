// Regenerate (Tailwind 3.4.17, run from the repo root, not needed at runtime):
// npx tailwindcss@3.4.17 -c tools/tailwind/tailwind.config.js -i tools/tailwind/input.css -o assets/css/tailwind.css --minify
const v = n => `var(--${n})`;
module.exports = {
  prefix: 'tw-',
  corePlugins: { preflight: false },
  content: ['./*.html', './sandbox/*.html', './assets/js/!(*.min).js'],
  theme: {
    extend: {
      colors: { paper: v('paper'), panel: v('panel'), ink: v('ink'), muted: v('muted'), faint: v('faint'), line: v('line'), 'line-soft': v('line-soft'), accent: v('lime'), link: v('link'), orange: v('orange'), blue: v('blue') },
      fontFamily: { sans: [v('font-sans')], mono: [v('font-mono')] },
      borderRadius: { DEFAULT: v('radius') },
      maxWidth: { page: v('page-max') }
    }
  },
  safelist: [
    { pattern: /^tw-(block|inline-block|inline-flex|flex|grid|hidden|flex-col|flex-wrap|flex-1|items-(start|center|end)|justify-(start|center|between|end)|w-full|truncate|text-(xs|sm|base|lg|xl|2xl)|font-(normal|medium|semibold|bold)|rounded|border|text-(ink|muted|faint|link|accent|orange)|bg-(paper|panel)|border-line)$/ },
    { pattern: /^tw-(gap|p|px|py|m|mx|my|mt|mb)-(0|1|2|3|4|6|8)$/ },
    { pattern: /^tw-grid-cols-(1|2|3|4)$/, variants: ['sm', 'md', 'lg'] },
    { pattern: /^tw-(flex-row|flex-col|hidden|block|flex)$/, variants: ['sm', 'md', 'lg'] }
  ]
};

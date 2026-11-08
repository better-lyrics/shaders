import type { GradientSettings } from "@/shared/constants/gradientSettings";

const PAGE_CHROME_STYLE_ID = "bls-page-chrome-style";
const PLAYER_PAGE = '#layout[player-ui-state="PLAYER_PAGE_OPEN"]';
const BROWSE_PAGE = '#layout:not([player-ui-state="PLAYER_PAGE_OPEN"], [player-ui-state="FULLSCREEN"])';
const GLASS_BLUR = "25px";

// :where() and YTM's own background tokens keep every theme rule, of any specificity, in charge.
const PLAYER_PAGE_CSS = `
  :where(${PLAYER_PAGE} :is(#nav-bar-background, #mini-guide-background)) {
    opacity: 0 !important;
  }
  :where(${PLAYER_PAGE} #guide-wrapper) {
    --ytmusic-background: transparent;
    border-color: transparent !important;
  }
  :where(${PLAYER_PAGE} :is(ytmusic-player-bar, #player-bar-background)) {
    --ytmusic-player-bar-background: transparent;
  }
`;

// Glass navigation, sidebar and header dissolve adapted from the Lucid theme for Better Lyrics.
const BROWSE_PAGE_CSS = `
  :where(${BROWSE_PAGE} #nav-bar-background) {
    --ytmusic-nav-bar: transparent;
    z-index: 4 !important;
    height: calc(var(--ytmusic-nav-bar-height) + 26px) !important;
    pointer-events: none;
    backdrop-filter: blur(${GLASS_BLUR});
    -webkit-mask-image: linear-gradient(to bottom, black calc(var(--ytmusic-nav-bar-height) - 10px), transparent 100%);
    mask-image: linear-gradient(to bottom, black calc(var(--ytmusic-nav-bar-height) - 10px), transparent 100%);
  }
  :where(${BROWSE_PAGE} #nav-bar-divider) {
    display: none !important;
  }
  :where(${BROWSE_PAGE} #mini-guide-background) {
    --ytmusic-nav-bar: transparent;
  }
  :where(${BROWSE_PAGE} #guide-wrapper) {
    --ytmusic-background: transparent;
    backdrop-filter: blur(${GLASS_BLUR});
  }
  :where(${BROWSE_PAGE} :is(tp-yt-app-drawer, tp-yt-app-drawer #contentContainer, ytmusic-guide-renderer, #guide-content, #mini-guide, #mini-guide-spacer)) {
    background: transparent !important;
  }
  :where(${BROWSE_PAGE} ytmusic-player-bar) {
    --ytmusic-player-bar-background: transparent;
  }
  :where(${BROWSE_PAGE} #player-bar-background) {
    --ytmusic-player-bar-background: rgba(20, 20, 20, 0.2);
    backdrop-filter: blur(${GLASS_BLUR});
  }
  :where(ytmusic-data-bound-header-renderer, ytmusic-editable-profile-header-renderer, ytmusic-visual-header-renderer) {
    background: transparent !important;
  }
  :where(.ytmusic-browse-response .content-container-wrapper, .content-container-wrapper .gradient-container, ytmusic-visual-header-renderer[has-banner-image] .gradient-container.ytmusic-visual-header-renderer) {
    background: transparent !important;
  }
  :where(.image.ytmusic-immersive-header-renderer, .image.ytmusic-visual-header-renderer, :is(ytmusic-data-bound-header-renderer, ytmusic-editable-profile-header-renderer) :is(#background, .background, yt-img-shadow)) {
    -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%) !important;
    mask-image: linear-gradient(to bottom, black 60%, transparent 100%) !important;
    -webkit-mask-repeat: no-repeat !important;
    mask-repeat: no-repeat !important;
    -webkit-mask-size: 100% !important;
    mask-size: 100% !important;
    opacity: 0.8 !important;
    filter: brightness(0.95);
  }
  :where(.image.ytmusic-immersive-header-renderer) {
    margin-left: var(--ytmusic-guide-width) !important;
  }
  @container style(--ytmusic-guide-width: 72px) {
    :where(.image.ytmusic-immersive-header-renderer) {
      margin-left: 0 !important;
    }
  }
`;

// Plain html, not :root, so YTM's html tokens lose to this rule and a theme's :root tokens beat it.
const rootTokensCss = (settings: GradientSettings): string => `
  html {
    --ytmusic-text-secondary: rgba(255, 255, 255, 0.88);
    --ytmusic-overlay-text-secondary: rgba(255, 255, 255, 0.88);
    --ytmusic-icon-inactive: rgba(255, 255, 255, 0.6);
    ${settings.showOnBrowsePages ? "--ytmusic-detail-header: transparent;" : ""}
  }
  :where(.index.ytmusic-responsive-list-item-renderer) {
    color: var(--ytmusic-text-secondary) !important;
  }
`;

const pageChromeCss = (settings: GradientSettings): string =>
  rootTokensCss(settings) + PLAYER_PAGE_CSS + (settings.showOnBrowsePages ? BROWSE_PAGE_CSS : "");

export const syncPageChrome = (settings: GradientSettings): void => {
  const existing = document.getElementById(PAGE_CHROME_STYLE_ID);
  if (!settings.enabled) {
    existing?.remove();
    return;
  }
  const css = pageChromeCss(settings);
  if (existing?.textContent === css) return;
  const style = existing ?? document.createElement("style");
  style.id = PAGE_CHROME_STYLE_ID;
  style.textContent = css;
  if (!existing) document.head.appendChild(style);
};

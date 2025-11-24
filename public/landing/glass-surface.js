/**
 * GlassSurface - Vanilla JavaScript implementation
 * Adapted from React Bits - https://reactbits.dev/components/glass-surface
 *
 * Creates a glass morphism effect with chromatic aberration using SVG filters
 */

class GlassSurface {
  constructor(element, options = {}) {
    this.element = element;

    // Default options matching React component
    this.options = {
      width: options.width || 200,
      height: options.height || 80,
      borderRadius: options.borderRadius || 20,
      borderWidth: options.borderWidth || 0.07,
      brightness: options.brightness || 50,
      opacity: options.opacity || 0.93,
      blur: options.blur || 11,
      displace: options.displace || 0,
      backgroundOpacity: options.backgroundOpacity || 0,
      saturation: options.saturation || 1,
      distortionScale: options.distortionScale || -180,
      redOffset: options.redOffset || 0,
      greenOffset: options.greenOffset || 10,
      blueOffset: options.blueOffset || 20,
      xChannel: options.xChannel || 'R',
      yChannel: options.yChannel || 'G',
      mixBlendMode: options.mixBlendMode || 'difference'
    };

    // Generate unique IDs for SVG elements
    this.uniqueId = this.generateUniqueId();
    this.filterId = `glass-filter-${this.uniqueId}`;
    this.redGradId = `red-grad-${this.uniqueId}`;
    this.blueGradId = `blue-grad-${this.uniqueId}`;

    this.init();
  }

  generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  init() {
    // Add glass-surface class
    this.element.classList.add('glass-surface');

    // Check SVG filter support
    const supportsSVG = this.supportsSVGFilters();
    this.element.classList.add(supportsSVG ? 'glass-surface--svg' : 'glass-surface--fallback');

    // Apply container styles
    this.applyContainerStyles();

    if (supportsSVG) {
      // Create SVG filter
      this.createSVGFilter();

      // Setup resize observer
      this.setupResizeObserver();

      // Initial displacement map update
      setTimeout(() => this.updateDisplacementMap(), 0);
    }

    // Wrap existing content
    this.wrapContent();
  }

  supportsSVGFilters() {
    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);

    if (isWebkit || isFirefox) {
      return false;
    }

    const div = document.createElement('div');
    div.style.backdropFilter = `url(#${this.filterId})`;
    return div.style.backdropFilter !== '';
  }

  applyContainerStyles() {
    const { width, height, borderRadius, backgroundOpacity, saturation } = this.options;

    this.element.style.width = typeof width === 'number' ? `${width}px` : width;
    this.element.style.height = typeof height === 'number' ? `${height}px` : height;
    this.element.style.borderRadius = `${borderRadius}px`;
    this.element.style.setProperty('--glass-frost', backgroundOpacity);
    this.element.style.setProperty('--glass-saturation', saturation);
    this.element.style.setProperty('--filter-id', `url(#${this.filterId})`);
  }

  wrapContent() {
    const content = document.createElement('div');
    content.className = 'glass-surface__content';

    // Move all children to content wrapper
    while (this.element.firstChild) {
      content.appendChild(this.element.firstChild);
    }

    this.element.appendChild(content);
    this.contentElement = content;
  }

  createSVGFilter() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'glass-surface__filter');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');

    filter.setAttribute('id', this.filterId);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');

    // Create filter elements
    filter.innerHTML = `
      <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />

      <feDisplacementMap in="SourceGraphic" in2="map" id="redchannel" result="dispRed" />
      <feColorMatrix in="dispRed" type="matrix"
        values="1 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1 0" result="red" />

      <feDisplacementMap in="SourceGraphic" in2="map" id="greenchannel" result="dispGreen" />
      <feColorMatrix in="dispGreen" type="matrix"
        values="0 0 0 0 0
                0 1 0 0 0
                0 0 0 0 0
                0 0 0 1 0" result="green" />

      <feDisplacementMap in="SourceGraphic" in2="map" id="bluechannel" result="dispBlue" />
      <feColorMatrix in="dispBlue" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 1 0 0
                0 0 0 1 0" result="blue" />

      <feBlend in="red" in2="green" mode="screen" result="rg" />
      <feBlend in="rg" in2="blue" mode="screen" result="output" />
      <feGaussianBlur in="output" stdDeviation="0.7" />
    `;

    defs.appendChild(filter);
    svg.appendChild(defs);

    // Insert SVG before content
    this.element.insertBefore(svg, this.contentElement);

    // Store references to SVG elements
    this.svgElement = svg;
    this.feImageElement = filter.querySelector('feImage');
    this.redChannelElement = filter.querySelector('#redchannel');
    this.greenChannelElement = filter.querySelector('#greenchannel');
    this.blueChannelElement = filter.querySelector('#bluechannel');
    this.gaussianBlurElement = filter.querySelector('feGaussianBlur');

    this.updateFilterAttributes();
  }

  updateFilterAttributes() {
    const { distortionScale, redOffset, greenOffset, blueOffset, xChannel, yChannel, displace } = this.options;

    if (this.redChannelElement) {
      this.redChannelElement.setAttribute('scale', (distortionScale + redOffset).toString());
      this.redChannelElement.setAttribute('xChannelSelector', xChannel);
      this.redChannelElement.setAttribute('yChannelSelector', yChannel);
    }

    if (this.greenChannelElement) {
      this.greenChannelElement.setAttribute('scale', (distortionScale + greenOffset).toString());
      this.greenChannelElement.setAttribute('xChannelSelector', xChannel);
      this.greenChannelElement.setAttribute('yChannelSelector', yChannel);
    }

    if (this.blueChannelElement) {
      this.blueChannelElement.setAttribute('scale', (distortionScale + blueOffset).toString());
      this.blueChannelElement.setAttribute('xChannelSelector', xChannel);
      this.blueChannelElement.setAttribute('yChannelSelector', yChannel);
    }

    if (this.gaussianBlurElement) {
      this.gaussianBlurElement.setAttribute('stdDeviation', displace.toString());
    }
  }

  generateDisplacementMap() {
    const rect = this.element.getBoundingClientRect();
    const actualWidth = rect.width || 400;
    const actualHeight = rect.height || 200;
    const { borderRadius, borderWidth, brightness, opacity, blur, mixBlendMode } = this.options;
    const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

    const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${this.redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${this.blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${this.redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${this.blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  }

  updateDisplacementMap() {
    if (this.feImageElement) {
      this.feImageElement.setAttribute('href', this.generateDisplacementMap());
    }
  }

  setupResizeObserver() {
    if (!window.ResizeObserver) return;

    this.resizeObserver = new ResizeObserver(() => {
      setTimeout(() => this.updateDisplacementMap(), 0);
    });

    this.resizeObserver.observe(this.element);
  }

  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.applyContainerStyles();
    this.updateFilterAttributes();
    this.updateDisplacementMap();
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.element.classList.remove('glass-surface', 'glass-surface--svg', 'glass-surface--fallback');
    if (this.svgElement) {
      this.svgElement.remove();
    }
  }
}

// Auto-initialize elements with data-glass-surface attribute
function initGlassSurfaces(selector = '[data-glass-surface]') {
  const elements = document.querySelectorAll(selector);
  const instances = [];

  elements.forEach(element => {
    const options = {};
    const dataset = element.dataset;

    // Read options from data attributes
    if (dataset.glassWidth) options.width = dataset.glassWidth;
    if (dataset.glassHeight) options.height = dataset.glassHeight;
    if (dataset.glassBorderRadius) options.borderRadius = parseFloat(dataset.glassBorderRadius);
    if (dataset.glassBorderWidth) options.borderWidth = parseFloat(dataset.glassBorderWidth);
    if (dataset.glassBrightness) options.brightness = parseFloat(dataset.glassBrightness);
    if (dataset.glassOpacity) options.opacity = parseFloat(dataset.glassOpacity);
    if (dataset.glassBlur) options.blur = parseFloat(dataset.glassBlur);
    if (dataset.glassDisplace) options.displace = parseFloat(dataset.glassDisplace);
    if (dataset.glassSaturation) options.saturation = parseFloat(dataset.glassSaturation);
    if (dataset.glassDistortionScale) options.distortionScale = parseFloat(dataset.glassDistortionScale);
    if (dataset.glassRedOffset) options.redOffset = parseFloat(dataset.glassRedOffset);
    if (dataset.glassGreenOffset) options.greenOffset = parseFloat(dataset.glassGreenOffset);
    if (dataset.glassBlueOffset) options.blueOffset = parseFloat(dataset.glassBlueOffset);

    const instance = new GlassSurface(element, options);
    instances.push(instance);
  });

  return instances;
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initGlassSurfaces());
} else {
  initGlassSurfaces();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GlassSurface, initGlassSurfaces };
}

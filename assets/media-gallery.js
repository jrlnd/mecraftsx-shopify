import { Component } from '@theme/component';
import { SlideshowSelectEvent, ThemeEvents, ZoomMediaSelectedEvent } from '@theme/events';
import { StandardEvents, ProductSelectEvent } from '@shopify/events';

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const target = this.closest('.shopify-section, dialog');

    target?.addEventListener(StandardEvents.productSelect, this.#handleProductSelect, { signal });
    this.refs.zoomDialogComponent?.addEventListener(ThemeEvents.zoomMediaSelected, this.#handleZoomMediaSelected, {
      signal,
    });

    if (this.hasAttribute('data-adaptive-height')) {
      this.addEventListener(SlideshowSelectEvent.eventName, this.#updateAdaptiveHeight, { signal });
      this.#resizeObserver = new ResizeObserver(() => this.#updateAdaptiveHeight());
      for (const slide of this.slideshow?.slides ?? []) this.#resizeObserver.observe(slide);
      this.#updateAdaptiveHeight();
    }
  }

  #controller = new AbortController();

  /** @type {ResizeObserver | undefined} */
  #resizeObserver;

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
    this.#resizeObserver?.disconnect();
  }

  /**
   * Sizes the slideshow track to the selected slide when adaptive height is on.
   * Ignores selections bubbling up from nested slideshows such as the zoom dialog.
   *
   * @param {SlideshowSelectEvent} [event]
   */
  #updateAdaptiveHeight = (event) => {
    const { slideshow } = this;
    if (!slideshow || (event && event.target !== slideshow)) return;

    const slide = event?.detail.slide ?? slideshow.slides?.[slideshow.current];
    const track = slide?.parentElement;
    if (!(slide instanceof HTMLElement) || !track) return;

    track.style.setProperty('--adaptive-slide-height', `${slide.offsetHeight}px`);
  };

  /**
   * Handles a product select event by replacing the current media gallery with a new one.
   *
   * @param {ProductSelectEvent} event - The product select event.
   */
  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html } = detail;
        const newMediaGallery = html.querySelector('media-gallery');
        if (!newMediaGallery) return;

        this.replaceWith(newMediaGallery);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[media-gallery] Event promise rejected:', error);
      });
  };

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    this.slideshow?.select(event.detail.index, undefined, { animate: false });
  };

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  /**
   * Preloads an image.
   * @param {number} index - The index of the media to preload.
   */
  preloadImage(index) {
    const zoomDialogMedia = this.refs.zoomDialogComponent?.refs.media[index];
    if (!zoomDialogMedia) return;

    this.refs.zoomDialogComponent?.loadHighResolutionImage(zoomDialogMedia);
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }
}

if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', MediaGallery);
}

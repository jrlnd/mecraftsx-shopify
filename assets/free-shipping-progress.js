import { Component } from '@theme/component';
import { StandardEvents } from '@shopify/events';
import { convertMoneyToMinorUnits, formatMoney } from '@theme/money-formatting';

/**
 * Shows how far the cart is from the free shipping threshold and keeps the bar in sync with cart changes.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} message - The text describing the remaining amount or success state.
 * @property {HTMLElement} fill - The bar fill, scaled with the --free-shipping-progress custom property.
 *
 * @extends {Component<Refs>}
 */
class FreeShippingProgress extends Component {
  requiredRefs = ['message', 'fill'];

  /** @type {AbortController | null} */
  #fetchController = null;

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
    document.addEventListener(StandardEvents.cartDiscountUpdate, this.#handleCartUpdate);
    window.addEventListener('pageshow', this.#handlePageShow);

    // Converts the threshold when the visitor shops in another currency, then reveals the bar.
    this.#render(Number(this.dataset.cartTotal ?? 0), this.dataset.cartCurrency);
    this.hidden = false;
    this.refs.message.setAttribute('aria-live', 'polite');
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate);
    document.removeEventListener(StandardEvents.cartDiscountUpdate, this.#handleCartUpdate);
    window.removeEventListener('pageshow', this.#handlePageShow);
    this.#fetchController?.abort();
  }

  /**
   * Updates the bar from a cart lines or discount update event.
   * @param {Event & { promise?: Promise<any> }} event
   */
  #handleCartUpdate = async (event) => {
    if (!event.promise) return;

    try {
      const result = await event.promise;
      const total = result?.cart?.cost?.totalAmount;
      if (!total) return;

      const cents = convertMoneyToMinorUnits(String(total.amount), total.currencyCode);
      if (cents === null) return;

      this.#render(cents, total.currencyCode);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('[free-shipping-progress] Cart update failed:', error);
    }
  };

  /**
   * Refreshes from the cart when the page is restored from the back/forward cache.
   * @param {PageTransitionEvent} event
   */
  #handlePageShow = async (event) => {
    if (!event.persisted) return;

    this.#fetchController?.abort();
    this.#fetchController = new AbortController();

    try {
      const response = await fetch(`${Theme.routes.cart_url}.js`, { signal: this.#fetchController.signal });
      if (!response.ok) return;

      const cart = await response.json();
      this.#render(Number(cart.total_price ?? 0), cart.currency);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('[free-shipping-progress] Cart refresh failed:', error);
    }
  };

  /**
   * The threshold in the cart's currency, in minor units.
   * @param {string | undefined} currency
   * @returns {number}
   */
  #thresholdFor(currency) {
    const threshold = Number(this.dataset.thresholdCents ?? 0);
    const shopCurrency = this.dataset.shopCurrency;
    const rate = Number(window.Shopify?.currency?.rate ?? 1);

    if (!currency || currency === shopCurrency || !Number.isFinite(rate) || rate <= 0) return threshold;
    return Math.round(threshold * rate);
  }

  /**
   * Renders the message and bar for a cart total.
   * @param {number} totalCents - The cart total in minor units of `currency`.
   * @param {string | undefined} currency - The cart's currency code.
   */
  #render(totalCents, currency) {
    const threshold = this.#thresholdFor(currency);
    if (threshold <= 0) return;

    const remaining = Math.max(threshold - totalCents, 0);
    const progress = Math.min(Math.max(totalCents / threshold, 0), 1);
    const complete = remaining === 0;

    const amount = formatMoney(remaining, this.dataset.moneyFormat ?? '{{amount}}', currency ?? '');
    const message = complete
      ? this.dataset.successMessage ?? ''
      : (this.dataset.progressMessage ?? '').replaceAll('[amount]', amount);

    if (this.refs.message.textContent !== message) this.refs.message.textContent = message;
    this.refs.fill.style.setProperty('--free-shipping-progress', String(progress));
    this.classList.toggle('free-shipping-progress--complete', complete);
  }
}

if (!customElements.get('free-shipping-progress')) {
  customElements.define('free-shipping-progress', FreeShippingProgress);
}

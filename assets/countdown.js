import { Component } from '@theme/component';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Counts down to the date and time in `data-end-at`. It recalculates from the
 * clock on every tick, so it stays accurate after the tab has been in the background.
 *
 * @typedef {object} CountdownTimerRefs
 * @property {HTMLElement} units - The wrapper around the four values
 * @property {HTMLElement} days - The days value
 * @property {HTMLElement} hours - The hours value
 * @property {HTMLElement} minutes - The minutes value
 * @property {HTMLElement} seconds - The seconds value
 * @property {HTMLElement} [finished] - The optional message shown when the time is up
 *
 * @extends {Component<CountdownTimerRefs>}
 */
export class CountdownTimer extends Component {
  requiredRefs = ['units', 'days', 'hours', 'minutes', 'seconds'];

  /** @type {number | undefined} */
  #interval;

  connectedCallback() {
    super.connectedCallback();
    this.#start();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#interval);
  }

  #start() {
    clearInterval(this.#interval);

    const endAt = Date.parse(this.dataset.endAt ?? '');

    // An unreadable date can't count down, so hide the block instead of showing dashes.
    this.hidden = Number.isNaN(endAt);
    if (this.hidden) return;

    if (this.#render(endAt)) {
      this.#interval = window.setInterval(() => {
        if (!this.#render(endAt)) clearInterval(this.#interval);
      }, SECOND);
    }
  }

  /**
   * @param {number} endAt - The end time in milliseconds
   * @returns {boolean} Whether there is still time remaining
   */
  #render(endAt) {
    const { units, days, hours, minutes, seconds, finished } = this.refs;
    const remaining = endAt - Date.now();
    const isRunning = remaining > 0;

    units.hidden = !isRunning;
    if (finished) finished.hidden = isRunning;
    if (!isRunning) return false;

    days.textContent = String(Math.floor(remaining / DAY)).padStart(2, '0');
    hours.textContent = String(Math.floor((remaining % DAY) / HOUR)).padStart(2, '0');
    minutes.textContent = String(Math.floor((remaining % HOUR) / MINUTE)).padStart(2, '0');
    seconds.textContent = String(Math.floor((remaining % MINUTE) / SECOND)).padStart(2, '0');

    return true;
  }
}

if (!customElements.get('countdown-timer')) {
  customElements.define('countdown-timer', CountdownTimer);
}

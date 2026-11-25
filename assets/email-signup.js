import { Component } from '@theme/component';
import { DialogComponent } from '@theme/dialog';

const REQUEST_TIMEOUT = 15000;

/**
 * Bubbles from a signup form after Shopify accepts a subscription without a page load.
 */
export class EmailSignupSuccessEvent extends Event {
  constructor() {
    super(EmailSignupSuccessEvent.eventName, { bubbles: true });
  }

  static eventName = 'email-signup:success';
}

/**
 * Submits a newsletter form in the background and confirms it in a dialog, or inline when the
 * form already sits in a dialog. Anything unexpected falls back to a normal form submission.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} error - Inline error container.
 * @property {HTMLElement} errorText - Error message text.
 * @property {HTMLElement} inlineSuccess - Success message for forms inside a dialog.
 *
 * @extends Component<Refs>
 */
class EmailSignup extends Component {
  requiredRefs = ['error', 'errorText', 'inlineSuccess'];

  #sending = false;

  /** @type {HTMLFormElement | undefined} */
  #enhancedForm;

  /** @type {AbortController | undefined} */
  #controller;

  connectedCallback() {
    super.connectedCallback();

    const form = this.querySelector('form');
    if (!form) return;

    if (form !== this.#enhancedForm) {
      // Too late to hook in once the captcha has captured the native submit.
      if (form.hasAttribute('data-hcaptcha-bound')) return;

      // Shopify's captcha calls form.submit() after adding its token, so replacing it keeps
      // that protection in place.
      form.submit = this.#send;
      this.#enhancedForm = form;
    }

    this.#controller?.abort();
    this.#controller = new AbortController();

    // Window runs after the captcha listeners. Those cancel the event and call form.submit()
    // themselves; without a captcha the event arrives here untouched.
    window.addEventListener(
      'submit',
      (event) => {
        if (event.target !== this.#enhancedForm || event.defaultPrevented) return;
        event.preventDefault();
        this.#send();
      },
      { signal: this.#controller.signal }
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#controller?.abort();
  }

  #send = async () => {
    const form = this.#enhancedForm;
    if (!form || this.#sending) return;

    this.#setSending(true);
    this.#clearMessages();

    try {
      const response = await fetch(new URL(form.getAttribute('action') ?? '', window.location.href), {
        method: 'POST',
        // @ts-ignore - The form has no file fields.
        body: new URLSearchParams(new FormData(form)),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
      const url = new URL(response.url);

      if (response.ok && url.searchParams.get('customer_posted') === 'true') {
        this.#setSending(false);
        this.#showSuccess();
        return;
      }

      const error = url.pathname.endsWith('/challenge') ? '' : findError(await response.text());
      if (!error) throw new Error('Unexpected signup response');

      this.#setSending(false);
      this.#showError(error);
    } catch {
      // Covers captcha challenges, timeouts, and blocked requests.
      HTMLFormElement.prototype.submit.call(form);
    }
  };

  /**
   * @param {boolean} sending
   */
  #setSending(sending) {
    this.#sending = sending;
    this.#enhancedForm?.setAttribute('aria-busy', String(sending));
    this.querySelector('.email-signup__button')?.toggleAttribute('disabled', sending);
  }

  #clearMessages() {
    for (const message of this.querySelectorAll('[data-server-message]')) message.remove();
    this.refs.error.hidden = true;
    this.refs.errorText.textContent = '';

    const input = this.querySelector('input[type="email"]');
    input?.removeAttribute('aria-invalid');
    input?.removeAttribute('aria-describedby');
  }

  /**
   * @param {string} message
   */
  #showError(message) {
    this.refs.error.hidden = false;
    this.refs.errorText.textContent = message;

    const input = this.querySelector('input[type="email"]');
    if (!(input instanceof HTMLInputElement)) return;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', this.refs.error.id);
    input.focus();
  }

  #showSuccess() {
    const form = this.#enhancedForm;
    const dialog = this.querySelector('dialog-component');
    const insideDialog = this.closest('dialog') !== null;

    form?.reset();

    if (form && (insideDialog || !(dialog instanceof DialogComponent))) {
      form.hidden = true;
      this.refs.inlineSuccess.hidden = false;
      this.refs.inlineSuccess.focus({ preventScroll: true });
    } else if (dialog instanceof DialogComponent) {
      // Disabling the button dropped focus, so restore it for the dialog to return to.
      const button = this.querySelector('.email-signup__button');
      if (button instanceof HTMLElement) button.focus({ preventScroll: true });
      dialog.showDialog();
    }

    this.dispatchEvent(new EmailSignupSuccessEvent());
  }
}

/**
 * @param {string} html
 * @returns {string} The signup error rendered by the theme, if any.
 */
function findError(html) {
  const message = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-server-message="error"]');
  return message?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

if (!customElements.get('email-signup-component')) customElements.define('email-signup-component', EmailSignup);

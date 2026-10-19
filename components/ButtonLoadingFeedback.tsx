"use client";

import { useEffect } from "react";

type LoadingState = {
  timer: number;
  previousAriaBusy: string | null;
  observer: MutationObserver;
  waitingForEnable: boolean;
  finishWhenReady: () => void;
};

export default function ButtonLoadingFeedback() {
  useEffect(() => {
    const states = new Map<HTMLButtonElement, LoadingState>();

    const finishLoading = (button: HTMLButtonElement, state: LoadingState) => {
      window.clearTimeout(state.timer);
      state.observer.disconnect();
      delete button.dataset.buttonLoading;
      if (state.previousAriaBusy === null) button.removeAttribute("aria-busy");
      else button.setAttribute("aria-busy", state.previousAriaBusy);
      states.delete(button);
    };

    const showLoading = (button: HTMLButtonElement, duration: number) => {
      if (button.disabled || button.getAttribute("aria-disabled") === "true" || button.hasAttribute("data-loading-ignore")) return;
      const isBusy = () => button.disabled || button.getAttribute("aria-disabled") === "true";
      const previous = states.get(button);
      if (previous) {
        window.clearTimeout(previous.timer);
        previous.timer = window.setTimeout(previous.finishWhenReady, duration);
        return;
      }

      const state: LoadingState = {
        timer: 0,
        previousAriaBusy: button.getAttribute("aria-busy"),
        finishWhenReady: () => undefined,
        observer: new MutationObserver(() => {
          if (!state.waitingForEnable || isBusy()) return;
          state.waitingForEnable = false;
          window.clearTimeout(state.timer);
          state.timer = window.setTimeout(() => finishLoading(button, state), 120);
        }),
        waitingForEnable: false,
      };
      const finishWhenReady = () => {
        if (isBusy() && button.isConnected) {
          state.waitingForEnable = true;
          state.timer = window.setTimeout(finishWhenReady, 250);
          return;
        }
        finishLoading(button, state);
      };
      state.finishWhenReady = finishWhenReady;
      button.dataset.buttonLoading = "true";
      button.setAttribute("aria-busy", "true");
      state.observer.observe(button, { attributes: true, attributeFilter: ["disabled", "aria-disabled"] });
      state.timer = window.setTimeout(finishWhenReady, duration);
      states.set(button, state);
    };

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (button) showLoading(button, button.type === "submit" ? 900 : 520);
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const submitter = event.submitter instanceof HTMLButtonElement
        ? event.submitter
        : form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
      if (submitter) showLoading(submitter, 1600);
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      for (const [button, state] of states) finishLoading(button, state);
    };
  }, []);

  return null;
}

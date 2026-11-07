"use client";

import { useSyncExternalStore } from "react";
import styles from "./language-practice.module.css";
import { trackUsage } from "../lib/usage";

const layouts = [
  { id: "classic", name: "Classic", description: "The original stacked exercise card." },
  { id: "compact", name: "Compact", description: "Smaller cards, less padding and a shorter answer box." },
  { id: "focus", name: "Focus", description: "A narrow, centered column with the review stacked below." },
  { id: "split", name: "Split", description: "Prompt and answer side by side on wider screens." },
  { id: "immersive", name: "Immersive", description: "A large prompt with extra room for reading or listening." },
] as const;

type ExerciseLayout = (typeof layouts)[number]["id"];
const defaultLayout: ExerciseLayout = "classic";
const layoutKey = "chapp.exercise-layout";
let temporaryLayout: ExerciseLayout | undefined;

function readLayout(): ExerciseLayout {
  if (temporaryLayout) return temporaryLayout;
  try {
    const stored = window.localStorage.getItem(layoutKey);
    return layouts.find(layout => layout.id === stored)?.id ?? defaultLayout;
  } catch {
    return defaultLayout;
  }
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === layoutKey || event.key === null) onChange();
  }
  window.addEventListener(layoutKey, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(layoutKey, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function selectLayout(layout: ExerciseLayout) {
  try {
    window.localStorage.setItem(layoutKey, layout);
    temporaryLayout = undefined;
  } catch {
    temporaryLayout = layout;
  }
  window.dispatchEvent(new Event(layoutKey));
  trackUsage("action", "layout-changed", 0, { layout });
}

export function useExerciseLayout() {
  return useSyncExternalStore(subscribe, readLayout, () => defaultLayout);
}

export function ExerciseLayoutPicker({ layout }: { layout: ExerciseLayout }) {
  return <fieldset className={styles["layout-picker"]}>
    <legend>Exercise layout</legend>
    <div className={styles["layout-options"]}>
      {layouts.map(option => <label key={option.id}>
        <input type="radio" name="exercise-layout" value={option.id} checked={option.id === layout}
          onChange={() => selectLayout(option.id)} />
        <span>{option.name}</span>
      </label>)}
    </div>
    <p aria-live="polite">{layouts.find(option => option.id === layout)?.description}</p>
  </fieldset>;
}

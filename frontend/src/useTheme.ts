import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * The dealt style (framed-sheet) is a light one, so light is the default and
 * dark is an explicit opt-in rather than something inherited from the OS.
 * Once chosen, the preference is remembered.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("lgm-theme");
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("lgm-theme", theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

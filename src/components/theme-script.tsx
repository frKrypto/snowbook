export const THEME_STORAGE_KEY = "snowbook-theme";

/**
 * Resolves the stored preference and stamps data-theme on <html> before the
 * page paints, so a dark-mode user never sees a flash of the light palette.
 *
 * "system" is resolved to a concrete light/dark value here, which is why the
 * stylesheet only needs a [data-theme="dark"] block and no duplicated
 * prefers-color-scheme media query.
 */
const script = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||"system";var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

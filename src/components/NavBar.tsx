"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Bell, Info, LayoutDashboard, Menu, Moon, PiggyBank, Search, Sun, Ticket, X } from "lucide-react";
import type { MessageKey } from "@/i18n/messages/en";
import { useI18n } from "@/i18n";
import { useAlerts, useWatchlist } from "@/lib/storage";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTheme } from "./ThemeProvider";
import { PlaneIcon } from "./illustrations";

const LINKS: Array<{ href: string; key: MessageKey; icon: typeof Search }> = [
  { href: "/", key: "nav.search", icon: Search },
  { href: "/budget", key: "nav.budget", icon: PiggyBank },
  { href: "/predict", key: "nav.predict", icon: BarChart3 },
  { href: "/watchlist", key: "nav.watchlist", icon: Bell },
  { href: "/trips", key: "nav.trips", icon: Ticket },
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/about", key: "nav.about", icon: Info },
];

export function Logo() {
  const { t } = useI18n();
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={`${t("app.name")} - ${t("app.tagline")}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-md shadow-brand-500/30">
        <PlaneIcon className="rtl-flip h-4 w-8 -rotate-12 transition group-hover:-translate-y-0.5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
          Sky<span className="text-brand-600 dark:text-brand-400">Fare</span>
        </span>
        <span className="line-clamp-2 max-w-[10.5rem] text-[11px] font-medium text-slate-500 sm:max-w-[15rem] dark:text-slate-400" data-testid="tagline">
          {t("app.tagline")}
        </span>
      </span>
    </Link>
  );
}

/**
 * Shows the inline desktop menu only when every link fits on one line in the
 * current language; otherwise falls back to the burger menu. Measured from a
 * hidden copy of the menu so it works for any language added later.
 */
function useMenuFits(deps: unknown[]) {
  const navRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLUListElement>(null);
  const [fits, setFits] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      const probe = probeRef.current;
      if (!nav || !probe) return;
      const logo = nav.querySelector<HTMLElement>("[data-logo]");
      const tools = nav.querySelector<HTMLElement>("[data-tools]");
      const burger = nav.querySelector<HTMLElement>("[data-testid=menu-toggle]");
      const style = getComputedStyle(nav);
      const inner = nav.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      // Tools width without the burger button (it disappears when the menu is inline).
      const burgerW = burger && burger.offsetWidth ? burger.offsetWidth + 8 : 0;
      const toolsW = (tools?.offsetWidth ?? 0) - burgerW;
      // 2 x 12px flex gaps + 8px menu margin + 16px safety margin
      const needed = probe.scrollWidth + (logo?.offsetWidth ?? 0) + toolsW + 48;
      const next = window.innerWidth >= 1024 && needed <= inner;
      setFits((prev) => (prev === next ? prev : next));
    };
    measure();
    // Coalesce bursts of resize / font events into one measurement per frame.
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    // Watch only elements whose size does NOT depend on `fits` (the nav width
    // and the hidden probe). Watching the tools group would feed back on
    // itself, because showing/hiding the burger changes its width.
    const ro = new ResizeObserver(schedule);
    const nav = navRef.current;
    if (nav) ro.observe(nav);
    if (probeRef.current) ro.observe(probeRef.current);
    document.fonts?.ready.then(schedule).catch(() => {});
    document.fonts?.addEventListener?.("loadingdone", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { navRef, probeRef, fits };
}

export function NavBar() {
  const { t, lang } = useI18n();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [watchlist] = useWatchlist();
  const [alerts] = useAlerts();
  const activeAlerts = alerts.filter((a) => !a.dismissed).length;
  const { navRef, probeRef, fits } = useMenuFits([lang, activeAlerts, watchlist.length]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (fits) setOpen(false);
  }, [fits]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/results") : pathname.startsWith(href));

  const linkItems = (probe: boolean) =>
    LINKS.map(({ href, key, icon: Icon }) => (
      <li key={href}>
        <Link
          href={href}
          tabIndex={probe ? -1 : undefined}
          aria-current={!probe && isActive(href) ? "page" : undefined}
          className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition ${
            isActive(href)
              ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {t(key)}
          {href === "/watchlist" && (activeAlerts > 0 || watchlist.length > 0) && (
            <span
              className={`ms-0.5 rounded-full px-1.5 text-[10px] font-bold ${activeAlerts ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}
            >
              {activeAlerts || watchlist.length}
            </span>
          )}
        </Link>
      </li>
    ));

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white">
        {t("nav.skip")}
      </a>
      <nav ref={navRef} className="relative mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6" aria-label="Main">
        <div data-logo className="shrink-0">
          <Logo />
        </div>
        {/* invisible probe used to measure the menu width in the current language */}
        <ul ref={probeRef} aria-hidden="true" className="pointer-events-none invisible absolute -top-96 start-0 flex w-max items-center gap-0.5">
          {linkItems(true)}
        </ul>
        {fits && <ul className="ms-2 flex flex-1 items-center gap-0.5" data-testid="inline-menu">{linkItems(false)}</ul>}
        <div data-tools className="ms-auto flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <button
            type="button"
            onClick={toggle}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-amber-300"
            aria-label={theme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}
            title={theme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}
            data-testid="theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className={`relative h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${fits ? "hidden" : "grid"}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={t("nav.menu")}
            onClick={() => setOpen((o) => !o)}
            data-testid="menu-toggle"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            {activeAlerts > 0 && !open && <span className="absolute -end-1 -top-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />}
          </button>
        </div>
      </nav>
      {open && !fits && (
        <div id="mobile-nav" className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-950">
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {LINKS.map(({ href, key, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(href) ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(key)}
                  {href === "/watchlist" && activeAlerts > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{activeAlerts}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 sm:hidden">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </header>
  );
}

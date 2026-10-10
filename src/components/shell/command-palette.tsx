"use client";

import { CornerDownLeft, Search, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProducts } from "@/features/catalog/api/use-products";
import { useSession } from "@/lib/auth/session-context";
import { can } from "@/lib/rbac/permissions";
import { navFor } from "@/lib/rbac/routes";
import { useShellStore } from "@/lib/stores/shell-store";
import { cn } from "@/lib/utils";

interface Entry {
  id: string;
  group: "Pages" | "Products";
  label: string;
  hint?: string;
  icon: ReactNode;
  href: string;
}

/** ⌘K / Ctrl+K palette: jump to any page the role can open, or find a product by name. */
export function CommandPalette() {
  const open = useShellStore((s) => s.paletteOpen);
  const setOpen = useShellStore((s) => s.setPaletteOpen);
  const { role } = useSession();
  const router = useRouter();
  const products = useProducts();

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useShellStore.getState().setPaletteOpen(!useShellStore.getState().paletteOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Entry[] = navFor(role).map((item) => ({
      id: item.href,
      group: "Pages",
      label: item.label,
      icon: <item.icon className="size-4" />,
      href: item.href,
    }));
    const matchedPages = q ? pages.filter((p) => p.label.toLowerCase().includes(q)) : pages;

    const found: Entry[] =
      q && can(role, "products.view") && products.data
        ? products.data
            .filter((p) => p.name.toLowerCase().includes(q))
            .slice(0, 6)
            .map((p) => ({
              id: p.id,
              group: "Products" as const,
              label: p.name,
              hint: p.category,
              icon: <ShoppingBag className="size-4" />,
              href: `/products?q=${encodeURIComponent(p.name)}`,
            }))
        : [];
    return [...matchedPages, ...found];
  }, [query, role, products.data]);

  function choose(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    router.push(entry.href);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setCursor(0);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, entries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(entries[cursor]);
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let lastGroup = "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to a page or find a product by name.
        </DialogDescription>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-label="Search pages and products"
            placeholder="Search pages or products…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </div>
        <ul
          id="command-list"
          ref={listRef}
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto p-2"
        >
          {entries.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-text-secondary">
              Nothing matches &ldquo;{query}&rdquo;. Try a product name.
            </li>
          ) : (
            entries.map((entry, index) => {
              const heading = entry.group !== lastGroup ? entry.group : null;
              lastGroup = entry.group;
              return (
                <li key={`${entry.group}-${entry.id}`} role="presentation">
                  {heading ? (
                    <p className="px-3 pt-2 pb-1 text-xs font-medium text-text-secondary">
                      {heading}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    data-index={index}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => choose(entry)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none",
                      index === cursor && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="grid size-7 place-items-center rounded-md bg-surface-hover text-text-secondary">
                      {entry.icon}
                    </span>
                    <span className="flex-1">{entry.label}</span>
                    {entry.hint ? (
                      <span className="text-xs text-text-secondary">{entry.hint}</span>
                    ) : null}
                    {index === cursor ? (
                      <CornerDownLeft className="size-3.5 text-text-secondary" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

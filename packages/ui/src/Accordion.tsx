import * as A from "@radix-ui/react-accordion";
import type { ReactNode } from "react";

export type AccordionItem = { id: string; title: string; content: ReactNode };

export function Accordion({ items, defaultOpen }: { items: AccordionItem[]; defaultOpen?: string }) {
  return (
    <A.Root type="single" collapsible defaultValue={defaultOpen} className="divide-y divide-line border-y border-line">
      {items.map((i) => (
        <A.Item key={i.id} value={i.id}>
          <A.Header>
            <A.Trigger className="flex min-h-12 w-full items-center justify-between text-left font-semibold [&[data-state=open]>span]:rotate-45">
              {i.title}
              <span aria-hidden className="text-xl transition-transform">+</span>
            </A.Trigger>
          </A.Header>
          <A.Content className="pb-4 text-sm text-muted">{i.content}</A.Content>
        </A.Item>
      ))}
    </A.Root>
  );
}

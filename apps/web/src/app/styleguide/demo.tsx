"use client";
import { Accordion, Badge, Button, Stepper } from "@app/ui";
import { useState } from "react";

export function StyleguideDemo() {
  const [qty, setQty] = useState(1);
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <h1 className="text-3xl">Styleguide</h1>
      <section className="flex flex-wrap items-center gap-3">
        <Button>Add to cart</Button><Button variant="secondary">Buy it now</Button><Button variant="ghost">Learn more</Button>
      </section>
      <section className="flex gap-2"><Badge tone="discount">18% OFF</Badge><Badge tone="sale">Save 18%</Badge><Badge tone="success">In stock</Badge><Badge>Bestseller</Badge></section>
      <Stepper value={qty} onChange={setQty} />
      <Accordion defaultOpen="d" items={[{ id: "d", title: "Description", content: "Vacuum insulated, rust-resistant." }, { id: "s", title: "Specifications", content: "SS 304 · 24h hot/cold" }]} />
    </main>
  );
}

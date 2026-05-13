"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CardioUnit, Movement, MovementKind } from "@/lib/types";

export default function MovementsManager({ initial }: { initial: Movement[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Movement[]>(initial);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MovementKind>("weight");
  const [unit, setUnit] = useState<CardioUnit>("mi");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("movements")
        .insert({
          name: trimmed,
          kind,
          unit: kind === "cardio" ? unit : null,
          notes: null,
        })
        .select("*")
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      if (data) setItems([...items, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this movement? Past sessions referencing it will keep their entries.")) return;
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("movements").delete().eq("id", id);
      if (error) setError(error.message);
      else setItems(items.filter((m) => m.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            placeholder="Movement name (e.g., Back squat)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select value={kind} onChange={(e) => setKind(e.target.value as MovementKind)}>
            <option value="weight">weight</option>
            <option value="cardio">cardio</option>
          </select>
          {kind === "cardio" ? (
            <select value={unit} onChange={(e) => setUnit(e.target.value as CardioUnit)}>
              <option value="mi">miles</option>
              <option value="km">km</option>
              <option value="m">meters</option>
            </select>
          ) : (
            <span />
          )}
          <button
            onClick={create}
            disabled={pending || !name.trim()}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg hover:opacity-90"
          >
            Add
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-bad">{error}</p> : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-sub">No movements yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-line bg-panel px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{m.name}</span>{" "}
                <span className="text-xs text-sub">
                  {m.kind === "cardio" ? `cardio · ${m.unit}` : "weight"}
                </span>
              </div>
              <button onClick={() => remove(m.id)} className="text-xs text-sub hover:text-bad">
                delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

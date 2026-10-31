"use client";
import { createContext, useContext } from "react";

export type Me = { id: string; email: string; name: string; role: string; perms: string[] };

export const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx)!;
export const can = (me: Me, p: string) => me.perms.includes("*") || me.perms.includes(p);

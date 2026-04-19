// usePlan.js — Hook central para control de planes
// Uso: const { isPro, isCoach, isGym, plan, showPaywall } = usePlan();

import { useContext, useState, useCallback } from "react";
import { AuthCtx } from "./AuthContext";

// Jerarquía de planes: guest < free < pro < coach < gym
const PLAN_RANK = { guest: 0, free: 1, pro: 2, coach: 3, gym: 4 };

export function usePlan() {
  const { user } = useContext(AuthCtx);
  const plan = user?.plan || "free";
  const rank = PLAN_RANK[plan] ?? 1;

  const isPro   = rank >= PLAN_RANK.pro;
  const isCoach = rank >= PLAN_RANK.coach;
  const isGym   = rank >= PLAN_RANK.gym;
  const isFree  = rank < PLAN_RANK.pro;

  // canAccess("pro") → true si el usuario tiene pro o superior
  const canAccess = useCallback(
    (required) => rank >= (PLAN_RANK[required] ?? 1),
    [rank]
  );

  return { plan, isPro, isCoach, isGym, isFree, canAccess };
}
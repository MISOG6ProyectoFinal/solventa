import { create } from "zustand";
import { Actions, State } from "../types";

export const useHomeStore = create<State & Actions>((set) => ({
  counter: 0,
  increaseCounter: () => set((state) => ({ counter: state.counter + 1 })),
}));

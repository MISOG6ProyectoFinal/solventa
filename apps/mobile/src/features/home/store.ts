import { create } from "zustand";

type State = {
  counter: number;
}

type Actions = {
  increaseCounter: () => void;
}

export const useHomeStore = create<State & Actions>((set) => ({
  counter: 0,
  increaseCounter: () => set((state) => ({ counter: state.counter + 1 })),
}));

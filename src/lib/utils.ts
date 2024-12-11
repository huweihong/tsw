import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { MODELS } from "~utils/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function upperCaseFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getProviderFromModel(model: string) {
  for (const [provider, models] of Object.entries(MODELS)) {
    if (models.includes(model)) {
      return provider;
    }
  }
  return "";
}

import type { MDXComponents } from "mdx/types";
import { Chart } from "@/components/chart";

const components: MDXComponents = { Chart };

export function useMDXComponents(): MDXComponents {
  return components;
}

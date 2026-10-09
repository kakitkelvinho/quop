declare module "svgcanvas" {
  /** A 2D context that records what is drawn on it as SVG elements; only what svg-export.ts touches. */
  export class Context {
    constructor(options: { width: number; height: number });
    fillStyle: CanvasRenderingContext2D["fillStyle"];
    textAlign: CanvasTextAlign;
    fillText(text: string, x: number, y: number): void;
    getSvg(): SVGSVGElement;
    /** `true` rewrites named entities as numeric ones, which a standalone SVG needs. */
    getSerializedSvg(fixNamedEntities?: boolean): string;
  }
}

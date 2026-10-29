import "katex/dist/katex.min.css";

import katex from "katex";

import { FORMULA_SHEETS } from "@/components/calculators/formula-sheets";

const tex = (source: string, displayMode = false) => ({
  __html: katex.renderToString(source, { displayMode, throwOnError: true, output: "htmlAndMathml" }),
});

/**
 * A calculator's working, under its fields: the equations it uses, then a
 * fold listing what every symbol stands for, with the value of each constant.
 */
export function FormulaSheet({ href }: { href: string }) {
  const sheet = FORMULA_SHEETS[href];
  if (!sheet) return null;

  return (
    <section className="formulaSheet" aria-label="Equations">
      <div className="formulaSheet__equations">
        {sheet.equations.map((equation) => (
          <div key={equation} className="formulaSheet__equation" dangerouslySetInnerHTML={tex(equation, true)} />
        ))}
      </div>
      <details className="formulaSheet__symbols">
        <summary>Symbols</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Symbol</th>
              <th scope="col">Meaning</th>
              <th scope="col">Value</th>
              <th scope="col">Unit</th>
            </tr>
          </thead>
          <tbody>
            {sheet.symbols.map((row) => (
              <tr key={row.symbol}>
                <th scope="row" dangerouslySetInnerHTML={tex(row.symbol)} />
                <td>{row.meaning}</td>
                {row.value ? <td dangerouslySetInnerHTML={tex(row.value)} /> : <td className="formulaSheet__none">—</td>}
                {row.unit ? <td dangerouslySetInnerHTML={tex(row.unit)} /> : <td className="formulaSheet__none">—</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

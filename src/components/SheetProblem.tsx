import { Dateline } from "./Dateline";

export function SheetProblem() {
  return (
    <div className="wrap">
      <Dateline eyebrow="Rates unavailable" date="The sheet could not be read" />
      <p className="lede">
        The daily sheet needs to stay shared so anyone with the link can view it. Update the
        sharing setting, then refresh this page.
      </p>
    </div>
  );
}

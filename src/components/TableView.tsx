import type { CardTable } from "../core/model";
export function TableView({ table }: { table: CardTable }) {
  return (
    <div className="table-scroll" tabIndex={0}>
      <table>
        <caption>{table.caption || "Daten zur Karte"}</caption>
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th scope="col" key={i}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { CardTable } from "../core/model";
export function TableEditor({
  table,
  onChange,
}: {
  table: CardTable;
  onChange: (table: CardTable | undefined) => void;
}) {
  return (
    <fieldset>
      <legend>Bearbeitbare Tabelle</legend>
      <label>
        Tabellenüberschrift
        <input
          maxLength={200}
          value={table.caption ?? ""}
          onChange={(e) => onChange({ ...table, caption: e.target.value })}
        />
      </label>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {table.headers.map((value, i) => (
                <th key={i}>
                  <input
                    aria-label={`Spalte ${i + 1}`}
                    maxLength={80}
                    value={value}
                    onChange={(e) =>
                      onChange({
                        ...table,
                        headers: table.headers.map((h, j) =>
                          j === i ? e.target.value : h,
                        ),
                      })
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((value, j) => (
                  <td key={j}>
                    <input
                      aria-label={`Zeile ${i + 1}, Spalte ${j + 1}`}
                      maxLength={120}
                      value={value}
                      onChange={(e) =>
                        onChange({
                          ...table,
                          rows: table.rows.map((r, k) =>
                            k === i
                              ? r.map((v, l) => (l === j ? e.target.value : v))
                              : r,
                          ),
                        })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button
          type="button"
          disabled={table.rows.length >= 20}
          onClick={() =>
            onChange({
              ...table,
              rows: [...table.rows, table.headers.map(() => "")],
            })
          }
        >
          Zeile hinzufügen
        </button>
        <button
          type="button"
          disabled={table.headers.length >= 6}
          onClick={() =>
            onChange({
              ...table,
              headers: [...table.headers, `Spalte ${table.headers.length + 1}`],
              rows: table.rows.map((r) => [...r, ""]),
            })
          }
        >
          Spalte hinzufügen
        </button>
        <button
          type="button"
          disabled={table.rows.length <= 1}
          onClick={() => onChange({ ...table, rows: table.rows.slice(0, -1) })}
        >
          Letzte Zeile entfernen
        </button>
        <button
          type="button"
          disabled={table.headers.length <= 1}
          onClick={() =>
            onChange({
              ...table,
              headers: table.headers.slice(0, -1),
              rows: table.rows.map((r) => r.slice(0, -1)),
            })
          }
        >
          Letzte Spalte entfernen
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Diese Tabelle aus der Karte entfernen?"))
              onChange(undefined);
          }}
        >
          Tabelle entfernen
        </button>
      </div>
    </fieldset>
  );
}

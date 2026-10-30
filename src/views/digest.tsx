import type { DigestRow } from '../digest/types.js';

export function DigestPage({
  night,
  rows,
  empty,
}: {
  night: string;
  rows: readonly DigestRow[];
  empty: boolean;
}) {
  return (
    <>
      <h1>digest · {night}</h1>
      {empty ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">job</th>
              <th scope="col">owner</th>
              <th scope="col">runs</th>
              <th scope="col">retries</th>
              <th scope="col">last status</th>
              <th scope="col">last error</th>
              <th scope="col">first time</th>
              <th scope="col">last time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const marked = row.lastStatus === 'fail' || row.retries >= 3;
              return (
                <tr class={marked ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '—'}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? '—'}</td>
                  <td><time dateTime={row.firstTime}>{row.firstTime}</time></td>
                  <td><time dateTime={row.lastTime}>{row.lastTime}</time></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

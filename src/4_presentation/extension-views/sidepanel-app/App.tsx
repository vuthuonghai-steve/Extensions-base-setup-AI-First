import { buildMenu } from './menu';

/** SidePanel = menu tĩnh (D10) — thuần presentation, không business state. */
export function SidePanelApp(): React.JSX.Element {
  const items = buildMenu();
  return (
    <nav style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 16, margin: '0 0 12px' }}>Extension</h1>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li key={item.label} style={{ marginBottom: 8 }}>
            <button type="button" onClick={item.open}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

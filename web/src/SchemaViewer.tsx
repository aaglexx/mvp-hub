import type { SchemaProperty, MCPToolSchema } from "./api";

interface Props {
  name: string;
  schema?: MCPToolSchema;
  description?: string;
}

function getType(prop: SchemaProperty): string {
  if (!prop.type) return "any";
  if (Array.isArray(prop.type)) {
    const filtered = prop.type.filter((t) => t !== "null");
    return filtered.length > 0 ? filtered.join(" | ") : "any";
  }
  return prop.type;
}

function getTypeBadgeClass(type: string): string {
  if (type === "string") return "type-string";
  if (type === "number" || type === "integer") return "type-number";
  if (type === "boolean") return "type-boolean";
  if (type === "array") return "type-array";
  if (type === "object") return "type-object";
  return "type-any";
}

function PropertyRow({
  propName,
  prop,
  required,
  depth,
}: {
  propName: string;
  prop: SchemaProperty;
  required: boolean;
  depth: number;
}) {
  // Guard against infinite recursion
  if (depth > 4) return null;

  const type = getType(prop);
  const childProps = prop.type === "object" && prop.properties
    ? Object.entries(prop.properties)
    : [];
  const childRequired = prop.required ?? [];

  return (
    <div className="schema-row-wrap">
      <div className="schema-row" style={{ paddingLeft: depth * 16 + 12 }}>
        <div className="schema-row-left">
          {depth > 0 && <span className="schema-indent">└ </span>}
          <span className="schema-prop-name">{propName}</span>
          <span className={`schema-type ${getTypeBadgeClass(type)}`}>{type}</span>
          {type === "array" && prop.items && (
            <span className={`schema-type ${getTypeBadgeClass(getType(prop.items))}`}>
              {getType(prop.items)}[]
            </span>
          )}
          {prop.enum && prop.enum.length > 0 && (
            <span className="schema-enum" title={prop.enum.map(String).join(" | ")}>
              {prop.enum.map(String).slice(0, 4).join(" | ")}
              {prop.enum.length > 4 ? ` +${prop.enum.length - 4}` : ""}
            </span>
          )}
        </div>
        <div className="schema-row-right">
          {required
            ? <span className="schema-badge required">required</span>
            : <span className="schema-badge optional">optional</span>
          }
          {prop.default !== undefined && (
            <span className="schema-default" title={`default: ${JSON.stringify(prop.default)}`}>
              = {JSON.stringify(prop.default)}
            </span>
          )}
        </div>
      </div>

      {prop.description && (
        <div className="schema-desc" style={{ paddingLeft: depth * 16 + 28 }}>
          {prop.description}
        </div>
      )}

      {(prop.minimum !== undefined || prop.maximum !== undefined) && (
        <div className="schema-desc" style={{ paddingLeft: depth * 16 + 28 }}>
          range: {prop.minimum ?? "−∞"} – {prop.maximum ?? "+∞"}
        </div>
      )}

      {(prop.minLength !== undefined || prop.maxLength !== undefined) && (
        <div className="schema-desc" style={{ paddingLeft: depth * 16 + 28 }}>
          length: {prop.minLength ?? 0} – {prop.maxLength ?? "∞"}
        </div>
      )}

      {childProps.map(([k, v]) => (
        <PropertyRow
          key={k}
          propName={k}
          prop={v as SchemaProperty}
          required={childRequired.includes(k)}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function SchemaViewer({ name, schema, description }: Props) {
  const properties = schema?.properties ?? {};
  const required = schema?.required ?? [];
  const entries = Object.entries(properties);

  // Sort: required first, then optional
  const sorted = [
    ...entries.filter(([k]) => required.includes(k)),
    ...entries.filter(([k]) => !required.includes(k)),
  ];

  return (
    <div className="schema-viewer">
      <div className="schema-header">
        <span className="schema-tool-name">{name}</span>
        {entries.length > 0 && (
          <span className="schema-param-count">
            {entries.length} param{entries.length !== 1 ? "s" : ""}
            {required.length > 0 && (
              <> · <span style={{ color: "var(--accent)" }}>{required.length} required</span></>
            )}
          </span>
        )}
      </div>

      {description && <p className="schema-tool-desc">{description}</p>}

      {entries.length === 0 ? (
        <div className="schema-empty">No parameters — call with {"{}"}</div>
      ) : (
        <div className="schema-table">
          <div className="schema-table-header">
            <span>parameter</span>
            <span>constraint</span>
          </div>
          {sorted.map(([k, v]) => (
            <PropertyRow
              key={k}
              propName={k}
              prop={v as SchemaProperty}
              required={required.includes(k)}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

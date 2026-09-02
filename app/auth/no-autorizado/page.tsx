export default function NoAutorizado() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 14 }}>Cuenta no autorizada</h1>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Este sistema es solo para cuentas corporativas de Adapsys.
      </p>
      <a href="/login" style={{ color: "var(--teal)", fontSize: 13 }}>
        Volver a intentar
      </a>
    </main>
  );
}

export default function NoAutorizado() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "0 24px",
        textAlign: "center",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 14, margin: 0 }}>
        Cuenta no autorizada
      </h1>
      {/* El motivo real no se detalla a propósito: decir "tu correo no está en la
          lista" frente a "ese dominio no corresponde" le confirma a un desconocido
          cuál de las dos cosas cambiar. Para quien sí trabaja acá, la instrucción
          de a quién pedirle acceso es lo único útil. */}
      <p style={{ color: "var(--muted)", fontSize: 13, maxWidth: 380, lineHeight: 1.5 }}>
        El acceso a la tesorería está limitado al equipo de administración y finanzas.
        Si necesitas entrar, pídelo a quien administra el sistema.
      </p>
      <a href="/login" style={{ color: "var(--teal)", fontSize: 13 }}>
        Volver a intentar con otra cuenta
      </a>
    </main>
  );
}

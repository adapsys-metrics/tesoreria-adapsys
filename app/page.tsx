import { redirect } from "next/navigation";

// Se entra por los movimientos y no por el flujo. El flujo es para mirar; el día a
// día es revisar lo que viene y accionarlo, y para eso la barra lateral arranca
// abierta en los egresos proyectados (ver estadoInicial en ProveedorTesoreria).
export default function Home() {
  redirect("/movimientos");
}

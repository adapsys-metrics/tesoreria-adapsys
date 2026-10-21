import { Flujo } from "@/components/flujo/Flujo";
import { titulo } from "@/lib/marca";

export const metadata = { title: titulo("Flujo de caja") };

export default function PaginaFlujo() {
  return <Flujo />;
}

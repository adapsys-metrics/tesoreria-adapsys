import { Presupuesto } from "@/components/presupuesto/Presupuesto";
import { titulo } from "@/lib/marca";

export const metadata = { title: titulo("Presupuesto anual") };

export default function PaginaPresupuesto() {
  return <Presupuesto />;
}

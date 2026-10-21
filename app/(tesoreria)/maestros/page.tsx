import { Maestros } from "@/components/maestros/Maestros";
import { titulo } from "@/lib/marca";

export const metadata = { title: titulo("Maestros") };

export default function PaginaMaestros() {
  return <Maestros />;
}

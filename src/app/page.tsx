
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";
import { Toaster } from "@/components/ui/toaster"; // If you plan to use toasts

export default function Home() {
  return (
    <>
      <FlowBuilderClient />
      <Toaster />
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppHub } from "@/components/app-hub";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return <AppHub />;
}

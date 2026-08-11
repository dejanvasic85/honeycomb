import { createFileRoute } from "@tanstack/react-router";

import { LandingScreen } from "#/components/LandingScreen/LandingScreen";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LandingScreen />;
}

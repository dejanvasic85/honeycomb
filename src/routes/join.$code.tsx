import { createFileRoute } from "@tanstack/react-router";

import { LandingScreen } from "#/components/LandingScreen/LandingScreen";

export const Route = createFileRoute("/join/$code")({ component: JoinPage });

function JoinPage() {
  const { code } = Route.useParams();
  return <LandingScreen initialJoinCode={code.toUpperCase()} />;
}

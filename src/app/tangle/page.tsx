import { GameScreen } from "@/core/GameScreen";
import { gameMetadata } from "@/games/meta";

export const metadata = gameMetadata("tangle");

export default function Page() {
  return <GameScreen id="tangle" />;
}

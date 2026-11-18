import { GameScreen } from "@/core/GameScreen";
import { gameMetadata } from "@/games/meta";

export const metadata = gameMetadata("sumbroke");

export default function Page() {
  return <GameScreen id="sumbroke" />;
}
